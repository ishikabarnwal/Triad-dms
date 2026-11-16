"""Auth endpoints: register, login and the current user."""

from flask import Blueprint, current_app, g, jsonify
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.extensions import limiter
from app.models import serialize_user
from app.schemas import LoginRequest, RegisterRequest
from app.utils import (
    ApiError,
    create_token,
    division_names,
    find_division,
    hash_password,
    login_required,
    read_body,
    utcnow,
    verify_password,
    write_audit,
)

auth_bp = Blueprint("auth", __name__)


def auth_response(user, status):
    """Token + user payload shared by register and login.

    Both `token` and `access_token` are returned because different clients expect different keys.
    """
    token, expires_in = create_token(user)
    body = {
        "token": token,
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": expires_in,
        "user": serialize_user(user),
    }
    return jsonify(body), status


def ensure_identity_free(email, username):
    """Raise 409 if the email or username already belongs to someone."""
    users = get_db().users
    if email and users.find_one({"email": email}, {"_id": 1}):
        raise ApiError(409, "email_taken", "An account with this email already exists.")
    if username and users.find_one({"username": username}, {"_id": 1}):
        raise ApiError(409, "username_taken", "This username is already taken.")


def find_user_by_login_id(login_id):
    """Look a user up by email if it looks like one, otherwise by username."""
    field = "email" if "@" in login_id else "username"
    return get_db().users.find_one({field: login_id})


def only_failed_logins(response):
    """Rate limiter hook: count failed attempts only, so normal use is never throttled."""
    return response.status_code != 200


@auth_bp.post("/register")
def register():
    """Create a member account in an existing division and log it in. Returns 201 + token + user."""
    data = RegisterRequest.model_validate(read_body())

    division = find_division(data.division)
    if not division:
        raise ApiError(400, "unknown_division", f"Unknown division '{data.division}'.", divisions=division_names())

    ensure_identity_free(data.email, data.username)
    user = {
        "name": data.name,
        "password_hash": hash_password(data.password),
        "division": division["name"],
        "role": "member",
        "created_at": utcnow(),
    }
    # Optional identifiers are left out instead of stored as null, so the partial unique indexes allow many of them.
    if data.email:
        user["email"] = data.email
    if data.username:
        user["username"] = data.username

    try:
        user["_id"] = get_db().users.insert_one(user).inserted_id
    except DuplicateKeyError as exc:
        # Lost a race with a simultaneous signup for the same email/username.
        taken = "email" if "email" in str(exc.details) else "username"
        raise ApiError(409, f"{taken}_taken", f"This {taken} is already in use.") from exc

    write_audit("auth.register", actor=user, target_type="user", target_id=user["_id"])
    return auth_response(user, 201)


@auth_bp.post("/login")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"], deduct_when=only_failed_logins)
def login():
    """Log in with email or username + password. Returns the token under `token` and `access_token`."""
    data = LoginRequest.model_validate(read_body())

    user = find_user_by_login_id(data.login_id)
    if not verify_password(data.password, user.get("password_hash") if user else None):
        # No actor: we don't know who is really trying, only which account was targeted.
        write_audit(
            "auth.login_failed",
            target_type="user",
            target_id=user["_id"] if user else None,
            division=user.get("division") if user else None,
            details={"login_id": data.login_id, "reason": "wrong_password" if user else "unknown_user"},
        )
        raise ApiError(401, "invalid_credentials", "Incorrect email/username or password.")

    get_db().users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": utcnow()}})
    write_audit("auth.login", actor=user, target_type="user", target_id=user["_id"])
    return auth_response(user, 200)


@auth_bp.get("/me")
@login_required
def me():
    """Return the logged-in user."""
    return jsonify({"user": serialize_user(g.current_user)})
