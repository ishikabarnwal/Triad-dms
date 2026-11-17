"""Access request tests: the full request -> approve -> revoke flow, expiry and every decision rule."""

from datetime import datetime, timedelta

import pytest
from bson import ObjectId

from app.utils import utcnow
from tests.samples import text_pdf


@pytest.fixture
def doc_a(upload, tokens):
    """A Division A document id."""
    response = upload(text_pdf("Division A logistics plan"), title="Alpha Plan", headers=tokens["a"])
    return response.get_json()["id"]


@pytest.fixture
def doc_b(upload, tokens):
    """A Division B document id."""
    response = upload(text_pdf("Division B research notes"), title="Bravo Notes", headers=tokens["b"])
    return response.get_json()["id"]


@pytest.fixture
def more_users(register, auth_header):
    """A second Division B user and a second Division A user."""
    return {
        "b2": auth_header(register(name="Charlie B", email="charlie@example.com", division="Division B")),
        "a2": auth_header(register(name="Delta A", email="delta@example.com", division="Division A")),
    }


@pytest.fixture
def access(client):
    """Helpers that call the access endpoints."""

    class Access:
        @staticmethod
        def request(headers, doc_id, reason="Needed for joint exercise planning"):
            return client.post("/api/access/request", json={"doc_id": doc_id, "reason": reason}, headers=headers)

        @staticmethod
        def decide(action, headers, request_id, **body):
            return client.post(f"/api/access/{action}", json={"request_id": request_id, **body}, headers=headers)

        @staticmethod
        def download_status(headers, doc_id):
            return client.get(f"/api/documents/{doc_id}/download", headers=headers).status_code

        @staticmethod
        def details(headers, doc_id):
            return client.get(f"/api/documents/{doc_id}", headers=headers).get_json()

        @staticmethod
        def listing(path, headers, query=""):
            response = client.get(f"/api/access/{path}{query}", headers=headers)
            assert response.status_code == 200, response.get_json()
            return response.get_json()

    return Access


def expire(db, request_id):
    """Move an approval's expiry into the past, as if the days had gone by."""
    db.access_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"expires_at": utcnow() - timedelta(seconds=1)}},
    )


# ---- the full flow ----

def test_full_request_approve_revoke_flow(access, tokens, doc_a):
    assert access.download_status(tokens["b"], doc_a) == 403

    created = access.request(tokens["b"], doc_a)
    assert created.status_code == 201
    request_id = created.get_json()["request_id"]
    assert access.download_status(tokens["b"], doc_a) == 403
    assert access.details(tokens["b"], doc_a)["access_status"] == "pending"

    inbox = access.listing("inbox", tokens["a"])
    assert [r["id"] for r in inbox["requests"]] == [request_id]
    assert access.listing("pending-count", tokens["a"])["count"] == 1

    approved = access.decide("approve", tokens["a"], request_id)
    assert approved.status_code == 200
    assert approved.get_json()["status"] == "approved"
    assert approved.get_json()["decided_by_name"] == "Alpha User"
    assert access.download_status(tokens["b"], doc_a) == 200
    assert access.details(tokens["b"], doc_a)["can_download"] is True
    assert access.listing("pending-count", tokens["a"])["count"] == 0

    revoked = access.decide("revoke", tokens["a"], request_id, note="Exercise finished")
    assert revoked.status_code == 200
    assert revoked.get_json()["status"] == "revoked"
    assert revoked.get_json()["revoke_note"] == "Exercise finished"
    assert access.download_status(tokens["b"], doc_a) == 403
    assert access.details(tokens["b"], doc_a)["access_status"] == "revoked"

    again = access.request(tokens["b"], doc_a)
    assert again.status_code == 201
    assert again.get_json()["id"] != request_id


def test_request_response_shape(access, tokens, doc_a):
    body = access.request(tokens["b"], doc_a, reason="  Joint audit  ").get_json()

    assert body["id"] == body["request_id"]
    assert body["doc_id"] == body["document_id"] == doc_a
    assert body["document_title"] == "Alpha Plan"
    assert body["requester_name"] == "Bravo User"
    assert body["requester_division"] == "Division B"
    assert body["owner_division"] == "Division A"
    assert body["reason"] == "Joint audit"
    assert body["status"] == "pending"
    assert body["created_at"] and body["decided_at"] is None and body["expires_at"] is None


def test_request_accepts_document_id_alias_and_no_reason(client, tokens, doc_a):
    response = client.post("/api/access/request", json={"document_id": doc_a}, headers=tokens["b"])

    assert response.status_code == 201
    assert response.get_json()["reason"] is None


# ---- request rules ----

