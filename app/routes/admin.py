"""Super admin endpoints: metadata fields, divisions, users and the audit log."""

import math
import re

from flask import Blueprint, g, jsonify, request
from pymongo import UpdateOne

from app.db import get_db, sync_metadata_indexes
from app.filters import date_range, division_condition
from app.metadata import check_key, division_field, field_options, usage_count
from app.models import parse_object_id, serialize_audit, serialize_division, serialize_field, serialize_user
from app.schemas import (
    AuditQuery,
    DivisionCreate,
    DivisionUpdate,
    FieldCreate,
    FieldReorder,
    FieldUpdate,
    UserQuery,
    UserUpdate,
)
from app.utils import ApiError, admin_required, find_division, read_body, utcnow, write_audit

admin_bp = Blueprint("admin", __name__)

# The division field's behaviour depends on these, so they can't be edited.
LOCKED_FIELD_ATTRIBUTES = {"key", "type", "options", "required", "active"}


def page_body(name, items, total, query):
    """Standard paginated response."""
    return {
        name: items,
        "total": total,
        "page": query.page,
        "limit": query.limit,
        "pages": math.ceil(total / query.limit) if total else 0,
    }


def get_or_404(collection, object_id, code, label):
    """Load one record by id or raise 404."""
    parsed = parse_object_id(object_id)
    record = collection.find_one({"_id": parsed}) if parsed else None
    if not record:
        raise ApiError(404, code, f"{label} not found.")
    return record


def exact_ignoring_case(value):
    """Regex for an exact, case-insensitive match."""
    return re.compile(f"^{re.escape(value)}$", re.IGNORECASE)


def audit_admin(action, target_type, target_id, details):
    """Audit entry for an admin change."""
    write_audit(action, actor=g.current_user, target_type=target_type, target_id=target_id, details=details)


# ---- metadata fields ----

def serialize_fields_for_admin(fields):
    """Fields with resolved options and how many documents use each one."""
    options = field_options(fields)
    return [serialize_field(field, options[field["key"]], usage_count(field["key"])) for field in fields]


def ensure_key_available(key, exclude_id=None):
    """400 for unsafe or reserved keys, 409 if another field (active or not) already has this key."""
    problem = check_key(key)
    if problem:
        raise ApiError(400, "invalid_key", problem, field="key")
    query = {"key": exact_ignoring_case(key)}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    existing = get_db().metadata_fields.find_one(query)
    if existing:
        hint = "" if existing.get("active", True) else " It was deleted earlier; edit it and set active to restore it."
        raise ApiError(
            409,
            "field_exists",
            f"A field with key '{existing['key']}' already exists.{hint}",
            field="key",
            field_id=str(existing["_id"]),
        )


def ensure_select_has_options(field_type, options, field=None):
    """Select fields need at least one option (unless their options come from divisions)."""
    if field_type == "select" and not options and not (field and field.get("source")):
        raise ApiError(400, "options_required", "A select field needs at least one option.", field="options")


def field_response(field, status=200):
    """Serialize one field for the admin, after re-syncing filter indexes."""
    sync_metadata_indexes(get_db())
    options = field_options([field])[field["key"]]
    return jsonify(serialize_field(field, options, usage_count(field["key"]))), status


@admin_bp.get("/metadata-fields")
@admin_required
def list_fields():
    """All metadata fields, including deleted ones, with usage counts."""
    fields = list(get_db().metadata_fields.find().sort([("active", -1), ("order", 1)]))
    return jsonify({"fields": serialize_fields_for_admin(fields)})


