"""Dashboard numbers: my division's documents and requests, or everything for the super admin."""

from datetime import timedelta

from flask import Blueprint, g, jsonify, request

from app.db import get_db
from app.metadata import active_fields
from app.models import serialize_document
from app.schemas import StatsQuery
from app.utils import (
    ApiError,
    access_status,
    can_download,
    division_names,
    is_admin,
    login_required,
    request_state,
    utcnow,
)

stats_bp = Blueprint("stats", __name__)

REQUEST_STATUSES = ("pending", "approved", "rejected", "revoked", "expired")
OCR_STATUSES = ("done", "failed", "skipped")
RECENT_UPLOADS = 5
WEEK = timedelta(days=7)


def group_field(fields, key):
    """The select field to break documents down by.

    Uses ?group_by=<key> when given; otherwise the first select field that isn't the
    division field, so the default follows whatever the admin configured.
    """
    selects = [field for field in fields if field.get("type") == "select"]
    if key:
        field = next((f for f in selects if f["key"] == key), None)
        if not field:
            raise ApiError(400, "invalid_group_by", f"'{key}' is not an active select field.")
        return field
    return next((field for field in selects if field.get("source") != "divisions"), None)


def count_by(scope, path):
    """Map value -> number of documents, for one stored field."""
    pipeline = [{"$match": scope}, {"$group": {"_id": f"${path}", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    return {row["_id"]: row["count"] for row in get_db().documents.aggregate(pipeline)}


def grouped_counts(scope, field):
    """Document counts per option of a select field, every option listed, unset values as null."""
    if not field:
        return None
    counts = count_by(scope, f"metadata.{field['key']}")
    options = division_names() if field.get("source") == "divisions" else field.get("options") or []
    rows = [{"value": option, "count": counts.pop(option, 0)} for option in options]
    rows += [{"value": value, "count": count} for value, count in counts.items()]
    return {"field": field["key"], "counts": rows}


def my_request_counts(user):
    """My sent requests per live status (approvals past expiry count as expired)."""
    counts = dict.fromkeys(REQUEST_STATUSES, 0)
    for access_request in get_db().access_requests.find({"requester_id": user["_id"]}, {"status": 1, "expires_at": 1}):
        counts[request_state(access_request)] += 1
    return counts


def recent_uploads(user, scope):
    """The latest uploads in scope, newest first."""
    cursor = (
        get_db().documents.find(scope, {"ocr_text": 0, "search_blob": 0})
        .sort([("created_at", -1), ("_id", -1)])
        .limit(RECENT_UPLOADS)
    )
    items = []
    for document in cursor:
        status = access_status(user, document)
        items.append(serialize_document(document, (status, can_download(status))))
    return items


@stats_bp.get("/stats")
@login_required
def stats():
    """Dashboard numbers for my division, or across all divisions for the super admin.

    ?group_by=<select field key> picks the breakdown (defaults to the first select field).
    """
    user = g.current_user
    admin = is_admin(user)
    query = StatsQuery.model_validate(request.args.to_dict())
    field = group_field(active_fields(), query.group_by)

    db = get_db()
    scope = {} if admin else {"division": user["division"]}
    ocr = count_by(scope, "ocr_status")
    inbox_scope = {} if admin else {"owner_division": user["division"]}

    body = {
        "scope": "all" if admin else user["division"],
        "total_documents": db.documents.count_documents(scope),
        "uploaded_this_week": db.documents.count_documents({**scope, "created_at": {"$gte": utcnow() - WEEK}}),
        "ocr": {status: ocr.get(status, 0) for status in OCR_STATUSES},
        "by_group": grouped_counts(scope, field),
        "pending_requests": db.access_requests.count_documents({**inbox_scope, "status": "pending"}),
        "my_requests": my_request_counts(user),
        "recent_uploads": recent_uploads(user, scope),
    }
    if admin:
        per_division = count_by({}, "division")
        body["by_division"] = [{"division": name, "count": per_division.get(name, 0)} for name in division_names()]
    return jsonify(body)
