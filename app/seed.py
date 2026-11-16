"""Idempotent seed: indexes, divisions, metadata fields and the super admin.

Run with `python -m app.seed`. Records that already exist are never overwritten,
so changes made from the Admin page survive restarts.
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


def seed_divisions(db, admin_division):
    """Create the default divisions plus the admin's division if it isn't one of them."""
    divisions = list(SEED_DIVISIONS)
    if admin_division not in {d["name"] for d in divisions}:
        divisions.append({"name": admin_division, "code": None, "description": "Administrator division."})

    created = []
    for division in divisions:
        if insert_if_missing(db.divisions, {"name": division["name"]}, {**division, "created_at": utcnow()}):
            created.append(division["name"])
    return created


def seed_metadata_fields(db):
    """Create the default metadata fields, keeping any admin edits to existing ones."""
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

    user = {
        "name": config["ADMIN_NAME"],
        "email": email,
        "username": config["ADMIN_USERNAME"] or None,
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        "division": config["ADMIN_DIVISION"],
        "role": "admin",
        "created_at": utcnow(),
    }
    return insert_if_missing(db.users, {"email": email}, user)


def run_seed(db, config):
    """Create indexes and seed data, then sync metadata filter indexes. Returns a summary."""
    ensure_indexes(db)
    summary = {
        "divisions_created": seed_divisions(db, config["ADMIN_DIVISION"]),
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
