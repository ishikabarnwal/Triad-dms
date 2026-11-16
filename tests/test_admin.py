"""Admin tests: metadata fields, divisions, users, audit log, and the public catalog endpoints."""

from datetime import date, timedelta

import pytest

from app.db import METADATA_INDEX_PREFIX
from app.seed import run_seed
from tests.samples import FAKE_PDF, text_pdf


@pytest.fixture
def api(client, tokens):
    """Small helpers for calling admin endpoints as the super admin."""

    class Api:
        @staticmethod
        def get(path, headers=None):
            return client.get(f"/api/admin{path}", headers=headers or tokens["admin"])

        @staticmethod
        def send(method, path, body=None, headers=None):
            return getattr(client, method)(f"/api/admin{path}", json=body or {}, headers=headers or tokens["admin"])

        @staticmethod
        def field(key):
            fields = client.get("/api/admin/metadata-fields", headers=tokens["admin"]).get_json()["fields"]
            return next(field for field in fields if field["key"] == key)

        @staticmethod
        def division(name):
            divisions = client.get("/api/admin/divisions", headers=tokens["admin"]).get_json()["divisions"]
            return next(division for division in divisions if division["name"] == name)

    return Api


def document_index_names(db):
    """Names of the per-field filter indexes on documents."""
    return {name for name in db.documents.index_information() if name.startswith(METADATA_INDEX_PREFIX)}


# ---- access control ----

ADMIN_ROUTES = [
    ("get", "/metadata-fields"),
    ("post", "/metadata-fields"),
    ("put", "/metadata-fields/reorder"),
    ("put", "/metadata-fields/6560f0f0f0f0f0f0f0f0f0f0"),
    ("delete", "/metadata-fields/6560f0f0f0f0f0f0f0f0f0f0"),
    ("get", "/divisions"),
    ("post", "/divisions"),
    ("put", "/divisions/6560f0f0f0f0f0f0f0f0f0f0"),
    ("delete", "/divisions/6560f0f0f0f0f0f0f0f0f0f0"),
    ("get", "/users"),
    ("put", "/users/6560f0f0f0f0f0f0f0f0f0f0"),
    ("get", "/audit-logs"),
]


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_members_get_403_on_admin_routes(api, tokens, method, path):
    response = api.send(method, path, headers=tokens["a"])

    assert response.status_code == 403
    assert response.get_json()["error"] == "admin_only"


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_routes_need_login(client, method, path):
    assert getattr(client, method)(f"/api/admin{path}", json={}).status_code == 401


# ---- metadata fields ----

def test_list_fields_includes_usage_counts(api, upload, tokens):
    upload(FAKE_PDF, metadata={"Report Type": "Financial"}, headers=tokens["a"])

    report_type = api.field("Report Type")

    assert report_type["usage_count"] == 1
    assert api.field("Classification")["usage_count"] == 0


def test_create_text_field_is_usable_immediately(api, client, upload, tokens, db):
    response = api.send("post", "/metadata-fields", {"key": "Project Code", "type": "text", "required": True})

    assert response.status_code == 201
    body = response.get_json()
    assert body["label"] == "Project Code"
    assert body["order"] == 5
    assert f"{METADATA_INDEX_PREFIX}Project Code" in document_index_names(db)
    keys = [f["key"] for f in client.get("/api/metadata-fields", headers=tokens["a"]).get_json()["fields"]]
    assert keys[-1] == "Project Code"
    missing = upload(FAKE_PDF, metadata={}, headers=tokens["a"])
    assert missing.status_code == 400
    assert missing.get_json()["details"][0]["field"] == "Project Code"


def test_create_select_field_tidies_options(api):
    response = api.send("post", "/metadata-fields",
                        {"key": "Theatre", "type": "select", "options": [" North ", "south", "North", "", "East"]})

    assert response.get_json()["options"] == ["North", "south", "East"]


