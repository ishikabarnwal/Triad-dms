"""The demo seed: it fills an empty database with the full story, refuses to overwrite data, and resets safely."""

from collections import Counter
from datetime import datetime, timezone

import pytest

from app.demo_seed import DEMO_PASSWORD, DOCUMENTS, USERS, DemoSeedRefused, run_demo_seed


@pytest.fixture(scope="module")
def seeded(make_module_app):
    """One seeded database shared by the tests below, because the seed runs OCR on every upload."""
    app = make_module_app()
    removed, summary = run_demo_seed(app)
    return app, removed, summary


@pytest.fixture(scope="module")
def make_module_app():
    """Module scoped version of make_app, so the slow seed runs once for this file."""
    from app import create_app
    from app.seed import run_seed
    from tests.conftest import TEST_CONFIG, TEST_DB

    created = []

    def factory(**overrides):
        app = create_app({**TEST_CONFIG, **overrides})
        app.extensions["mongo_client"].drop_database(TEST_DB)
        run_seed(app.extensions["mongo_db"], app.config)
        created.append(app)
        return app

    yield factory
    for app in created:
        app.extensions["mongo_client"].drop_database(TEST_DB)


def test_counts_match_the_story(seeded):
    app, _, summary = seeded
    db = app.extensions["mongo_db"]

    assert summary["users"] == len(USERS) == 4
    assert summary["documents"] == len(DOCUMENTS) == 14
    assert summary["by_division"] == {"Division A": 6, "Division B": 5, "Headquarters": 3}
    assert summary["scanned_images"] == 3
    assert summary["access_requests"] == {"pending": 2, "approved": 2, "rejected": 1, "revoked": 1, "expired": 1}
    assert db.users.count_documents({"role": "admin"}) == 1


def test_every_document_went_through_the_real_upload(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]

    documents = list(db.documents.find())
    assert all(document["gridfs_id"] for document in documents)
    assert db.fs.files.count_documents({}) == len(documents)
    assert {document["ocr_status"] for document in documents} == {"done"}
    assert Counter(entry["action"] for entry in db.audit_logs.find({"action": "document.upload"}))["document.upload"] == 14
    assert all(document["page_count"] >= 2 for document in documents if document["content_type"] == "application/pdf")


def test_scanned_images_are_read_by_ocr(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]

    scans = list(db.documents.find({"content_type": {"$regex": "^image/"}}))
    assert len(scans) == 3
    for scan in scans:
        assert scan["ocr_status"] == "done"
        assert len(scan["ocr_text"]) > 80
    inspection = db.documents.find_one({"title": "Vehicle Inspection Sheet, Depot 3"})
    assert "tanker" in inspection["ocr_text"].lower()


def test_page_banners_stay_out_of_the_extracted_text(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]

    for document in db.documents.find({"content_type": "application/pdf"}):
        label = document["metadata"]["Classification"]
        # Once, in the title block; the banners on every page are images, so snippets never repeat them.
        assert document["ocr_text"].count(label) == 1, document["title"]
        assert document["ocr_text"].startswith(document["title"])


def test_timestamps_are_spread_over_three_weeks(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]
    now = datetime.now(timezone.utc)

    upload_days = {document["created_at"].date() for document in db.documents.find()}
    audit_days = {entry["created_at"].date() for entry in db.audit_logs.find()}
    ages = [(now - document["created_at"]).days for document in db.documents.find()]

    assert len(upload_days) >= 12
    assert len(audit_days) >= 15
    assert max(ages) <= 22 and min(ages) >= 2


def test_access_states_carry_their_details(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]

    rejected = db.access_requests.find_one({"status": "rejected"})
    revoked = db.access_requests.find_one({"status": "revoked"})
    no_expiry = db.access_requests.find_one({"status": "approved", "expires_at": None})

    assert rejected["decision_note"]
    assert revoked["revoke_note"] and revoked["revoked_at"] > revoked["decided_at"] > revoked["created_at"]
    assert no_expiry is not None
    actions = Counter(entry["action"] for entry in db.audit_logs.find())
    assert actions["document.download_denied"] == 1
    assert actions["auth.login_failed"] == 1
    assert actions["document.preview"] == 1


def test_demo_users_can_sign_in(seeded):
    app, _, _ = seeded
    client = app.test_client()

    response = client.post("/api/auth/login", json={"email": USERS["meera"]["email"], "password": DEMO_PASSWORD})

    assert response.status_code == 200
    assert response.get_json()["user"]["division"] == "Division B"


def test_refuses_to_run_over_existing_documents(seeded):
    app, _, _ = seeded

    with pytest.raises(DemoSeedRefused):
        run_demo_seed(app)


def test_wrong_admin_password_refuses_before_anything_is_removed(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]
    password = app.config["ADMIN_PASSWORD"]
    app.config["ADMIN_PASSWORD"] = "not-the-server-password"
    try:
        with pytest.raises(DemoSeedRefused, match="Nothing was changed"):
            run_demo_seed(app, reset_first=True)
    finally:
        app.config["ADMIN_PASSWORD"] = password

    assert db.documents.count_documents({}) == 14
    assert db.users.count_documents({"role": {"$ne": "admin"}}) == 4


def test_reset_keeps_admins_divisions_and_fields(seeded):
    app, _, _ = seeded
    db = app.extensions["mongo_db"]
    divisions = sorted(division["name"] for division in db.divisions.find())
    fields = sorted(field["key"] for field in db.metadata_fields.find())

    removed, summary = run_demo_seed(app, reset_first=True)

    assert removed["documents"] == 14 and removed["users"] == 4
    assert summary["documents"] == 14 and summary["users"] == 4
    assert db.users.count_documents({"role": "admin"}) == 1
    assert sorted(division["name"] for division in db.divisions.find()) == divisions
    assert sorted(field["key"] for field in db.metadata_fields.find()) == fields
