"""Application configuration, read from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()


def env_str(name, default=""):
    """Return an env var as a stripped string, falling back to default when unset or blank."""
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def env_bool(name, default):
    """Parse common truthy strings ("true", "1", "yes", "on") from an env var."""
    value = env_str(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    """Parse an integer env var, failing loudly on garbage instead of silently using the default."""
    value = env_str(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got {value!r}") from exc


def env_list(name, default):
    """Parse a comma-separated env var into a list of non-empty strings."""
    value = env_str(name)
    if not value:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    """Flask config. Every setting can be overridden with an env var of the same name."""

    DEBUG = env_bool("FLASK_DEBUG", False)

    MONGO_URI = env_str("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB = env_str("MONGO_DB", "triad_dms")

    JWT_SECRET = env_str("JWT_SECRET")
    JWT_EXPIRES_MINUTES = env_int("JWT_EXPIRES_MINUTES", 480)
    BCRYPT_ROUNDS = env_int("BCRYPT_ROUNDS", 12)
    PASSWORD_MIN_LENGTH = env_int("PASSWORD_MIN_LENGTH", 6)

    MAX_UPLOAD_MB = env_int("MAX_UPLOAD_MB", 25)
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024
    ALLOW_ANONYMOUS_UPLOAD = env_bool("ALLOW_ANONYMOUS_UPLOAD", True)

    CORS_ORIGINS = env_list("CORS_ORIGINS", ["http://localhost:5173", "http://localhost:3000"])

    ADMIN_NAME = env_str("ADMIN_NAME", "Super Admin")
    ADMIN_USERNAME = env_str("ADMIN_USERNAME", "admin")
    ADMIN_EMAIL = env_str("ADMIN_EMAIL").lower()
    ADMIN_PASSWORD = env_str("ADMIN_PASSWORD")
    ADMIN_DIVISION = env_str("ADMIN_DIVISION", "Headquarters")

    # Counts live in Mongo so every gunicorn worker shares the same login limit.
    RATELIMIT_STORAGE_URI = env_str("RATELIMIT_STORAGE_URI", MONGO_URI)
    RATELIMIT_HEADERS_ENABLED = True
    LOGIN_RATE_LIMIT = env_str("LOGIN_RATE_LIMIT", "10 per minute")

    TESSERACT_CMD = env_str("TESSERACT_CMD")
    OCR_ENABLED = env_bool("OCR_ENABLED", True)
    OCR_LANGUAGES = env_str("OCR_LANGUAGES", "eng")
    # Caps how many scanned pages one upload can send through tesseract, so a huge scan can't stall a worker.
    OCR_MAX_PAGES = env_int("OCR_MAX_PAGES", 25)
    OCR_PAGE_TIMEOUT = env_int("OCR_PAGE_TIMEOUT", 60)
