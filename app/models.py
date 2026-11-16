"""Shapes of the documents we return from the API.

Raw Mongo documents never leave the backend: every response goes through one of
these serializers so ids become strings and private fields are dropped.
"""

from bson import ObjectId
from bson.errors import InvalidId


def isoformat(value):
    """Return a datetime as an ISO 8601 string, or None."""
    return value.isoformat() if value else None


def parse_object_id(value):
    """Convert a string to an ObjectId, returning None if it isn't a valid id."""
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        return None


def serialize_user(user):
    """Public view of a user. Never includes the password hash."""
    user_id = str(user["_id"])
    return {
        "id": user_id,
        "user_id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "username": user.get("username"),
        "division": user.get("division"),
        "role": user.get("role", "member"),
        "created_at": isoformat(user.get("created_at")),
    }
