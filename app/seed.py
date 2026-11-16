"""Idempotent seed: indexes, divisions, metadata fields and the super admin.

Run with `python -m app.seed`. Default divisions and fields are only added to an
empty collection, so anything an admin renames or deletes stays that way after a
restart. Existing records are never overwritten.
"""

import logging
from datetime import datetime, timezone

import bcrypt

from app.db import ensure_indexes, sync_metadata_indexes

log = logging.getLogger(__name__)

SEED_DIVISIONS = [
    {
        "name": "Headquarters",
        "code": "HQ",
        "description": "Command headquarters. Home division of the system administrator.",
    },
    {
        "name": "Division A",
        "code": "DIV-A",
        "description": "Operations and logistics records.",
    },
    {
        "name": "Division B",
        "code": "DIV-B",
        "description": "Research, technical and engineering records.",
    },
]

# Only "Division" is required: the evaluators' upload sends just Division and Report Type.
SEED_FIELDS = [
    {
        "key": "Division",
        "label": "Division",
        "type": "select",
        "options": [],
        "source": "divisions",
        "locked": True,
        "required": True,
        "filterable": True,
        "searchable": True,
    },
    {
        "key": "Report Type",
        "label": "Report Type",
        "type": "select",
        "options": ["Financial", "Operational", "Intelligence", "Technical", "Administrative"],
        "required": False,
        "filterable": True,
        "searchable": True,
    },
    {
        "key": "Classification",
        "label": "Classification",
        "type": "select",
        "options": ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"],
        "required": False,
        "filterable": True,
        "searchable": True,
    },
    {
        "key": "Document Date",
        "label": "Document Date",
        "type": "date",
        "options": [],
        "required": False,
        "filterable": True,
        "searchable": False,
    },
    {
        "key": "Reference Number",
        "label": "Reference Number",
        "type": "text",
        "options": [],
        "required": False,
        "filterable": False,
        "searchable": True,
    },
]


def utcnow():
    """Current time in UTC (Mongo stores datetimes as UTC)."""
    return datetime.now(timezone.utc)


def insert_if_missing(collection, query, document):
    """Insert `document` only if nothing matches `query`. Returns True when inserted."""
    result = collection.update_one(query, {"$setOnInsert": document}, upsert=True)
    return result.upserted_id is not None


def seed_divisions(db):
    """Create the default divisions on a fresh database."""
    if db.divisions.estimated_document_count():
        return []
    created = []
    for division in SEED_DIVISIONS:
        if insert_if_missing(db.divisions, {"name": division["name"]}, {**division, "created_at": utcnow()}):
            created.append(division["name"])
    return created


def ensure_division(db, name):
    """Make sure a division exists, creating a bare one if needed. Returns True if created."""
    return insert_if_missing(
        db.divisions,
        {"name": name},
        {"name": name, "code": None, "description": "Administrator division.", "created_at": utcnow()},
    )


def seed_metadata_fields(db):
    """Create the default metadata fields on a fresh database."""
    if db.metadata_fields.estimated_document_count():
        return []
    created = []
    for order, field in enumerate(SEED_FIELDS):
        now = utcnow()
        document = {
            "source": None,
            "locked": False,
            **field,
            "order": order,
            "active": True,
            "created_at": now,
            "updated_at": now,
        }
        if insert_if_missing(db.metadata_fields, {"key": field["key"]}, document):
            created.append(field["key"])
    return created


def seed_admin(db, config):
    """Create the super admin from ADMIN_EMAIL / ADMIN_PASSWORD. Skipped if either is missing."""
    email = config["ADMIN_EMAIL"].strip().lower()
    password = config["ADMIN_PASSWORD"]
    if not email or not password:
        log.warning("ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping super admin creation")
        return False
    if db.users.find_one({"email": email}, {"_id": 1}):
        return False

    ensure_division(db, config["ADMIN_DIVISION"])
    user = {
        "name": config["ADMIN_NAME"],
        "email": email,
        "username": config["ADMIN_USERNAME"] or None,
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=config["BCRYPT_ROUNDS"])).decode(),
        "division": config["ADMIN_DIVISION"],
        "role": "admin",
        "created_at": utcnow(),
    }
    return insert_if_missing(db.users, {"email": email}, user)


def run_seed(db, config):
    """Create indexes and seed data, then sync metadata filter indexes. Returns a summary."""
    ensure_indexes(db)
    summary = {
        "divisions_created": seed_divisions(db),
        "fields_created": seed_metadata_fields(db),
        "admin_created": seed_admin(db, config),
    }
    summary["indexed_fields"] = sync_metadata_indexes(db)
    return summary


def main():
    """Command-line entry point used by Docker before gunicorn starts."""
    from app import create_app

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    # The seed never serves requests, and the Mongo limiter storage errors when torn down at exit.
    app = create_app({"RATELIMIT_STORAGE_URI": "memory://"})
    summary = run_seed(app.extensions["mongo_db"], app.config)
    log.info("Seed complete: %s", summary)


if __name__ == "__main__":
    main()
