"""Auth tests: register, login, /me, rate limiting and the failed-login audit trail."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from tests.conftest import TEST_CONFIG


def login(client, password="secret123", **identifier):
    """POST /api/auth/login with the given identifier field(s)."""
    return client.post("/api/auth/login", json={**identifier, "password": password})


# ---- register ----

def test_register_returns_201_with_token_and_user(register):
    response = register()

    assert response.status_code == 201
    body = response.get_json()
    assert body["token"] and body["token"] == body["access_token"]
    assert body["token_type"] == "Bearer"
    user = body["user"]
    assert user["id"] == user["user_id"]
    assert user["email"] == "asha@example.com"
    assert user["division"] == "Division A"
    assert user["role"] == "member"
    assert "password_hash" not in user and "password" not in user


def test_register_stores_a_bcrypt_hash(register, db):
    register()

    stored = db.users.find_one({"email": "asha@example.com"})
    assert stored["password_hash"].startswith("$2")
    assert "secret123" not in stored["password_hash"]


def test_register_token_works_for_me(client, register, auth_header):
    response = register()

    me = client.get("/api/auth/me", headers=auth_header(response))

    assert me.status_code == 200
    assert me.get_json()["user"]["email"] == "asha@example.com"


def test_register_with_username_only(client, register):
    response = register(email=None, name=None, username="Ravi_K")

    assert response.status_code == 201
    user = response.get_json()["user"]
    assert user["username"] == "ravi_k"
    assert user["email"] is None
    assert user["name"] == "ravi_k"


def test_several_users_can_register_without_email(register):
    assert register(email=None, username="first_user").status_code == 201
    assert register(email=None, username="second_user").status_code == 201


def test_register_accepts_form_data(client):
    response = client.post(
        "/api/auth/register",
        data={"name": "Form User", "email": "form@example.com", "password": "secret123", "division": "Division B"},
    )

    assert response.status_code == 201


@pytest.mark.parametrize("division", ["division a", "DIVISION A", "DIV-A", "div-a"])
def test_register_matches_division_by_name_or_code_ignoring_case(register, division):
    response = register(division=division)

    assert response.status_code == 201
    assert response.get_json()["user"]["division"] == "Division A"


def test_register_unknown_division_lists_valid_ones(register):
    response = register(division="Division Z")

    assert response.status_code == 400
    body = response.get_json()
    assert body["error"] == "unknown_division"
    assert {"Division A", "Division B", "Headquarters"} <= set(body["divisions"])


def test_register_cannot_make_itself_admin(register):
    response = register(role="admin")

    assert response.get_json()["user"]["role"] == "member"


def test_register_lowercases_email(register):
    response = register(email="Asha.Verma@Example.COM")

    assert response.get_json()["user"]["email"] == "asha.verma@example.com"


def test_register_duplicate_email_is_409(register):
    register()

    response = register(email="ASHA@example.com", username="someone_else")

    assert response.status_code == 409
    assert response.get_json()["error"] == "email_taken"


def test_register_duplicate_username_is_409(register):
    register(username="asha")

    response = register(email="other@example.com", username="ASHA")

    assert response.status_code == 409
    assert response.get_json()["error"] == "username_taken"


@pytest.mark.parametrize(
    ("fields", "bad_field"),
    [
        ({"password": "123"}, "password"),
        ({"email": "not-an-email"}, "email"),
        ({"division": ""}, "division"),
        ({"division": None}, "division"),
        ({"password": None}, "password"),
        ({"username": "a b"}, "username"),
    ],
)
def test_register_validation_errors(register, fields, bad_field):
    response = register(**fields)

    assert response.status_code == 400
    body = response.get_json()
    assert body["error"] == "validation_error"
    assert bad_field in {detail["field"] for detail in body["details"]}


def test_register_needs_email_or_username(register):
    response = register(email=None)

    assert response.status_code == 400
    assert response.get_json()["message"] == "Provide an email or a username."


def test_register_rejects_non_object_json(client):
    response = client.post("/api/auth/register", data="[1, 2]", content_type="application/json")

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_json"


def test_register_is_audited(register, db):
    register()

    entry = db.audit_logs.find_one({"action": "auth.register"})
    assert entry["actor_name"] == "Asha Verma"
    assert entry["division"] == "Division A"


# ---- login ----

def test_login_with_email_returns_both_token_keys(client, register):
    register()

    response = login(client, email="asha@example.com")

    assert response.status_code == 200
    body = response.get_json()
    assert body["token"] == body["access_token"]
    assert body["user"]["email"] == "asha@example.com"


def test_login_email_is_case_insensitive(client, register):
    register()

    assert login(client, email="  ASHA@Example.com ").status_code == 200


def test_login_with_username(client, register):
    register(username="asha_v")

    assert login(client, username="Asha_V").status_code == 200


@pytest.mark.parametrize("identifier", ["asha_v", "asha@example.com"])
def test_login_accepts_username_in_email_field_and_identifier(client, register, identifier):
    register(username="asha_v")

    assert login(client, email=identifier).status_code == 200
    assert login(client, identifier=identifier).status_code == 200


def test_login_accepts_form_data(client, register):
    register()

    response = client.post("/api/auth/login", data={"email": "asha@example.com", "password": "secret123"})

    assert response.status_code == 200


def test_login_token_works_for_me(client, register, auth_header):
    register()

    me = client.get("/api/auth/me", headers=auth_header(login(client, email="asha@example.com")))

    assert me.status_code == 200
    assert me.get_json()["user"]["division"] == "Division A"


def test_seeded_admin_can_log_in(client):
    response = login(client, password="Admin@12345", username="admin")

    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "admin"
    assert response.get_json()["user"]["division"] == "Headquarters"


def test_login_wrong_password_is_401_and_audited(client, register, db):
    register()

    response = login(client, password="wrong-password", email="asha@example.com")

    assert response.status_code == 401
    assert response.get_json()["error"] == "invalid_credentials"
    entry = db.audit_logs.find_one({"action": "auth.login_failed"})
    assert entry["details"] == {"login_id": "asha@example.com", "reason": "wrong_password"}
    assert entry["actor_id"] is None
    assert entry["division"] == "Division A"
    assert entry["target_id"] == str(db.users.find_one({"email": "asha@example.com"})["_id"])


def test_login_unknown_user_gives_same_error_and_is_audited(client, register, db):
    register()
    wrong_password = login(client, password="wrong-password", email="asha@example.com").get_json()

    unknown = login(client, email="nobody@example.com")

    assert unknown.status_code == 401
    assert unknown.get_json() == wrong_password
    entry = db.audit_logs.find_one({"action": "auth.login_failed", "details.reason": "unknown_user"})
    assert entry["details"]["login_id"] == "nobody@example.com"
    assert entry["target_id"] is None


def test_successful_login_is_audited_and_recorded(client, register, db):
    register()

    login(client, email="asha@example.com")

    assert db.audit_logs.count_documents({"action": "auth.login"}) == 1
    assert db.users.find_one({"email": "asha@example.com"})["last_login_at"] is not None


@pytest.mark.parametrize("body", [{"email": "asha@example.com"}, {"password": "secret123"}, {}])
def test_login_missing_fields_is_400(client, body):
    response = client.post("/api/auth/login", json=body)

    assert response.status_code == 400
    assert response.get_json()["error"] == "validation_error"


# ---- rate limiting ----

def test_failed_logins_are_rate_limited(make_app):
    client = make_app(LOGIN_RATE_LIMIT="3 per minute").test_client()

    statuses = [login(client, password="wrong", email="admin@example.com").status_code for _ in range(4)]

    assert statuses == [401, 401, 401, 429]
    blocked = login(client, password="wrong", email="admin@example.com")
    assert blocked.get_json()["error"] == "rate_limited"
    assert "Retry-After" in blocked.headers


def test_successful_logins_do_not_use_up_the_limit(make_app):
    client = make_app(LOGIN_RATE_LIMIT="3 per minute").test_client()

    statuses = [login(client, password="Admin@12345", email="admin@example.com").status_code for _ in range(6)]

    assert statuses == [200] * 6


# ---- /me and tokens ----

def test_me_without_token_is_401(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.get_json()["error"] == "auth_required"


@pytest.mark.parametrize("header", ["Bearer not-a-jwt", "Token abc", "Bearer "])
def test_me_with_bad_header_is_401(client, header):
    response = client.get("/api/auth/me", headers={"Authorization": header})

    assert response.status_code == 401
    assert response.get_json()["error"] in {"invalid_token", "auth_required"}


def make_token(user_id, secret=TEST_CONFIG["JWT_SECRET"], expires_in=timedelta(minutes=5)):
    """Sign a token by hand for edge-case tests."""
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + expires_in}, secret, algorithm="HS256")


def test_me_with_expired_token_is_401(client, register):
    user_id = register().get_json()["user"]["id"]

    token = make_token(user_id, expires_in=timedelta(minutes=-1))
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "token_expired"


def test_me_with_token_signed_by_another_secret_is_401(client, register):
    user_id = register().get_json()["user"]["id"]

    token = make_token(user_id, secret="some-other-secret-that-is-long-enough")
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "invalid_token"


def test_me_for_deleted_user_is_401(client, register, db, auth_header):
    response = register()
    db.users.delete_one({"email": "asha@example.com"})

    me = client.get("/api/auth/me", headers=auth_header(response))

    assert me.status_code == 401
    assert me.get_json()["error"] == "invalid_token"


def test_me_reflects_division_changes_without_new_token(client, register, db, auth_header):
    response = register()
    db.users.update_one({"email": "asha@example.com"}, {"$set": {"division": "Division B"}})

    me = client.get("/api/auth/me", headers=auth_header(response))

    assert me.get_json()["user"]["division"] == "Division B"
