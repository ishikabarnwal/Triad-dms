"""List, details, download and preview tests, including division isolation."""

from datetime import timedelta

import pytest
from bson import ObjectId

from app.utils import utcnow
from tests.samples import text_pdf

SECRET_PHRASE = "Classified troop movement schedule"


@pytest.fixture
def docs(upload, tokens):
    """Three Division A documents and one Division B document. Returns their ids by name."""

    def add(headers, title, report_type, **extra):
        metadata = {"Report Type": report_type, **extra}
        response = upload(text_pdf(f"{SECRET_PHRASE} {title}"), title=title, metadata=metadata, headers=headers)
        assert response.status_code == 201, response.get_json()
        return response.get_json()["id"]

    return {
        "a_fin": add(tokens["a"], "Alpha Budget", "Financial", **{"Document Date": "2026-01-10"}),
        "a_ops": add(tokens["a"], "Alpha Ops", "Operational", **{"Document Date": "2026-03-05"}),
        "a_tech": add(tokens["a"], "Alpha Radar", "Technical", Classification="SECRET"),
        "b_fin": add(tokens["b"], "Bravo Budget", "Financial"),
    }


def list_titles(client, headers, query=""):
    """Titles returned by GET /api/documents with the given query string."""
    response = client.get(f"/api/documents{query}", headers=headers)
    assert response.status_code == 200, response.get_json()
    return sorted(d["title"] for d in response.get_json()["documents"])


def grant(db, requester_email, doc_id, status="approved", expires_at=None):
    """Insert an access request directly, as Phase 4's approve endpoint will."""
    user = db.users.find_one({"email": requester_email})
    db.access_requests.insert_one({
        "document_id": ObjectId(doc_id),
        "requester_id": user["_id"],
        "requester_division": user["division"],
        "status": status,
        "expires_at": expires_at,
        "created_at": utcnow(),
    })


# ---- listing ----

def test_list_requires_login(client):
    assert client.get("/api/documents").status_code == 401


def test_default_scope_shows_only_my_division(client, tokens, docs):
    assert list_titles(client, tokens["a"]) == ["Alpha Budget", "Alpha Ops", "Alpha Radar"]
    assert list_titles(client, tokens["b"]) == ["Bravo Budget"]


def test_scope_all_shows_everything_with_access_flags(client, tokens, docs):
    response = client.get("/api/documents?scope=all", headers=tokens["b"])

    documents = {d["title"]: d for d in response.get_json()["documents"]}
    assert len(documents) == 4
    assert documents["Bravo Budget"]["can_download"] is True
    assert documents["Bravo Budget"]["access_status"] == "owner"
    assert documents["Alpha Budget"]["can_download"] is False
    assert documents["Alpha Budget"]["access_status"] == "none"
    assert documents["Alpha Budget"]["metadata"]["Report Type"] == "Financial"


def test_list_never_returns_ocr_text(client, tokens, docs):
    response = client.get("/api/documents?scope=all", headers=tokens["a"])

    for document in response.get_json()["documents"]:
        assert "ocr_text" not in document
        assert "search_blob" not in document


def test_filter_by_metadata_key_with_space(client, tokens, docs):
    assert list_titles(client, tokens["a"], "?Report Type=Financial") == ["Alpha Budget"]


def test_filter_value_is_case_insensitive_for_selects(client, tokens, docs):
    assert list_titles(client, tokens["a"], "?Report%20Type=financial") == ["Alpha Budget"]


def test_filter_by_division_across_scope_all(client, tokens, docs):
    titles = list_titles(client, tokens["b"], "?scope=all&Division=Division A&Report Type=Financial")

    assert titles == ["Alpha Budget"]


def test_repeated_filter_matches_any_value(client, tokens, docs):
    titles = list_titles(client, tokens["a"], "?Report Type=Financial&Report Type=Technical")

    assert titles == ["Alpha Budget", "Alpha Radar"]


def test_date_filter_values_are_normalised(client, tokens, docs):
    assert list_titles(client, tokens["a"], "?Document Date=05/03/2026") == ["Alpha Ops"]


