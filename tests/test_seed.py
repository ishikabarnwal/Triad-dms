"""Seed data tests: the evaluators depend on exact names, and reseeding must be safe."""

import bcrypt

from app.db import METADATA_INDEX_PREFIX, sync_metadata_indexes
from app.seed import run_seed


def test_required_divisions_exist(db):
    names = {d["name"] for d in db.divisions.find()}

    assert {"Division A", "Division B", "Headquarters"} <= names


def test_report_type_field_has_financial_option(db):
    field = db.metadata_fields.find_one({"key": "Report Type"})

    assert field is not None
    assert field["active"] is True
    assert "Financial" in field["options"]


def test_division_field_reads_options_from_divisions(db):
    field = db.metadata_fields.find_one({"key": "Division"})

    assert field["source"] == "divisions"
    assert field["locked"] is True
    assert field["required"] is True


def test_only_division_is_required(db):
    required = {f["key"] for f in db.metadata_fields.find({"required": True})}

    assert required == {"Division"}


def test_admin_is_created_in_headquarters(db):
    admin = db.users.find_one({"email": "admin@example.com"})

    assert admin["role"] == "admin"
    assert admin["division"] == "Headquarters"
    assert admin["password_hash"] != "Admin@12345"
    assert bcrypt.checkpw(b"Admin@12345", admin["password_hash"].encode())


def test_seed_is_idempotent_and_keeps_admin_edits(app, db):
    db.metadata_fields.update_one({"key": "Report Type"}, {"$set": {"label": "Type of Report"}})
    counts_before = {name: db[name].count_documents({}) for name in ("divisions", "metadata_fields", "users")}

    summary = run_seed(db, app.config)

    counts_after = {name: db[name].count_documents({}) for name in ("divisions", "metadata_fields", "users")}
    assert counts_after == counts_before
    assert summary["divisions_created"] == []
    assert summary["fields_created"] == []
    assert summary["admin_created"] is False
    assert db.metadata_fields.find_one({"key": "Report Type"})["label"] == "Type of Report"


def test_seed_skips_admin_without_credentials(app, db):
    db.users.delete_many({})

    summary = run_seed(db, {**app.config, "ADMIN_PASSWORD": ""})

    assert summary["admin_created"] is False
    assert db.users.count_documents({}) == 0


def test_filterable_fields_get_indexes(db):
    index_names = set(db.documents.index_information())

    assert f"{METADATA_INDEX_PREFIX}Report Type" in index_names
    assert f"{METADATA_INDEX_PREFIX}Reference Number" not in index_names


def test_index_sync_follows_field_changes(db):
    db.metadata_fields.update_one({"key": "Report Type"}, {"$set": {"filterable": False}})
    db.metadata_fields.update_one({"key": "Reference Number"}, {"$set": {"filterable": True}})

    indexed = sync_metadata_indexes(db)

    index_names = set(db.documents.index_information())
    assert "Report Type" not in indexed
    assert f"{METADATA_INDEX_PREFIX}Report Type" not in index_names
    assert f"{METADATA_INDEX_PREFIX}Reference Number" in index_names
