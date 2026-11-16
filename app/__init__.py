"""Flask application factory."""

import pytesseract
from flask import Flask, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.db import init_db
from app.extensions import limiter
from app.routes.access import access_bp
from app.routes.auth import auth_bp
from app.routes.documents import documents_bp
from app.routes.health import health_bp
from app.utils import ApiError

# Clients branch on these codes, so a few get friendlier names than werkzeug's defaults.
ERROR_CODE_OVERRIDES = {
    413: "file_too_large",
    429: "rate_limited",
}

ERROR_MESSAGE_OVERRIDES = {
    429: "Too many attempts. Please wait a minute and try again.",
}


def create_app(overrides=None):
    """Build and configure the Flask app. `overrides` lets tests swap config values."""
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    check_config(app)

    app.json.sort_keys = False
    if app.config["TESSERACT_CMD"]:
        pytesseract.pytesseract.tesseract_cmd = app.config["TESSERACT_CMD"]

    init_db(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    limiter.init_app(app)

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(documents_bp, url_prefix="/api/documents")
    app.register_blueprint(access_bp, url_prefix="/api/access")
    register_error_handlers(app)
    return app


def check_config(app):
    """Refuse to start without the settings that have no safe default."""
    if not app.config["JWT_SECRET"]:
        raise RuntimeError("JWT_SECRET is not set. Copy .env.example to .env and set it.")


def error_code_for(exc):
    """Turn an HTTPException into a short snake_case error code, e.g. 'not_found'."""
    return ERROR_CODE_OVERRIDES.get(exc.code, exc.name.lower().replace(" ", "_"))


def validation_details(exc):
    """Flatten pydantic errors into [{field, message}] for the client."""
    details = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"]) or "body"
        message = error["msg"].removeprefix("Value error, ")
        details.append({"field": field, "message": message})
    return details


def register_error_handlers(app):
    """Make every error, including Flask's own 404/405/413, use the {error, message} JSON shape."""

    @app.errorhandler(ApiError)
    def handle_api_error(exc):
        """Return errors raised by our own code."""
        return jsonify(exc.to_dict()), exc.http_status

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        """Return request body validation failures as 400 with per-field details."""
        details = validation_details(exc)
        first = details[0]
        message = first["message"] if first["field"] == "body" else f"{first['field']}: {first['message']}"
        return jsonify(error="validation_error", message=message, details=details), 400

    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        """Return werkzeug HTTP errors as JSON."""
        message = ERROR_MESSAGE_OVERRIDES.get(exc.code, exc.description)
        return jsonify(error=error_code_for(exc), message=message), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        """Log unexpected errors and hide their details from the client."""
        app.logger.exception("Unhandled error: %s", exc)
        return jsonify(error="internal_error", message="Something went wrong on the server."), 500