def test_select_field_needs_options(api):
    response = api.send("post", "/metadata-fields", {"key": "Theatre", "type": "select", "options": []})

    assert response.status_code == 400
    assert response.get_json()["error"] == "options_required"


@pytest.mark.parametrize("key", ["page", "q", "scope", "division", "date_from", "ocr_status", "a.b", "$set", "   "])
def test_unsafe_or_reserved_keys_are_blocked(api, key):
    response = api.send("post", "/metadata-fields", {"key": key})

    assert response.status_code == 400


@pytest.mark.parametrize("key", ["Report Type", "report type", "REPORT TYPE"])
def test_duplicate_keys_are_409(api, key):
    response = api.send("post", "/metadata-fields", {"key": key})

    assert response.status_code == 409
    assert response.get_json()["error"] == "field_exists"


def test_invalid_field_type_is_400(api):
    assert api.send("post", "/metadata-fields", {"key": "Thing", "type": "colour"}).status_code == 400


def test_update_label_and_flags(api, db):
    field_id = api.field("Classification")["id"]

    response = api.send("put", f"/metadata-fields/{field_id}",
                        {"label": "Security Classification", "filterable": False, "required": True})

    body = response.get_json()
    assert response.status_code == 200
    assert (body["label"], body["filterable"], body["required"]) == ("Security Classification", False, True)
    assert f"{METADATA_INDEX_PREFIX}Classification" not in document_index_names(db)


def test_rename_unused_key_moves_its_index(api, db):
    field_id = api.field("Reference Number")["id"]
    api.send("put", f"/metadata-fields/{field_id}", {"filterable": True})

    response = api.send("put", f"/metadata-fields/{field_id}", {"key": "File Number"})

    assert response.status_code == 200
    assert response.get_json()["key"] == "File Number"
    names = document_index_names(db)
    assert f"{METADATA_INDEX_PREFIX}File Number" in names
    assert f"{METADATA_INDEX_PREFIX}Reference Number" not in names


def test_key_of_used_field_cannot_change(api, upload, tokens):
    upload(FAKE_PDF, metadata={"Report Type": "Financial"}, headers=tokens["a"])
    field_id = api.field("Report Type")["id"]

    response = api.send("put", f"/metadata-fields/{field_id}", {"key": "Kind"})

    assert response.status_code == 409
    assert response.get_json()["error"] == "field_in_use"
    assert response.get_json()["usage_count"] == 1


def test_type_of_used_field_cannot_change(api, upload, tokens):
    upload(FAKE_PDF, metadata={"Report Type": "Financial"}, headers=tokens["a"])
    field_id = api.field("Report Type")["id"]

    assert api.send("put", f"/metadata-fields/{field_id}", {"type": "text"}).status_code == 409


def test_options_of_used_field_can_change(api, upload, tokens):
    upload(FAKE_PDF, metadata={"Report Type": "Financial"}, headers=tokens["a"])
    field_id = api.field("Report Type")["id"]

    response = api.send("put", f"/metadata-fields/{field_id}", {"options": ["Financial", "Logistics"]})

    assert response.get_json()["options"] == ["Financial", "Logistics"]


def test_rename_to_existing_key_is_409(api):
    field_id = api.field("Reference Number")["id"]

    assert api.send("put", f"/metadata-fields/{field_id}", {"key": "classification"}).status_code == 409


def test_division_field_is_locked(api):
    field_id = api.field("Division")["id"]

    assert api.send("delete", f"/metadata-fields/{field_id}").status_code == 400
    for change in ({"key": "Unit"}, {"type": "text"}, {"required": False}, {"active": False}):
        response = api.send("put", f"/metadata-fields/{field_id}", change)
        assert response.status_code == 400
        assert response.get_json()["error"] == "field_locked"
    assert api.send("put", f"/metadata-fields/{field_id}", {"label": "Owning Unit"}).status_code == 200