def test_invalid_date_filter_is_400(client, tokens, docs):
    response = client.get("/api/documents?Document Date=someday", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_filter"


def test_number_filters_are_converted(client, upload, tokens, db):
    db.metadata_fields.insert_one({"key": "Budget", "label": "Budget", "type": "number", "active": True, "order": 9})
    upload(text_pdf("x"), title="Cheap", metadata={"Budget": 100}, headers=tokens["a"])
    upload(text_pdf("x"), title="Pricey", metadata={"Budget": "250000"}, headers=tokens["a"])

    assert list_titles(client, tokens["a"], "?Budget=250000") == ["Pricey"]
    assert client.get("/api/documents?Budget=lots", headers=tokens["a"]).status_code == 400


def test_unknown_keys_can_be_filtered(client, upload, tokens):
    upload(text_pdf("x"), title="Tagged", metadata={"Project Code": "X-17"}, headers=tokens["a"])
    upload(text_pdf("x"), title="Untagged", headers=tokens["a"])

    assert list_titles(client, tokens["a"], "?Project Code=x-17") == ["Tagged"]


def test_filter_names_cannot_inject_operators(client, tokens, docs):
    response = client.get("/api/documents?$where=1", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_filter"


def test_reserved_params_are_not_metadata_filters(client, tokens, docs):
    response = client.get("/api/documents?page=1&limit=2&sort=title&order=asc&scope=division", headers=tokens["a"])

    body = response.get_json()
    assert body["total"] == 3
    assert [d["title"] for d in body["documents"]] == ["Alpha Budget", "Alpha Ops"]


def test_pagination(client, tokens, docs):
    first = client.get("/api/documents?limit=2&page=1", headers=tokens["a"]).get_json()
    second = client.get("/api/documents?limit=2&page=2", headers=tokens["a"]).get_json()

    assert (first["total"], first["pages"], len(first["documents"])) == (3, 2, 2)
    assert len(second["documents"]) == 1
    seen = {d["id"] for d in first["documents"]} | {d["id"] for d in second["documents"]}
    assert len(seen) == 3


def test_default_sort_is_newest_first(client, tokens, docs):
    response = client.get("/api/documents", headers=tokens["a"])

    assert [d["title"] for d in response.get_json()["documents"]] == ["Alpha Radar", "Alpha Ops", "Alpha Budget"]


def test_sort_by_metadata_field(client, tokens, docs):
    response = client.get("/api/documents?sort=Report Type&order=asc", headers=tokens["a"])

    assert [d["metadata"]["Report Type"] for d in response.get_json()["documents"]] == [
        "Financial",
        "Operational",
        "Technical",
    ]


def test_q_matches_title(client, tokens, docs):
    assert list_titles(client, tokens["a"], "?q=radar") == ["Alpha Radar"]


@pytest.mark.parametrize(
    "query",
    ["?scope=everything", "?limit=0", "?limit=1000", "?page=0", "?order=sideways", "?sort=password_hash"],
)
def test_invalid_list_params_are_400(client, tokens, query):
    response = client.get(f"/api/documents{query}", headers=tokens["a"])

    assert response.status_code == 400


# ---- details ----

def test_details_for_owner_include_ocr_text(client, tokens, docs):
    response = client.get(f"/api/documents/{docs['a_fin']}", headers=tokens["a"])

    body = response.get_json()
    assert body["can_download"] is True
    assert body["access_status"] == "owner"
    assert SECRET_PHRASE in body["ocr_text"]
    assert body["can_request_access"] is False


def test_details_for_other_division_hide_ocr_text(client, tokens, docs):
    response = client.get(f"/api/documents/{docs['a_fin']}", headers=tokens["b"])

    assert response.status_code == 200
    body = response.get_json()
    assert body["can_download"] is False
    assert body["access_status"] == "none"
    assert body["can_request_access"] is True
    assert "ocr_text" not in body
    assert SECRET_PHRASE not in response.get_data(as_text=True)


def test_details_for_super_admin(client, tokens, docs):
    body = client.get(f"/api/documents/{docs['a_fin']}", headers=tokens["admin"]).get_json()

    assert body["access_status"] == "admin"
    assert body["can_download"] is True
    assert SECRET_PHRASE in body["ocr_text"]


@pytest.mark.parametrize("doc_id", ["not-an-id", "6560f0f0f0f0f0f0f0f0f0f0"])
def test_details_unknown_document_is_404(client, tokens, doc_id):
    response = client.get(f"/api/documents/{doc_id}", headers=tokens["a"])

    assert response.status_code == 404
    assert response.get_json()["error"] == "document_not_found"


# ---- download / preview ----

def test_owner_can_download(client, tokens, docs):
    response = client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["a"])

    assert response.status_code == 200
    assert response.data.startswith(b"%PDF")
    assert response.mimetype == "application/pdf"
    assert response.headers["Content-Disposition"].startswith("attachment")
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_download_returns_the_exact_bytes(client, upload, tokens):
    original = text_pdf("byte for byte")
    doc_id = upload(original, filename="exact.pdf", headers=tokens["a"]).get_json()["id"]

    response = client.get(f"/api/documents/{doc_id}/download", headers=tokens["a"])

    assert response.data == original
    assert int(response.headers["Content-Length"]) == len(original)
    assert "exact.pdf" in response.headers["Content-Disposition"]


def test_preview_is_inline(client, tokens, docs):
    response = client.get(f"/api/documents/{docs['a_fin']}/preview", headers=tokens["a"])

    assert response.status_code == 200
    assert response.headers["Content-Disposition"].startswith("inline")


def test_division_b_user_gets_403_on_division_a_download(client, tokens, docs):
    response = client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["b"])

    assert response.status_code == 403
    body = response.get_json()
    assert body["error"] == "access_denied"
    assert body["access_status"] == "none"
    assert body["can_request_access"] is True


