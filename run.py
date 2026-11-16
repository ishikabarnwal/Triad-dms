"""Local development entry point. Seeds the database, then serves the API on http://localhost:5000."""

import logging

from app import create_app
from app.seed import run_seed

app = create_app()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.logger.info("Seed complete: %s", run_seed(app.extensions["mongo_db"], app.config))
    app.run(host="0.0.0.0", port=5000, debug=app.config["DEBUG"])