def test_delete_is_soft_and_documents_keep_values(api, client, upload, tokens, db):
    doc_id = upload(FAKE_PDF, metadata={"Classification": "SECRET"}, headers=tokens["a"]).get_json()["id"]
    field_id = api.field("Classification")["id"]

    response = api.send("delete", f"/metadata-fields/{field_id}")

    assert response.status_code == 200
    assert response.get_json()["active"] is False
    assert db.metadata_fields.find_one({"key": "Classification"}) is not None
    assert f"{METADATA_INDEX_PREFIX}Classification" not in document_index_names(db)
    keys = [f["key"] for f in client.get("/api/metadata-fields", headers=tokens["a"]).get_json()["fields"]]
    assert "Classification" not in keys
    details = client.get(f"/api/documents/{doc_id}", headers=tokens["a"]).get_json()
    assert details["metadata"]["Classification"] == "SECRET"


def test_deleted_field_can_be_restored(api, db):
    field_id = api.field("Classification")["id"]
    api.send("delete", f"/metadata-fields/{field_id}")

    duplicate = api.send("post", "/metadata-fields", {"key": "Classification"})
    restored = api.send("put", f"/metadata-fields/{field_id}", {"active": True})

    assert duplicate.status_code == 409
    assert "restore" in duplicate.get_json()["message"]
    assert restored.get_json()["active"] is True
    assert f"{METADATA_INDEX_PREFIX}Classification" in document_index_names(db)


def test_reorder_fields(api, client, tokens):
    ids = {field["key"]: field["id"] for field in api.get("/metadata-fields").get_json()["fields"]}

    response = api.send("put", "/metadata-fields/reorder", {"ids": [ids["Classification"], ids["Report Type"]]})

    assert response.status_code == 200
    keys = [f["key"] for f in client.get("/api/metadata-fields", headers=tokens["a"]).get_json()["fields"]]
    assert keys == ["Classification", "Report Type", "Division", "Document Date", "Reference Number"]


@pytest.mark.parametrize("ids", [["6560f0f0f0f0f0f0f0f0f0f0"], ["bad"], []])
def test_reorder_rejects_bad_ids(api, ids):
    assert api.send("put", "/metadata-fields/reorder", {"ids": ids}).status_code == 400


def test_unknown_field_is_404(api):
    assert api.send("put", "/metadata-fields/6560f0f0f0f0f0f0f0f0f0f0", {"label": "x"}).status_code == 404


def test_field_changes_are_audited(api, db):
    created = api.send("post", "/metadata-fields", {"key": "Theatre"}).get_json()
    api.send("put", f"/metadata-fields/{created['id']}", {"label": "Theatre of Ops"})
    api.send("delete", f"/metadata-fields/{created['id']}")

    actions = [e["action"] for e in db.audit_logs.find({"target_type": "metadata_field"}).sort("created_at", 1)]
    assert actions == ["admin.field_create", "admin.field_update", "admin.field_delete"]


# ---- divisions ----

def test_list_divisions_with_counts(api, upload, tokens):
    upload(FAKE_PDF, headers=tokens["a"])

    division_a = api.division("Division A")

    assert division_a["user_count"] == 1
    assert division_a["document_count"] == 1


def test_create_division_appears_publicly_and_accepts_signups(api, client, register):
    response = api.send("post", "/divisions", {"name": "Signals Wing", "code": "sig-w", "description": "Comms"})

    assert response.status_code == 201
    assert response.get_json()["code"] == "SIG-W"
    public = [d["name"] for d in client.get("/api/divisions").get_json()["divisions"]]
    assert "Signals Wing" in public
    assert register(email="new@example.com", division="SIG-W").status_code == 201


@pytest.mark.parametrize("body", [{"name": "division a"}, {"name": "New One", "code": "DIV-A"}, {"name": "X", "code": "hq"}])
def test_duplicate_division_name_or_code_is_409(api, body):
    response = api.send("post", "/divisions", body)

    assert response.status_code == 409
    assert response.get_json()["error"] == "division_exists"