@admin_bp.post("/metadata-fields")
@admin_required
def create_field():
    """Add a metadata field. It appears on upload forms and filters straight away."""
    data = FieldCreate.model_validate(read_body())
    ensure_key_available(data.key)
    ensure_select_has_options(data.type, data.options)

    collection = get_db().metadata_fields
    last = collection.find_one({}, {"order": 1}, sort=[("order", -1)])
    now = utcnow()
    field = {
        **data.model_dump(),
        "label": data.label or data.key,
        "options": data.options if data.type == "select" else [],
        "source": None,
        "locked": False,
        "active": True,
        "order": (last["order"] + 1) if last else 0,
        "created_at": now,
        "updated_at": now,
    }
    field["_id"] = collection.insert_one(field).inserted_id
    audit_admin("admin.field_create", "metadata_field", field["_id"], {"key": field["key"], "type": field["type"]})
    return field_response(field, 201)


@admin_bp.put("/metadata-fields/reorder")
@admin_required
def reorder_fields():
    """Set the display order. Fields not listed keep their relative order after the listed ones."""
    data = FieldReorder.model_validate(read_body())
    ids = [parse_object_id(field_id) for field_id in data.ids]
    if None in ids or len(set(ids)) != len(ids):
        raise ApiError(400, "invalid_order", "ids must be a list of distinct field ids.")

    collection = get_db().metadata_fields
    fields = list(collection.find().sort("order", 1))
    known = {field["_id"] for field in fields}
    unknown = [str(field_id) for field_id in ids if field_id not in known]
    if unknown:
        raise ApiError(400, "invalid_order", f"Unknown field ids: {', '.join(unknown)}.")

    listed = set(ids)
    ordered = ids + [field["_id"] for field in fields if field["_id"] not in listed]
    collection.bulk_write([
        UpdateOne({"_id": field_id}, {"$set": {"order": index}}) for index, field_id in enumerate(ordered)
    ])
    audit_admin("admin.field_reorder", "metadata_field", None, {"order": [str(field_id) for field_id in ordered]})
    return list_fields()


@admin_bp.put("/metadata-fields/<field_id>")
@admin_required
def update_field(field_id):
    """Edit a field. Key and type can only change while no document uses the field."""
    collection = get_db().metadata_fields
    field = get_or_404(collection, field_id, "field_not_found", "Metadata field")
    changes = FieldUpdate.model_validate(read_body()).model_dump(exclude_unset=True, exclude_none=True)
    changes = {name: value for name, value in changes.items() if value != field.get(name)}

    if field.get("locked") and LOCKED_FIELD_ATTRIBUTES & changes.keys():
        blocked = ", ".join(sorted(LOCKED_FIELD_ATTRIBUTES & changes.keys()))
        raise ApiError(400, "field_locked", f"The {field['key']} field is built in; its {blocked} can't be changed.")

    in_use = usage_count(field["key"])
    if "key" in changes:
        ensure_key_available(changes["key"], exclude_id=field["_id"])
    for attribute in ("key", "type"):
        if attribute in changes and in_use:
            raise ApiError(
                409,
                "field_in_use",
                f"{in_use} documents use '{field['key']}', so its {attribute} can't change.",
                field=attribute,
                usage_count=in_use,
            )

    new_type = changes.get("type", field.get("type"))
    ensure_select_has_options(new_type, changes.get("options", field.get("options")), field)

    if changes:
        changes["updated_at"] = utcnow()
        collection.update_one({"_id": field["_id"]}, {"$set": changes})
        changed = sorted(set(changes) - {"updated_at"})
        audit_admin("admin.field_update", "metadata_field", field["_id"], {"key": field["key"], "changes": changed})
    return field_response(collection.find_one({"_id": field["_id"]}))


@admin_bp.delete("/metadata-fields/<field_id>")
@admin_required
def delete_field(field_id):
    """Soft-delete a field: it disappears from forms and filters, but documents keep their values."""
    collection = get_db().metadata_fields
    field = get_or_404(collection, field_id, "field_not_found", "Metadata field")
    if field.get("locked"):
        raise ApiError(400, "field_locked", f"The {field['key']} field is built in and can't be deleted.")

    collection.update_one({"_id": field["_id"]}, {"$set": {"active": False, "updated_at": utcnow()}})
    audit_admin("admin.field_delete", "metadata_field", field["_id"], {"key": field["key"]})
    return field_response(collection.find_one({"_id": field["_id"]}))


