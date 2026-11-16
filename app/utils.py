"""Shared helpers: API errors, request parsing, passwords, JWT auth and audit logging."""

from datetime import datetime, timedelta, timezone
from functools import lru_cache, wraps

import bcrypt
import jwt
from flask import current_app, g, request
from pymongo.errors import PyMongoError

from app.db import get_db
from app.models import parse_object_id

JWT_ALGORITHM = "HS256"


class ApiError(Exception):
    """An error that becomes a {error, message} JSON response with the given status."""

    def __init__(self, status, code, message, **extra):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra

    def to_dict(self):
        """Body for the JSON error response."""
        return {"error": self.code, "message": self.message, **self.extra}


def utcnow():
    """Current time in UTC."""
    return datetime.now(timezone.utc)


def read_body():
    """Return the request body as a dict, from JSON or from form fields."""
    if request.is_json:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ApiError(400, "invalid_json", "Request body must be a JSON object.")
        return data
    return request.form.to_dict()


def hash_password(password):
    """Hash a password with bcrypt using the configured cost."""
    salt = bcrypt.gensalt(rounds=current_app.config["BCRYPT_ROUNDS"])
    return bcrypt.hashpw(password.encode(), salt).decode()


@lru_cache(maxsize=4)
def dummy_hash(rounds):
    """A throwaway hash to check against when the user doesn't exist."""
    return bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=rounds))


def verify_password(password, password_hash):
    """Check a password against a hash.

    With no hash we still run bcrypt, so "unknown user" takes as long as
    "wrong password" and response times don't reveal which accounts exist.
    """
    if not password_hash:
        bcrypt.checkpw(password.encode(), dummy_hash(current_app.config["BCRYPT_ROUNDS"]))
        return False
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user):
    """Issue a signed JWT for a user. Returns (token, expires_in_seconds)."""
    expires_in = current_app.config["JWT_EXPIRES_MINUTES"] * 60
    now = utcnow()
    payload = {
        "sub": str(user["_id"]),
        "role": user.get("role", "member"),
        "division": user.get("division"),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm=JWT_ALGORITHM), expires_in


def bearer_token():
    """Return the token from an `Authorization: Bearer <token>` header, or None."""
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def user_from_token(token):
    """Decode a JWT and load its user. Raises ApiError(401) for anything invalid."""
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET"],
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "token_expired", "Your session has expired. Please log in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(401, "invalid_token", "The auth token is invalid.") from exc

    # Load the user on every request so role/division changes and deletions apply immediately.
    user_id = parse_object_id(payload["sub"])
    user = get_db().users.find_one({"_id": user_id}) if user_id else None
    if not user:
        raise ApiError(401, "invalid_token", "The account for this token no longer exists.")
    return user


def login_required(view):
    """Require a valid bearer token and put the user in `g.current_user`."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        if not token:
            raise ApiError(401, "auth_required", "Log in to continue: missing Authorization: Bearer <token> header.")
        g.current_user = user_from_token(token)
        return view(*args, **kwargs)

    return wrapper


def client_ip():
    """IP address of the client making the request."""
    return request.remote_addr


def write_audit(action, actor=None, target_type=None, target_id=None, division=None, details=None):
    """Record an action in audit_logs.

    A failed audit write is logged but never fails the request it describes.
    """
    entry = {
        "actor_id": str(actor["_id"]) if actor else None,
        "actor_name": actor.get("name") if actor else None,
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id) if target_id else None,
        "division": division if division is not None else (actor.get("division") if actor else None),
        "details": details or {},
        "ip": client_ip(),
        "created_at": utcnow(),
    }
    try:
        get_db().audit_logs.insert_one(entry)
    except PyMongoError:
        current_app.logger.exception("Could not write audit log entry for %s", action)
