"""Shared pytest fixtures. Tests run against a real MongoDB in a throwaway database."""

import io
import json
import os

import pytest

from app import create_app
from app.seed import run_seed

TEST_DB = os.getenv("TEST_MONGO_DB", "triad_dms_test")

TEST_CONFIG = {
    "TESTING": True,
    "MONGO_URI": os.getenv("TEST_MONGO_URI", "mongodb://localhost:27017"),
    "MONGO_DB": TEST_DB,
    "JWT_SECRET": "test-secret-not-for-real-use",
    "JWT_EXPIRES_MINUTES": 60,
    # Low cost keeps the suite fast; production uses the real default.
    "BCRYPT_ROUNDS": 4,
    "PASSWORD_MIN_LENGTH": 6,
    "RATELIMIT_STORAGE_URI": "memory://",
    "LOGIN_RATE_LIMIT": "100 per minute",
    "ADMIN_NAME": "Test Admin",
    "ADMIN_USERNAME": "admin",
    "ADMIN_EMAIL": "admin@example.com",
    "ADMIN_PASSWORD": "Admin@12345",
    "ADMIN_DIVISION": "Headquarters",
}


@pytest.fixture
def make_app():
    """Factory for seeded apps on an empty test database, with optional config overrides."""
    created = []

    def factory(**overrides):
        app = create_app({**TEST_CONFIG, **overrides})
        app.extensions["mongo_client"].drop_database(TEST_DB)
        run_seed(app.extensions["mongo_db"], app.config)
        created.append(app)
        return app

    yield factory
    for app in created:
        app.extensions["mongo_client"].drop_database(TEST_DB)


@pytest.fixture
def app(make_app):
    """A seeded app with the default test config."""
    return make_app()


@pytest.fixture
def db(app):
    """The test database handle."""
    return app.extensions["mongo_db"]


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def register(client):
    """Register a user, filling in sensible defaults. Returns the response."""

    def do_register(**fields):
        body = {
            "name": "Asha Verma",
            "email": "asha@example.com",
            "password": "secret123",
            "division": "Division A",
            **fields,
        }
        body = {key: value for key, value in body.items() if value is not None}
        return client.post("/api/auth/register", json=body)

    return do_register


@pytest.fixture
def auth_header():
    """Build an Authorization header from a login/register response."""

    def build(response):
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    return build


@pytest.fixture
def tokens(client, register, auth_header):
    """Bearer headers for a Division A user, a Division B user and the super admin."""
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@12345"})
    return {
        "a": auth_header(register(name="Alpha User", email="alpha@example.com", division="Division A")),
        "b": auth_header(register(name="Bravo User", email="bravo@example.com", division="Division B")),
        "admin": auth_header(admin_login),
    }


@pytest.fixture
def upload(client):
    """POST a file to /api/documents/upload. Returns the response."""

    def do_upload(data, filename="report.pdf", metadata=None, headers=None, title=None, mimetype="application/pdf"):
        form = {"file": (io.BytesIO(data), filename, mimetype)}
        if metadata is not None:
            form["metadata"] = metadata if isinstance(metadata, str) else json.dumps(metadata)
        if title is not None:
            form["title"] = title
        return client.post(
            "/api/documents/upload",
            data=form,
            headers=headers or {},
            content_type="multipart/form-data",
        )

    return do_upload
