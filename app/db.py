"""MongoDB connection, GridFS bucket and index management."""

from flask import current_app
from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING, TEXT, MongoClient

# Prefix for the per-field indexes we manage, so we never touch indexes we didn't create.
METADATA_INDEX_PREFIX = "meta__"


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


def ensure_indexes(db):
    """Create the fixed indexes for every collection. Safe to run on every start."""
    db.divisions.create_index("name", unique=True, name="divisions_name_unique")
    db.divisions.create_index(
        "code",
        unique=True,
        partialFilterExpression={"code": {"$type": "string"}},
        name="divisions_code_unique",
    )

    db.users.create_index("email", unique=True, name="users_email_unique")
    db.users.create_index(
        "username",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
        name="users_username_unique",
    )

    db.metadata_fields.create_index("key", unique=True, name="metadata_fields_key_unique")
    db.metadata_fields.create_index([("active", ASCENDING), ("order", ASCENDING)], name="metadata_fields_active_order")

    db.documents.create_index([("division", ASCENDING), ("created_at", DESCENDING)], name="documents_division_created")
    db.documents.create_index([("created_at", DESCENDING)], name="documents_created")
    db.documents.create_index("uploaded_by", name="documents_uploaded_by")
    db.documents.create_index(
        [("title", TEXT), ("search_blob", TEXT), ("ocr_text", TEXT)],
        weights={"title": 10, "search_blob": 5, "ocr_text": 1},
        name="documents_text",
    )

    # Mongo enforces the "one pending request per user per document" rule for us.
    db.access_requests.create_index(
        [("requester_id", ASCENDING), ("document_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"status": "pending"},
        name="access_requests_one_pending",
    )
    db.access_requests.create_index(
        [("document_id", ASCENDING), ("requester_id", ASCENDING), ("status", ASCENDING)],
        name="access_requests_lookup",
    )
    db.access_requests.create_index(
        [("owner_division", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)],
        name="access_requests_inbox",
    )
    db.access_requests.create_index(
        [("requester_id", ASCENDING), ("created_at", DESCENDING)],
        name="access_requests_mine",
    )

    db.audit_logs.create_index([("created_at", DESCENDING)], name="audit_logs_created")
    db.audit_logs.create_index([("actor_id", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_actor")
    db.audit_logs.create_index([("division", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_division")
    db.audit_logs.create_index([("action", ASCENDING), ("created_at", DESCENDING)], name="audit_logs_action")


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