def test_rename_division_cascades_everywhere(api, client, upload, tokens, db):
    doc_id = upload(text_pdf("x"), title="Alpha Doc", headers=tokens["a"]).get_json()["id"]
    request_id = client.post("/api/access/request", json={"doc_id": doc_id}, headers=tokens["b"]).get_json()["id"]
    division_id = api.division("Division A")["id"]

    response = api.send("put", f"/divisions/{division_id}", {"name": "Northern Command"})

    assert response.status_code == 200
    assert client.get("/api/auth/me", headers=tokens["a"]).get_json()["user"]["division"] == "Northern Command"
    document = client.get(f"/api/documents/{doc_id}", headers=tokens["a"]).get_json()
    assert document["division"] == "Northern Command"
    assert document["metadata"]["Division"] == "Northern Command"
    assert document["can_download"] is True
    inbox = client.get("/api/access/inbox", headers=tokens["a"]).get_json()["requests"]
    assert [r["id"] for r in inbox] == [request_id]
    assert "Northern Command" in db.documents.find_one()["search_blob"]
    listed = client.get("/api/documents?Division=Northern Command", headers=tokens["a"]).get_json()
    assert listed["total"] == 1


def test_division_in_use_cannot_be_deleted(api, upload, tokens):
    upload(FAKE_PDF, headers=tokens["a"])
    division_id = api.division("Division A")["id"]

    response = api.send("delete", f"/divisions/{division_id}")

    assert response.status_code == 409
    body = response.get_json()
    assert body["error"] == "division_in_use"
    assert (body["user_count"], body["document_count"]) == (1, 1)


def test_empty_division_can_be_deleted(api, client):
    division_id = api.send("post", "/divisions", {"name": "Temporary"}).get_json()["id"]

    assert api.send("delete", f"/divisions/{division_id}").status_code == 200
    assert "Temporary" not in [d["name"] for d in client.get("/api/divisions").get_json()["divisions"]]


def test_unknown_division_is_404(api):
    assert api.send("delete", "/divisions/6560f0f0f0f0f0f0f0f0f0f0").status_code == 404


def test_reseed_does_not_bring_back_renamed_divisions_or_fields(app, api, db):
    api.send("put", f"/divisions/{api.division('Division B')['id']}", {"name": "Research Wing"})
    api.send("put", f"/metadata-fields/{api.field('Reference Number')['id']}", {"key": "File Number"})

    run_seed(db, app.config)

    names = {d["name"] for d in db.divisions.find()}
    assert "Division B" not in names and "Research Wing" in names
    assert db.metadata_fields.count_documents({"key": "Reference Number"}) == 0


# ---- users ----

def test_list_and_filter_users(api):
    everyone = api.get("/users").get_json()
    bravo = api.get("/users?q=bravo").get_json()
    division_a = api.get("/users?division=div-a").get_json()
    admins = api.get("/users?role=admin").get_json()

    assert everyone["total"] == 3
    assert [u["name"] for u in bravo["users"]] == ["Bravo User"]
    assert [u["name"] for u in division_a["users"]] == ["Alpha User"]
    assert [u["role"] for u in admins["users"]] == ["admin"]
    assert "password_hash" not in str(everyone)


def test_change_user_division_and_role(api, client, tokens, upload):
    bravo = api.get("/users?q=bravo").get_json()["users"][0]
    doc_id = upload(FAKE_PDF, headers=tokens["a"]).get_json()["id"]

    moved = api.send("put", f"/users/{bravo['id']}", {"division": "Division A"})
    promoted = api.send("put", f"/users/{bravo['id']}", {"role": "admin"})

    assert moved.get_json()["division"] == "Division A"
    assert promoted.get_json()["role"] == "admin"
    assert client.get(f"/api/documents/{doc_id}/download", headers=tokens["b"]).status_code == 200
    assert client.get("/api/admin/users", headers=tokens["b"]).status_code == 200