# ---- divisions ----

def division_counts(name):
    """How many users and documents belong to a division."""
    db = get_db()
    return {
        "user_count": db.users.count_documents({"division": name}),
        "document_count": db.documents.count_documents({"division": name}),
    }


def ensure_division_unique(name=None, code=None, exclude_id=None):
    """409 if another division already uses this name or code (ignoring case)."""
    for value, label in ((name, "name"), (code, "code")):
        if not value:
            continue
        existing = find_division(value)
        if existing and existing["_id"] != exclude_id:
            raise ApiError(409, "division_exists", f"A division already uses the {label} '{value}'.", field=label)


def rename_division(old, new):
    """Carry a division rename through every record that stores the division name.

    Names are stored rather than ids so documents read naturally and filter simply;
    the cost is this cascade. Audit history keeps the old name on purpose.
    """
    db = get_db()
    field = division_field(list(db.metadata_fields.find({"active": True})))
    document_changes = {
        "division": {"$literal": new},
        "search_blob": {"$replaceAll": {"input": {"$ifNull": ["$search_blob", ""]}, "find": old, "replacement": new}},
    }
    if field:
        document_changes[f"metadata.{field['key']}"] = {"$literal": new}

    db.users.update_many({"division": old}, {"$set": {"division": new}})
    db.documents.update_many({"division": old}, [{"$set": document_changes}])
    db.access_requests.update_many({"owner_division": old}, {"$set": {"owner_division": new}})
    db.access_requests.update_many({"requester_division": old}, {"$set": {"requester_division": new}})
    db.fs.files.update_many({"metadata.division": old}, {"$set": {"metadata.division": new}})


@admin_bp.get("/divisions")
@admin_required
def list_divisions():
    """All divisions with user and document counts."""
    divisions = get_db().divisions.find().sort("name", 1)
    return jsonify({"divisions": [serialize_division(d, division_counts(d["name"])) for d in divisions]})


@admin_bp.post("/divisions")
@admin_required
def create_division():
    """Add a division. It shows up on the signup page and upload form immediately."""
    data = DivisionCreate.model_validate(read_body())
    ensure_division_unique(data.name, data.code)
    division = {**data.model_dump(), "created_at": utcnow()}
    division["_id"] = get_db().divisions.insert_one(division).inserted_id
    audit_admin("admin.division_create", "division", division["_id"], {"name": division["name"]})
    return jsonify(serialize_division(division, division_counts(division["name"]))), 201


@admin_bp.put("/divisions/<division_id>")
@admin_required
def update_division(division_id):
    """Rename or edit a division. A rename updates every user, document and request in it."""
    collection = get_db().divisions
    division = get_or_404(collection, division_id, "division_not_found", "Division")
    changes = DivisionUpdate.model_validate(read_body()).model_dump(exclude_unset=True, exclude_none=True)
    changes = {name: value for name, value in changes.items() if value != division.get(name)}
    ensure_division_unique(changes.get("name"), changes.get("code"), exclude_id=division["_id"])

    if changes:
        collection.update_one({"_id": division["_id"]}, {"$set": changes})
        if "name" in changes:
            rename_division(division["name"], changes["name"])
        audit_admin("admin.division_update", "division", division["_id"], {"name": division["name"], "changes": changes})
    updated = collection.find_one({"_id": division["_id"]})
    return jsonify(serialize_division(updated, division_counts(updated["name"])))


@admin_bp.delete("/divisions/<division_id>")
@admin_required
def delete_division(division_id):
    """Delete an empty division. 409 while it still has users or documents."""
    collection = get_db().divisions
    division = get_or_404(collection, division_id, "division_not_found", "Division")
    counts = division_counts(division["name"])
    if counts["user_count"] or counts["document_count"]:
        raise ApiError(
            409,
            "division_in_use",
            f"{division['name']} still has {counts['user_count']} users and {counts['document_count']} documents.",
            **counts,
        )
    collection.delete_one({"_id": division["_id"]})
    audit_admin("admin.division_delete", "division", division["_id"], {"name": division["name"]})
    return jsonify({"message": f"Division {division['name']} deleted.", "id": str(division["_id"])})


