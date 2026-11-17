"""Pydantic models for validating request bodies and query strings."""

import json
from datetime import date
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

# Shared with GET /api/config/public, so the landing page quotes the same limits the API enforces.
ACCESS_EXPIRY_MIN_DAYS = 1
ACCESS_EXPIRY_MAX_DAYS = 365

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


class DocumentFilters(BaseModel):
    """Filters shared by the document list and search. Metadata filters come on top of these."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    division: Annotated[Trimmed, Field(max_length=100)] | None = None
    date_from: date | None = None
    date_to: date | None = None
    ocr_status: Literal["done", "failed", "skipped"] | None = None

    @model_validator(mode="after")
    def dates_in_order(self):
        """date_from can't be after date_to."""
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to.")
        return self


class ListQuery(DocumentFilters):
    """Reserved query params of GET /api/documents. Every other param is a metadata filter."""

    scope: Literal["division", "all"] = "division"
    sort: Trimmed = "created_at"
    order: Literal["asc", "desc"] = "desc"
    q: Annotated[Trimmed, Field(max_length=200)] | None = None

    @field_validator("scope", "order", mode="before")
    @classmethod
    def lowercase(cls, value):
        """Accept ?scope=ALL and ?order=ASC."""
        return value.lower() if isinstance(value, str) else value


class SearchQuery(DocumentFilters):
    """Reserved query params of GET /api/search."""

    q: Annotated[Trimmed, Field(max_length=200)] = ""


# One source of truth: these names can't be metadata filters or field keys.
RESERVED_QUERY_PARAMS = frozenset(ListQuery.model_fields) | frozenset(SearchQuery.model_fields)


def reserved_args(args):
    """Pick the reserved params out of a request's query string."""
    return {key: args[key] for key in RESERVED_QUERY_PARAMS if key in args}


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

    expires_in_days: int | None = Field(None, ge=ACCESS_EXPIRY_MIN_DAYS, le=ACCESS_EXPIRY_MAX_DAYS)


class AccessListQuery(BaseModel):
    """Query params for the inbox and "my requests" lists."""

    model_config = ConfigDict(extra="ignore")

    status: Literal["pending", "approved", "rejected", "revoked", "expired", "all"] = "pending"
    doc_id: ObjectIdText | None = None
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=100)

    @field_validator("status", mode="before")
    @classmethod
    def lowercase(cls, value):
        """Accept ?status=PENDING."""
        return value.lower() if isinstance(value, str) else value


FieldType = Literal["text", "select", "number", "date"]
FieldKey = Annotated[Trimmed, Field(min_length=1, max_length=100)]
Label = Annotated[Trimmed, Field(min_length=1, max_length=100)]


def clean_options(options):
    """Trim options, drop blanks and duplicates (ignoring case), keeping the first spelling."""
    seen, cleaned = set(), []
    for option in options or []:
        text = str(option).strip()
        if text and text.lower() not in seen:
            seen.add(text.lower())
            cleaned.append(text)
    if len(cleaned) > 200:
        raise ValueError("A field can have at most 200 options.")
    if any(len(option) > 100 for option in cleaned):
        raise ValueError("Options can be at most 100 characters.")
    return cleaned


class FieldCreate(BaseModel):
    """Body for POST /api/admin/metadata-fields."""

    model_config = ConfigDict(extra="ignore")

    key: FieldKey
    label: Label | None = None
    type: FieldType = "text"
    options: list[str] = Field(default_factory=list)
    required: bool = False
    filterable: bool = True
    searchable: bool = True

    @field_validator("options", mode="after")
    @classmethod
    def tidy_options(cls, value):
        """Normalise the option list."""
        return clean_options(value)


class FieldUpdate(BaseModel):
    """Body for PUT /api/admin/metadata-fields/<id>. Only the fields sent are changed."""

    model_config = ConfigDict(extra="ignore")

    key: FieldKey | None = None
    label: Label | None = None
    type: FieldType | None = None
    options: list[str] | None = None
    required: bool | None = None
    filterable: bool | None = None
    searchable: bool | None = None
    active: bool | None = None

    @field_validator("options", mode="after")
    @classmethod
    def tidy_options(cls, value):
        """Normalise the option list."""
        return None if value is None else clean_options(value)


class FieldReorder(BaseModel):
    """Body for PUT /api/admin/metadata-fields/reorder: field ids in their new order."""

    model_config = ConfigDict(extra="ignore")

    ids: list[ObjectIdText] = Field(min_length=1, validation_alias=AliasChoices("ids", "order"))


DivisionCode = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$"),
]


class DivisionCreate(BaseModel):
    """Body for POST /api/admin/divisions."""

    model_config = ConfigDict(extra="ignore")

    name: Annotated[Trimmed, Field(min_length=1, max_length=100)]
    code: DivisionCode | None = None
    description: Annotated[Trimmed, Field(max_length=500)] | None = None


class DivisionUpdate(BaseModel):
    """Body for PUT /api/admin/divisions/<id>. Only the fields sent are changed."""

    model_config = ConfigDict(extra="ignore")

    name: Annotated[Trimmed, Field(min_length=1, max_length=100)] | None = None
    code: DivisionCode | None = None
    description: Annotated[Trimmed, Field(max_length=500)] | None = None


class UserQuery(BaseModel):
    """Query params for GET /api/admin/users."""

    model_config = ConfigDict(extra="ignore")

    q: Annotated[Trimmed, Field(max_length=100)] | None = None
    division: Annotated[Trimmed, Field(max_length=100)] | None = None
    role: Literal["member", "admin"] | None = None
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=100)


class UserUpdate(BaseModel):
    """Body for PUT /api/admin/users/<id>."""

    model_config = ConfigDict(extra="ignore")

    role: Literal["member", "admin"] | None = None
    division: Annotated[Trimmed, Field(min_length=1, max_length=100)] | None = None


class AuditQuery(BaseModel):
    """Query params for GET /api/admin/audit-logs."""

    model_config = ConfigDict(extra="ignore")

    action: Annotated[Trimmed, Field(max_length=100)] | None = None
    actor: Annotated[Trimmed, Field(max_length=100)] | None = None
    division: Annotated[Trimmed, Field(max_length=100)] | None = None
    date_from: date | None = None
    date_to: date | None = None
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=200)


class StatsQuery(BaseModel):
    """Query params for GET /api/stats."""

    model_config = ConfigDict(extra="ignore")

    group_by: Annotated[Trimmed, Field(min_length=1, max_length=100)] | None = None
