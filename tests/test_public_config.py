"""Tests for GET /api/config/public, the limits shown on the landing page."""

from tests.conftest import TEST_CONFIG


def test_public_config_needs_no_token(client):
    response = client.get("/api/config/public")

    assert response.status_code == 200
    body = response.get_json()
    assert body["file_types"] == ["pdf", "png", "jpeg", "tiff", "bmp", "webp"]
    assert "jpg" in body["extensions"] and "tif" in body["extensions"]
    assert body["password"]["hashing"] == "bcrypt"
    assert body["access_expiry_days"] == {"min": 1, "max": 365}


def test_public_config_reflects_the_running_config(make_app):
    app = make_app(MAX_UPLOAD_MB=10, OCR_MAX_PAGES=7, OCR_PAGE_TIMEOUT=30, JWT_EXPIRES_MINUTES=90)

    body = app.test_client().get("/api/config/public").get_json()

    assert body["max_upload_mb"] == 10
    assert body["ocr"]["max_pages"] == 7
    assert body["ocr"]["page_timeout_seconds"] == 30
    assert body["session_minutes"] == 90
    assert body["password"]["cost"] == TEST_CONFIG["BCRYPT_ROUNDS"]
    assert body["login_rate_limit"] == TEST_CONFIG["LOGIN_RATE_LIMIT"]


def test_public_config_leaks_no_secrets(client):
    text = client.get("/api/config/public").get_data(as_text=True)

    for secret in (TEST_CONFIG["JWT_SECRET"], TEST_CONFIG["ADMIN_PASSWORD"], TEST_CONFIG["ADMIN_EMAIL"], "mongodb://"):
        assert secret not in text
