"""Pydantic models for validating request bodies and query strings."""

import json
from typing import Annotated, Any, Literal

from flask import current_app
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Trimmed = Annotated[str, StringConstraints(strip_whitespace=True)]
Username = Annotated[
    str,
    # The pattern is checked before lowercasing, so it has to allow capitals.
    StringConstraints(strip_whitespace=True, to_lower=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$"),
]


class RegisterRequest(BaseModel):
    """Body for POST /api/auth/register. Needs an email or a username (or both)."""

    model_config = ConfigDict(extra="ignore")

    name: Annotated[Trimmed, Field(max_length=100)] | None = None
    email: EmailStr | None = None
    username: Username | None = None
    password: str = Field(max_length=128)
    division: Annotated[Trimmed, Field(min_length=1, max_length=100)]

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value):
        """Emails are matched case-insensitively, so store them lowercased."""
        return value.lower() if value else value

    @field_validator("password")
    @classmethod
    def password_long_enough(cls, value):
        """Enforce the configurable minimum password length."""
        minimum = current_app.config["PASSWORD_MIN_LENGTH"]
        if len(value) < minimum:
            raise ValueError(f"Password must be at least {minimum} characters.")
        return value

    @model_validator(mode="after")
    def needs_login_identifier(self):
        """Require an email or username, and derive a display name if none was sent."""
        if not self.email and not self.username:
            raise ValueError("Provide an email or a username.")
        if not self.name:
            self.name = self.username or self.email.split("@")[0]
        return self


class LoginRequest(BaseModel):
    """Body for POST /api/auth/login. Accepts `email`, `username` or `identifier`."""

    model_config = ConfigDict(extra="ignore")

    email: Trimmed | None = None
    username: Trimmed | None = None
    identifier: Trimmed | None = None
    password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def needs_login_identifier(self):
        """At least one way of identifying the user must be present."""
        if not self.login_id:
            raise ValueError("Provide an email or a username.")
        return self

    @property
    def login_id(self):
        """The identifier to look the user up by, lowercased."""
        value = self.email or self.username or self.identifier or ""
        return value.lower()


class UploadForm(BaseModel):
    """Non-file fields of POST /api/documents/upload. `metadata` arrives as a JSON string."""

    model_config = ConfigDict(extra="ignore")

    title: Annotated[Trimmed, Field(max_length=200)] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("metadata", mode="before")
    @classmethod
    def parse_metadata_json(cls, value):
        """Decode the metadata JSON string; a missing or blank value means no metadata."""
        if value is None or (isinstance(value, str) and not value.strip()):
            return {}
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("metadata must be a valid JSON string.") from exc
        if not isinstance(value, dict):
            raise ValueError("metadata must be a JSON object.")
        return value


class ListQuery(BaseModel):
    """Reserved query params of GET /api/documents. Every other param is a metadata filter."""

    model_config = ConfigDict(extra="ignore")

    scope: Literal["division", "all"] = "division"
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    sort: Trimmed = "created_at"
    order: Literal["asc", "desc"] = "desc"
    q: Annotated[Trimmed, Field(max_length=200)] | None = None

    @field_validator("scope", "order", mode="before")
    @classmethod
    def lowercase(cls, value):
        """Accept ?scope=ALL and ?order=ASC."""
        return value.lower() if isinstance(value, str) else value


# One source of truth: these names can't be metadata filters or field keys.
RESERVED_QUERY_PARAMS = frozenset(ListQuery.model_fields)


ObjectIdText = Annotated[Trimmed, Field(min_length=1, max_length=64)]
Note = Annotated[Trimmed, Field(max_length=1000)]


class AccessRequestCreate(BaseModel):
    """Body for POST /api/access/request. `document_id` is accepted as an alias of `doc_id`."""

    model_config = ConfigDict(extra="ignore")

    doc_id: ObjectIdText = Field(validation_alias=AliasChoices("doc_id", "document_id"))
    reason: Note | None = None


class AccessDecision(BaseModel):
    """Body for reject and revoke: the request id and an optional note."""

    model_config = ConfigDict(extra="ignore")

    request_id: ObjectIdText = Field(validation_alias=AliasChoices("request_id", "id"))
    note: Note | None = None


class AccessApproval(AccessDecision):
    """Body for approve. `expires_in_days` is optional; null or missing means access never expires."""

    expires_in_days: int | None = Field(None, ge=1, le=365)


class AccessListQuery(BaseModel):
    """Query params for the inbox and "my requests" lists."""

    model_config = ConfigDict(extra="ignore")

    status: Literal["pending", "approved", "rejected", "revoked", "expired", "all"] = "pending"
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=100)

    @field_validator("status", mode="before")
    @classmethod
    def lowercase(cls, value):
        """Accept ?status=PENDING."""
        return value.lower() if isinstance(value, str) else value