@pytest.mark.parametrize("doc_id", ["not-an-id", "6560f0f0f0f0f0f0f0f0f0f0"])
def test_request_for_unknown_document_is_404(access, tokens, doc_id):
    response = access.request(tokens["b"], doc_id)

    assert response.status_code == 404
    assert response.get_json()["error"] == "document_not_found"


def test_request_without_doc_id_is_400(client, tokens):
    response = client.post("/api/access/request", json={"reason": "x"}, headers=tokens["b"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "validation_error"


@pytest.mark.parametrize("who", ["a", "admin"])
def test_request_when_already_having_access_is_400(access, tokens, doc_a, who):
    response = access.request(tokens[who], doc_a)

    assert response.status_code == 400
    assert response.get_json()["error"] == "already_has_access"


def test_request_while_approved_is_400(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id)

    response = access.request(tokens["b"], doc_a)

    assert response.status_code == 400
    assert response.get_json()["access_status"] == "approved"


def test_duplicate_pending_request_is_409_with_existing(access, tokens, doc_a, db):
    first = access.request(tokens["b"], doc_a).get_json()

    second = access.request(tokens["b"], doc_a)

    assert second.status_code == 409
    body = second.get_json()
    assert body["error"] == "request_pending"
    assert body["request_id"] == body["id"] == first["id"]
    assert body["request"]["status"] == "pending"
    assert db.access_requests.count_documents({}) == 1


def test_different_users_can_each_request(access, tokens, more_users, doc_a):
    assert access.request(tokens["b"], doc_a).status_code == 201
    assert access.request(more_users["b2"], doc_a).status_code == 201


def test_can_request_again_after_rejection(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("reject", tokens["a"], request_id)

    assert access.request(tokens["b"], doc_a).status_code == 201


def test_can_request_again_after_expiry(access, tokens, doc_a, db):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id, expires_in_days=7)
    expire(db, request_id)

    assert access.request(tokens["b"], doc_a).status_code == 201


# ---- approve ----

def test_any_member_of_owning_division_can_approve(access, tokens, more_users, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    response = access.decide("approve", more_users["a2"], request_id)

    assert response.status_code == 200
    assert response.get_json()["decided_by_name"] == "Delta A"


def test_super_admin_can_approve(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    assert access.decide("approve", tokens["admin"], request_id).status_code == 200


def test_wrong_division_cannot_approve(access, tokens, more_users, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    response = access.decide("approve", more_users["b2"], request_id)

    assert response.status_code == 403
    assert response.get_json()["error"] == "not_allowed"
    assert access.download_status(tokens["b"], doc_a) == 403


def test_requester_cannot_approve_own_request(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    response = access.decide("approve", tokens["b"], request_id)

    assert response.status_code == 403
    assert response.get_json()["error"] == "own_request"


def test_self_approval_blocked_even_after_moving_into_owning_division(access, tokens, doc_a, db):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    db.users.update_one({"email": "bravo@example.com"}, {"$set": {"division": "Division A"}})

    response = access.decide("approve", tokens["b"], request_id)

    assert response.status_code == 403
    assert response.get_json()["error"] == "own_request"


def test_approve_with_expiry(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    body = access.decide("approve", tokens["a"], request_id, expires_in_days=7).get_json()

    expires_at = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=6, hours=23) < expires_at - utcnow() <= timedelta(days=7)
    assert access.download_status(tokens["b"], doc_a) == 200


def test_approve_without_expiry_never_expires(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    body = access.decide("approve", tokens["a"], request_id, expires_in_days=None).get_json()

    assert body["expires_at"] is None


@pytest.mark.parametrize("days", [0, -1, 1000, "soon"])
def test_invalid_expiry_is_400(access, tokens, doc_a, days):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    response = access.decide("approve", tokens["a"], request_id, expires_in_days=days)

    assert response.status_code == 400
    assert response.get_json()["details"][0]["field"] == "expires_in_days"


def test_expired_access_is_denied_and_shown_as_expired(access, tokens, doc_a, db):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id, expires_in_days=30)
    expire(db, request_id)

    assert access.download_status(tokens["b"], doc_a) == 403
    assert access.details(tokens["b"], doc_a)["access_status"] == "expired"
    mine = access.listing("mine", tokens["b"])["requests"]
    assert mine[0]["status"] == "expired"
    assert [r["id"] for r in access.listing("inbox", tokens["a"], "?status=expired")["requests"]] == [request_id]
    assert access.listing("inbox", tokens["a"], "?status=approved")["requests"] == []


# ---- double decisions ----

@pytest.mark.parametrize(
    ("first", "second"),
    [("approve", "approve"), ("approve", "reject"), ("reject", "approve"), ("reject", "reject")],
)
def test_requests_cannot_be_decided_twice(access, tokens, doc_a, first, second):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide(first, tokens["a"], request_id)

    response = access.decide(second, tokens["a"], request_id)

    assert response.status_code == 409
    assert response.get_json()["error"] == "already_decided"


def test_revoked_request_cannot_be_approved_again(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id)
    access.decide("revoke", tokens["a"], request_id)

    assert access.decide("approve", tokens["a"], request_id).status_code == 409
    assert access.download_status(tokens["b"], doc_a) == 403


# ---- reject ----

def test_reject_with_note(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    body = access.decide("reject", tokens["a"], request_id, note="Not cleared for this material").get_json()

    assert body["status"] == "rejected"
    assert body["decision_note"] == "Not cleared for this material"
    assert body["decided_at"] is not None
    assert access.download_status(tokens["b"], doc_a) == 403
    assert access.details(tokens["b"], doc_a)["access_status"] == "rejected"


def test_wrong_division_cannot_reject(access, tokens, more_users, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]

    assert access.decide("reject", more_users["b2"], request_id).status_code == 403


# ---- revoke ----

@pytest.mark.parametrize("state", ["pending", "rejected", "expired"])
def test_only_active_approvals_can_be_revoked(access, tokens, doc_a, db, state):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    if state == "rejected":
        access.decide("reject", tokens["a"], request_id)
    if state == "expired":
        access.decide("approve", tokens["a"], request_id, expires_in_days=1)
        expire(db, request_id)

    response = access.decide("revoke", tokens["a"], request_id)

    assert response.status_code == 409
    assert response.get_json()["error"] == "not_active"
    assert response.get_json()["status"] == state


def test_wrong_division_cannot_revoke(access, tokens, more_users, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id)

    assert access.decide("revoke", more_users["b2"], request_id).status_code == 403
    assert access.decide("revoke", tokens["b"], request_id).status_code == 403
    assert access.download_status(tokens["b"], doc_a) == 200


def test_super_admin_can_revoke(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], request_id)

    assert access.decide("revoke", tokens["admin"], request_id).status_code == 200
    assert access.download_status(tokens["b"], doc_a) == 403


@pytest.mark.parametrize("action", ["approve", "reject", "revoke"])
@pytest.mark.parametrize("request_id", ["nope", "6560f0f0f0f0f0f0f0f0f0f0"])
def test_unknown_request_is_404(access, tokens, action, request_id):
    response = access.decide(action, tokens["a"], request_id)

    assert response.status_code == 404
    assert response.get_json()["error"] == "request_not_found"


@pytest.mark.parametrize("action", ["approve", "reject", "revoke"])
def test_missing_request_id_is_400(client, tokens, action):
    assert client.post(f"/api/access/{action}", json={}, headers=tokens["a"]).status_code == 400


# ---- inbox / mine / pending-count ----

def test_inbox_only_shows_my_divisions_documents(access, tokens, more_users, doc_a, doc_b):
    access.request(tokens["b"], doc_a)
    access.request(tokens["a"], doc_b)

    a_inbox = access.listing("inbox", tokens["a"])["requests"]
    b_inbox = access.listing("inbox", more_users["b2"])["requests"]

    assert [r["document_title"] for r in a_inbox] == ["Alpha Plan"]
    assert [r["document_title"] for r in b_inbox] == ["Bravo Notes"]


def test_super_admin_inbox_shows_all_divisions(access, tokens, doc_a, doc_b):
    access.request(tokens["b"], doc_a)
    access.request(tokens["a"], doc_b)

    assert access.listing("inbox", tokens["admin"])["total"] == 2
    assert access.listing("pending-count", tokens["admin"])["count"] == 2


def test_inbox_status_filter_and_newest_first(access, tokens, more_users, doc_a):
    first = access.request(tokens["b"], doc_a).get_json()["id"]
    second = access.request(more_users["b2"], doc_a).get_json()["id"]
    access.decide("reject", tokens["a"], first)

    pending = access.listing("inbox", tokens["a"])
    rejected = access.listing("inbox", tokens["a"], "?status=rejected")
    everything = access.listing("inbox", tokens["a"], "?status=ALL")

    assert pending["status"] == "pending"
    assert [r["id"] for r in pending["requests"]] == [second]
    assert [r["id"] for r in rejected["requests"]] == [first]
    assert [r["id"] for r in everything["requests"]] == [second, first]


def test_inbox_can_be_narrowed_to_one_document(access, tokens, more_users, doc_a, upload):
    other = upload(text_pdf("Second Division A file"), title="Alpha Two", headers=tokens["a"]).get_json()["id"]
    first = access.request(tokens["b"], doc_a).get_json()["id"]
    access.request(tokens["b"], other)
    access.decide("reject", tokens["a"], first)

    history = access.listing("inbox", tokens["a"], f"?status=all&doc_id={doc_a}")

    assert [r["id"] for r in history["requests"]] == [first]
    assert history["requests"][0]["status"] == "rejected"


def test_inbox_document_filter_keeps_division_scope(access, tokens, more_users, doc_a):
    access.request(tokens["b"], doc_a)

    assert access.listing("inbox", more_users["b2"], f"?status=all&doc_id={doc_a}")["total"] == 0


def test_inbox_unknown_doc_id_matches_nothing(access, tokens, doc_a):
    access.request(tokens["b"], doc_a)

    assert access.listing("inbox", tokens["a"], "?status=all&doc_id=nope")["total"] == 0


def test_details_carry_latest_request_and_manage_flag(access, tokens, doc_a):
    request_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("reject", tokens["a"], request_id, note="Not needed for this exercise")

    requester = access.details(tokens["b"], doc_a)
    owner = access.details(tokens["a"], doc_a)
    admin = access.details(tokens["admin"], doc_a)

    assert requester["access_request"]["status"] == "rejected"
    assert requester["access_request"]["decision_note"] == "Not needed for this exercise"
    assert requester["access_request"]["created_at"]
    assert requester["can_manage_access"] is False
    assert owner["access_request"] is None
    assert owner["can_manage_access"] is True
    assert admin["can_manage_access"] is True


def test_super_admin_inbox_can_filter_by_division(access, tokens, doc_a, doc_b):
    access.request(tokens["b"], doc_a)
    access.request(tokens["a"], doc_b)

    only_a = access.listing("inbox", tokens["admin"], "?division=Division A")["requests"]

    assert [r["owner_division"] for r in only_a] == ["Division A"]


def test_member_inbox_ignores_division_param(access, tokens, doc_a, doc_b):
    access.request(tokens["b"], doc_a)
    access.request(tokens["a"], doc_b)

    a_inbox = access.listing("inbox", tokens["a"], "?division=Division B")["requests"]

    assert [r["owner_division"] for r in a_inbox] == ["Division A"]


def test_super_admin_inbox_unknown_division_is_400(client, tokens):
    assert client.get("/api/access/inbox?division=Nowhere", headers=tokens["admin"]).status_code == 400


def test_inbox_invalid_status_is_400(client, tokens):
    assert client.get("/api/access/inbox?status=maybe", headers=tokens["a"]).status_code == 400


def test_mine_shows_only_my_requests_with_live_status(access, tokens, more_users, doc_a, doc_b):
    approved_id = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], approved_id)
    access.request(more_users["b2"], doc_a)

    mine = access.listing("mine", tokens["b"])

    assert mine["total"] == 1
    assert mine["requests"][0]["status"] == "approved"
    assert mine["requests"][0]["decided_by_name"] == "Alpha User"


def test_pending_count_only_counts_pending_for_my_division(access, tokens, more_users, doc_a):
    first = access.request(tokens["b"], doc_a).get_json()["id"]
    access.request(more_users["b2"], doc_a)
    access.decide("approve", tokens["a"], first)

    assert access.listing("pending-count", tokens["a"])["count"] == 1
    assert access.listing("pending-count", tokens["b"])["count"] == 0


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/access/request"),
        ("post", "/api/access/approve"),
        ("post", "/api/access/reject"),
        ("post", "/api/access/revoke"),
        ("get", "/api/access/inbox"),
        ("get", "/api/access/mine"),
        ("get", "/api/access/pending-count"),
    ],
)
def test_access_endpoints_require_login(client, method, path):
    assert getattr(client, method)(path, json={}).status_code == 401


# ---- audit ----

def test_every_access_action_is_audited(access, tokens, doc_a, db):
    first = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("approve", tokens["a"], first, expires_in_days=7)
    access.decide("revoke", tokens["a"], first)
    second = access.request(tokens["b"], doc_a).get_json()["id"]
    access.decide("reject", tokens["a"], second, note="No")

    entries = list(db.audit_logs.find({"action": {"$regex": "^access\\."}}).sort("created_at", 1))
    assert [(e["action"], e["actor_name"]) for e in entries] == [
        ("access.request", "Bravo User"),
        ("access.approve", "Alpha User"),
        ("access.revoke", "Alpha User"),
        ("access.request", "Bravo User"),
        ("access.reject", "Alpha User"),
    ]
    assert all(e["division"] == "Division A" for e in entries)
    assert entries[1]["details"]["expires_in_days"] == 7
    assert entries[4]["details"]["note"] == "No"
