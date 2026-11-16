"""Flask application factory."""

import pytesseract
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.db import init_db
from app.extensions import limiter
from app.routes.health import health_bp

# Clients branch on these codes, so a few get friendlier names than werkzeug's defaults.
ERROR_CODE_OVERRIDES = {
    413: "file_too_large",
    429: "rate_limited",
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
    register_error_handlers(app)
    return app


def check_config(app):
    """Refuse to start without the settings that have no safe default."""
    if not app.config["JWT_SECRET"]:
        raise RuntimeError("JWT_SECRET is not set. Copy .env.example to .env and set it.")


def error_code_for(exc):
    """Turn an HTTPException into a short snake_case error code, e.g. 'not_found'."""
    return ERROR_CODE_OVERRIDES.get(exc.code, exc.name.lower().replace(" ", "_"))


def register_error_handlers(app):
    """Make every error, including Flask's own 404/405/413, use the {error, message} JSON shape."""

    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        """Return werkzeug HTTP errors as JSON."""
        return jsonify(error=error_code_for(exc), message=exc.description), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        """Log unexpected errors and hide their details from the client."""
        app.logger.exception("Unhandled error: %s", exc)
        return jsonify(error="internal_error", message="Something went wrong on the server."), 500