def test_division_b_user_gets_403_on_division_a_preview(client, tokens, docs):
    assert client.get(f"/api/documents/{docs['a_fin']}/preview", headers=tokens["b"]).status_code == 403


def test_download_requires_login(client, docs):
    assert client.get(f"/api/documents/{docs['a_fin']}/download").status_code == 401


def test_super_admin_can_download_any_division(client, tokens, docs):
    assert client.get(f"/api/documents/{docs['b_fin']}/download", headers=tokens["admin"]).status_code == 200


def test_approved_access_allows_download_and_listing(client, tokens, docs, db):
    grant(db, "bravo@example.com", docs["a_fin"])

    download = client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["b"])
    details = client.get(f"/api/documents/{docs['a_fin']}", headers=tokens["b"]).get_json()

    assert download.status_code == 200
    assert details["access_status"] == "approved"
    assert SECRET_PHRASE in details["ocr_text"]
    assert list_titles(client, tokens["b"]) == ["Alpha Budget", "Bravo Budget"]


def test_approval_for_one_document_does_not_open_others(client, tokens, docs, db):
    grant(db, "bravo@example.com", docs["a_fin"])

    assert client.get(f"/api/documents/{docs['a_ops']}/download", headers=tokens["b"]).status_code == 403


def test_approval_with_future_expiry_still_works(client, tokens, docs, db):
    grant(db, "bravo@example.com", docs["a_fin"], expires_at=utcnow() + timedelta(days=7))

    details = client.get(f"/api/documents/{docs['a_fin']}", headers=tokens["b"]).get_json()

    assert details["access_status"] == "approved"
    assert details["access_expires_at"] is not None


@pytest.mark.parametrize(
    ("status", "expires_at", "expected"),
    [
        ("approved", utcnow() - timedelta(minutes=1), "expired"),
        ("revoked", None, "revoked"),
        ("pending", None, "pending"),
        ("rejected", None, "rejected"),
    ],
)
def test_non_active_requests_do_not_grant_access(client, tokens, docs, db, status, expires_at, expected):
    grant(db, "bravo@example.com", docs["a_fin"], status=status, expires_at=expires_at)

    download = client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["b"])

    assert download.status_code == 403
    assert download.get_json()["access_status"] == expected
    assert list_titles(client, tokens["b"]) == ["Bravo Budget"]


def test_downloads_and_denials_are_audited(client, tokens, docs, db):
    client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["a"])
    client.get(f"/api/documents/{docs['a_fin']}/preview", headers=tokens["a"])
    client.get(f"/api/documents/{docs['a_fin']}/download", headers=tokens["b"])

    actions = {(e["action"], e["actor_name"]) for e in db.audit_logs.find({"target_type": "document"})}
    assert ("document.download", "Alpha User") in actions
    assert ("document.preview", "Alpha User") in actions
    assert ("document.download_denied", "Bravo User") in actions