def test_admin_cannot_demote_themselves(api):
    me = api.get("/users?role=admin").get_json()["users"][0]

    response = api.send("put", f"/users/{me['id']}", {"role": "member"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "cannot_demote_self"


def test_user_update_validation(api):
    bravo = api.get("/users?q=bravo").get_json()["users"][0]

    assert api.send("put", f"/users/{bravo['id']}", {"division": "Nowhere"}).status_code == 400
    assert api.send("put", f"/users/{bravo['id']}", {"role": "god"}).status_code == 400
    assert api.send("put", "/users/6560f0f0f0f0f0f0f0f0f0f0", {"role": "admin"}).status_code == 404


def test_user_changes_are_audited(api, db):
    bravo = api.get("/users?q=bravo").get_json()["users"][0]
    api.send("put", f"/users/{bravo['id']}", {"division": "Division A"})

    entry = db.audit_logs.find_one({"action": "admin.user_update"})
    assert entry["details"]["before"] == {"division": "Division B"}
    assert entry["details"]["after"] == {"division": "Division A"}


# ---- audit log ----

def test_audit_log_is_newest_first_and_filterable(api, client, upload, tokens):
    doc_id = upload(FAKE_PDF, headers=tokens["a"]).get_json()["id"]
    client.get(f"/api/documents/{doc_id}/download", headers=tokens["b"])
    client.post("/api/auth/login", json={"email": "alpha@example.com", "password": "wrong"})

    everything = api.get("/audit-logs").get_json()
    downloads = api.get("/audit-logs?action=document.download").get_json()
    auth = api.get("/audit-logs?action=auth").get_json()
    by_actor = api.get("/audit-logs?actor=bravo").get_json()
    by_division = api.get("/audit-logs?division=division a").get_json()

    times = [entry["created_at"] for entry in everything["logs"]]
    assert times == sorted(times, reverse=True)
    assert [e["action"] for e in downloads["logs"]] == ["document.download_denied"]
    assert {e["action"] for e in auth["logs"]} >= {"auth.register", "auth.login", "auth.login_failed"}
    assert {e["actor_name"] for e in by_actor["logs"]} == {"Bravo User"}
    assert all(e["division"] == "Division A" for e in by_division["logs"])


def test_audit_log_by_actor_id_and_dates(api, tokens):
    bravo = api.get("/users?q=bravo").get_json()["users"][0]
    today, tomorrow = date.today(), date.today() + timedelta(days=1)

    by_id = api.get(f"/audit-logs?actor={bravo['id']}").get_json()
    today_logs = api.get(f"/audit-logs?date_from={today}&date_to={today}").get_json()
    future = api.get(f"/audit-logs?date_from={tomorrow}").get_json()

    assert by_id["total"] >= 1 and {e["actor_id"] for e in by_id["logs"]} == {bravo["id"]}
    assert today_logs["total"] == api.get("/audit-logs").get_json()["total"]
    assert future["total"] == 0


def test_audit_log_pagination(api):
    first = api.get("/audit-logs?limit=2&page=1").get_json()
    second = api.get("/audit-logs?limit=2&page=2").get_json()

    assert len(first["logs"]) == 2
    assert {e["id"] for e in first["logs"]}.isdisjoint({e["id"] for e in second["logs"]})


# ---- catalog ----

def test_metadata_fields_endpoint_needs_login(client):
    assert client.get("/api/metadata-fields").status_code == 401


def test_metadata_fields_endpoint_lists_active_fields_in_order(client, tokens):
    fields = client.get("/api/metadata-fields", headers=tokens["a"]).get_json()["fields"]

    assert [f["key"] for f in fields] == ["Division", "Report Type", "Classification", "Document Date",
                                          "Reference Number"]
    division = fields[0]
    assert division["options"] == ["Division A", "Division B", "Headquarters"]
    assert "usage_count" not in division


def test_divisions_endpoint_is_public(client):
    response = client.get("/api/divisions")

    assert response.status_code == 200
    assert [d["name"] for d in response.get_json()["divisions"]] == ["Division A", "Division B", "Headquarters"]
    assert "user_count" not in response.get_json()["divisions"][0]
