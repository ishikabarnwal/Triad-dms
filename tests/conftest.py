"""Shared pytest fixtures. Tests run against a real MongoDB in a throwaway database."""

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
    "RATELIMIT_STORAGE_URI": "memory://",
    "ADMIN_NAME": "Test Admin",
    "ADMIN_USERNAME": "admin",
    "ADMIN_EMAIL": "admin@example.com",
    "ADMIN_PASSWORD": "Admin@12345",
    "ADMIN_DIVISION": "Headquarters",
}


@pytest.fixture
def app():
    """A seeded app backed by an empty test database that is dropped afterwards."""
    app = create_app(TEST_CONFIG)
    client = app.extensions["mongo_client"]
    client.drop_database(TEST_DB)
    run_seed(app.extensions["mongo_db"], app.config)
    yield app
    client.drop_database(TEST_DB)


@pytest.fixture
def db(app):
    """The test database handle."""
    return app.extensions["mongo_db"]


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()
