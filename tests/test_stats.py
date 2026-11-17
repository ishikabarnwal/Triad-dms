"""Dashboard stats tests."""

from datetime import timedelta

import pytest
from bson import ObjectId

from app.utils import utcnow
from tests.samples import FAKE_PDF, text_pdf


@pytest.fixture
def activity(client, upload, tokens, db):
    """Uploads in both divisions, one old upload, and a few access requests."""
    upload(text_pdf("a"), title="A1", metadata={"Report Type": "Financial", "Classification": "SECRET"}, headers=tokens["a"])
    upload(text_pdf("b"), title="A2", metadata={"Report Type": "Financial"}, headers=tokens["a"])
    upload(FAKE_PDF, title="A3", metadata={"Report Type": "Technical"}, headers=tokens["a"])
    old = upload(text_pdf("c"), title="A-old", headers=tokens["a"]).get_json()["id"]
    b_doc = upload(text_pdf("d"), title="B1", metadata={"Report Type": "Operational"}, headers=tokens["b"]).get_json()["id"]

    db.documents.update_one({"_id": ObjectId(old)}, {"$set": {"created_at": utcnow() - timedelta(days=30)}})

    first = client.post("/api/access/request", json={"doc_id": b_doc}, headers=tokens["a"]).get_json()["id"]
    client.post("/api/access/approve", json={"request_id": first}, headers=tokens["b"])
    a_doc = client.get("/api/documents?q=A1", headers=tokens["a"]).get_json()["documents"][0]["id"]
    client.post("/api/access/request", json={"doc_id": a_doc}, headers=tokens["b"])


def stats(client, headers, query=""):
    """GET /api/stats as JSON (asserting 200)."""
    response = client.get(f"/api/stats{query}", headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_stats_need_login(client):
    assert client.get("/api/stats").status_code == 401


def test_member_stats_cover_only_my_division(client, tokens, activity):
    body = stats(client, tokens["a"])

    assert body["scope"] == "Division A"
    assert body["total_documents"] == 4
    assert body["uploaded_this_week"] == 3
    assert body["ocr"] == {"done": 3, "failed": 1, "skipped": 0}
    assert body["pending_requests"] == 1
    assert body["my_requests"] == {"pending": 0, "approved": 1, "rejected": 0, "revoked": 0, "expired": 0}
    assert "by_division" not in body


def test_default_breakdown_is_first_select_field_with_all_options(client, tokens, activity):
    group = stats(client, tokens["a"])["by_group"]

    assert group["field"] == "Report Type"
    counts = {row["value"]: row["count"] for row in group["counts"]}
    assert counts == {"Financial": 2, "Operational": 0, "Intelligence": 0, "Technical": 1, "Administrative": 0,
                      None: 1}


def test_group_by_another_select_field(client, tokens, activity):
    group = stats(client, tokens["a"], "?group_by=Classification")["by_group"]

    counts = {row["value"]: row["count"] for row in group["counts"]}
    assert group["field"] == "Classification"
    assert counts["SECRET"] == 1 and counts[None] == 3


@pytest.mark.parametrize("key", ["Reference Number", "Nope", "report type"])
def test_group_by_must_be_an_active_select_field(client, tokens, key):
    response = client.get(f"/api/stats?group_by={key}", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_group_by"


def test_recent_uploads_are_newest_first_and_capped(client, upload, tokens, activity):
    for n in range(4):
        upload(FAKE_PDF, title=f"Extra {n}", headers=tokens["a"])

    recent = stats(client, tokens["a"])["recent_uploads"]

    assert [d["title"] for d in recent] == ["Extra 3", "Extra 2", "Extra 1", "Extra 0", "A3"]
    assert all(d["can_download"] for d in recent)
    assert all("ocr_text" not in d for d in recent)


def test_expired_requests_are_counted_as_expired(client, tokens, activity, db):
    db.access_requests.update_many({"status": "approved"}, {"$set": {"expires_at": utcnow() - timedelta(days=1)}})

    assert stats(client, tokens["a"])["my_requests"]["expired"] == 1


def test_admin_stats_cover_all_divisions(client, tokens, activity):
    body = stats(client, tokens["admin"])

    assert body["scope"] == "all"
    assert body["total_documents"] == 5
    assert body["pending_requests"] == 1
    assert body["by_division"] == [
        {"division": "Division A", "count": 4},
        {"division": "Division B", "count": 1},
        {"division": "Headquarters", "count": 0},
    ]


def test_stats_on_an_empty_system(client, tokens):
    body = stats(client, tokens["b"])

    assert body["total_documents"] == 0
    assert body["recent_uploads"] == []
    assert all(row["count"] == 0 for row in body["by_group"]["counts"])


def test_recent_activity_mixes_uploads_and_decisions_newest_first(client, tokens, activity):
    events = stats(client, tokens["a"])["recent_activity"]

    assert len(events) == 5
    times = [event["at"] for event in events]
    assert times == sorted(times, reverse=True)
    kinds = {event["kind"] for event in events}
    assert {"requested", "approved", "upload"} <= kinds
    approval = next(event for event in events if event["kind"] == "approved")
    assert approval["document_title"] == "B1"
    assert approval["actor"] == "Bravo User"
    assert approval["division"] == "Division B"


def test_recent_activity_hides_other_divisions_uploads(client, tokens, activity):
    events = stats(client, tokens["b"])["recent_activity"]

    assert not [event for event in events if event["kind"] == "upload" and event["division"] != "Division B"]


def test_recent_activity_shows_revocations(client, tokens, activity):
    approved = client.get("/api/access/mine?status=approved", headers=tokens["a"]).get_json()["requests"][0]
    client.post("/api/access/revoke", json={"request_id": approved["id"]}, headers=tokens["b"])

    latest = stats(client, tokens["b"])["recent_activity"][0]
    assert latest["kind"] == "revoked"
    assert latest["document_title"] == "B1"


def test_recent_activity_is_empty_on_an_empty_system(client, tokens):
    assert stats(client, tokens["a"])["recent_activity"] == []
