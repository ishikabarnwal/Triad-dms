"""Pydantic models for validating request bodies."""

from typing import Annotated

from flask import current_app
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator

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
