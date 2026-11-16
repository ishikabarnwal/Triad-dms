"""MongoDB connection, GridFS bucket and index management."""

from flask import current_app
from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING, TEXT, MongoClient
from pymongo.errors import OperationFailure

# Prefix for the per-field indexes we manage, so we never touch indexes we didn't create.
METADATA_INDEX_PREFIX = "meta__"

# Mongo error codes for "an index with this name exists with different options/keys".
INDEX_CONFLICT_CODES = {85, 86}


def init_db(app):
    """Create the Mongo client, database handle and GridFS bucket and attach them to the app."""
    client = MongoClient(app.config["MONGO_URI"], serverSelectionTimeoutMS=5000, tz_aware=True)
    db = client[app.config["MONGO_DB"]]
    app.extensions["mongo_client"] = client
    app.extensions["mongo_db"] = db
    app.extensions["gridfs"] = GridFSBucket(db)


def get_db():
    """Return the database handle for the current app."""
    return current_app.extensions["mongo_db"]


def get_fs():
    """Return the GridFS bucket that holds every uploaded file."""
    return current_app.extensions["gridfs"]


def create_index(collection, keys, **options):
    """Create an index, replacing an existing one of the same name whose definition changed.

    Without this, changing an index's options in code would crash startup on any
    database that was seeded with the old definition.
    """
    try:
        collection.create_index(keys, **options)
    except OperationFailure as exc:
        if exc.code not in INDEX_CONFLICT_CODES:
            raise
        collection.drop_index(options["name"])
        collection.create_index(keys, **options)


def ensure_indexes(db):
    """Create the fixed indexes for every collection. Safe to run on every start."""
    create_index(db.divisions, "name", unique=True, name="divisions_name_unique")
    create_index(
        db.divisions,
        "code",
        unique=True,
        partialFilterExpression={"code": {"$type": "string"}},
        name="divisions_code_unique",
    )

    create_index(
        db.users,
        "email",
        unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
        name="users_email_unique",
    )
    create_index(
        db.users,
        "username",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
        name="users_username_unique",
    )

    create_index(db.metadata_fields, "key", unique=True, name="metadata_fields_key_unique")
    create_index(db.metadata_fields, [("active", ASCENDING), ("order", ASCENDING)], name="metadata_fields_active_order")

    create_index(db.documents, [("division", ASCENDING), ("created_at", DESCENDING)], name="documents_division_created")
    create_index(db.documents, [("created_at", DESCENDING)], name="documents_created")
    create_index(db.documents, "uploaded_by", name="documents_uploaded_by")
    create_index(
        db.documents,
        [("title", TEXT), ("search_blob", TEXT), ("ocr_text", TEXT)],
        weights={"title": 10, "search_blob": 5, "ocr_text": 1},
        name="documents_text",
    )

    # Mongo enforces the "one pending request per user per document" rule for us.
    create_index(
        db.access_requests,
        [("requester_id", ASCENDING), ("document_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"status": "pending"},
        name="access_requests_one_pending",
    )
    create_index(
        db.access_requests,
        [("document_id", ASCENDING), ("requester_id", ASCENDING), ("status", ASCENDING)],
        name="access_requests_lookup",
    )
    create_index(
        db.access_requests,
        [("owner_division", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)],
        name="access_requests_inbox",
    )
    create_index(
        db.access_requests,
        [("requester_id", ASCENDING), ("created_at", DESCENDING)],
        name="access_requests_mine",
    )

    create_index(db.audit_logs, [("created_at", DESCENDING)], name="audit_logs_created")
    create_index(db.audit_logs, [("actor_id", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_actor")
    create_index(db.audit_logs, [("division", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_division")
    create_index(db.audit_logs, [("action", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_action")


def sync_metadata_indexes(db):
    """Match the metadata.<key> indexes on documents to the active filterable fields.

    Called at startup and whenever an admin changes a field, so filters stay fast
    without hardcoding any field names. Returns the keys that are now indexed.
    """
    wanted = {
        f"{METADATA_INDEX_PREFIX}{field['key']}": field["key"]
        for field in db.metadata_fields.find({"active": True, "filterable": True}, {"key": 1})
    }
    existing = {name for name in db.documents.index_information() if name.startswith(METADATA_INDEX_PREFIX)}

    for name in existing - wanted.keys():
        db.documents.drop_index(name)
    for name in wanted.keys() - existing:
        db.documents.create_index([(f"metadata.{wanted[name]}", ASCENDING)], name=name)

    return sorted(wanted.values())