# ---- users ----

@admin_bp.get("/users")
@admin_required
def list_users():
    """Users, newest first. Filter with ?q= (name, email, username), ?division= and ?role=."""
    query = UserQuery.model_validate(request.args.to_dict())
    conditions = []
    if query.q:
        pattern = re.compile(re.escape(query.q), re.IGNORECASE)
        conditions.append({"$or": [{"name": pattern}, {"email": pattern}, {"username": pattern}]})
    if query.division:
        conditions.append(division_condition(query.division))
    if query.role:
        conditions.append({"role": query.role})

    mongo_query = {"$and": conditions} if conditions else {}
    users = get_db().users
    total = users.count_documents(mongo_query)
    cursor = users.find(mongo_query).sort([("created_at", -1), ("_id", -1)]).skip((query.page - 1) * query.limit)
    items = [serialize_user(user) for user in cursor.limit(query.limit)]
    return jsonify(page_body("users", items, total, query))


@admin_bp.put("/users/<user_id>")
@admin_required
def update_user(user_id):
    """Change a user's role or division. Admins can't demote themselves."""
    users = get_db().users
    user = get_or_404(users, user_id, "user_not_found", "User")
    data = UserUpdate.model_validate(read_body())

    changes = {}
    if data.role and data.role != user.get("role"):
        if user["_id"] == g.current_user["_id"] and data.role != "admin":
            raise ApiError(400, "cannot_demote_self", "You can't remove your own admin role.")
        changes["role"] = data.role
    if data.division:
        division = find_division(data.division)
        if not division:
            raise ApiError(400, "unknown_division", f"Unknown division '{data.division}'.")
        if division["name"] != user.get("division"):
            changes["division"] = division["name"]

    if changes:
        before = {name: user.get(name) for name in changes}
        users.update_one({"_id": user["_id"]}, {"$set": changes})
        details = {"name": user.get("name"), "before": before, "after": changes}
        audit_admin("admin.user_update", "user", user["_id"], details)
    return jsonify(serialize_user(users.find_one({"_id": user["_id"]})))


# ---- audit log ----

def audit_conditions(query):
    """Mongo conditions for the audit log filters."""
    conditions = []
    if query.action:
        # Prefix match, so ?action=access finds access.request, access.approve, ...
        # Several prefixes can be given, comma separated, for groups like downloads and previews.
        prefixes = [prefix.strip() for prefix in query.action.split(",") if prefix.strip()]
        conditions.append({"action": re.compile("^(" + "|".join(re.escape(prefix) for prefix in prefixes) + ")")})
    if query.actor:
        actor_id = parse_object_id(query.actor)
        if actor_id:
            conditions.append({"actor_id": str(actor_id)})
        else:
            conditions.append({"actor_name": re.compile(re.escape(query.actor), re.IGNORECASE)})
    if query.division:
        # History keeps old division names, so match the text rather than a current division.
        conditions.append({"division": exact_ignoring_case(query.division)})
    created = date_range("created_at", query.date_from, query.date_to)
    if created:
        conditions.append(created)
    return conditions


@admin_bp.get("/audit-logs")
@admin_required
def audit_logs():
    """Audit log, newest first. Filter by action (prefixes, comma separated), actor (id or name), division and dates."""
    query = AuditQuery.model_validate(request.args.to_dict())
    conditions = audit_conditions(query)
    mongo_query = {"$and": conditions} if conditions else {}
    logs = get_db().audit_logs
    total = logs.count_documents(mongo_query)
    cursor = logs.find(mongo_query).sort([("created_at", -1), ("_id", -1)]).skip((query.page - 1) * query.limit)
    items = [serialize_audit(entry) for entry in cursor.limit(query.limit)]
    return jsonify(page_body("logs", items, total, query))
