FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# tesseract does the OCR; curl is only for the container health check.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY run.py .

RUN useradd --create-home --uid 10001 appuser


# Test image: the app plus pytest and the test suite. Used by `docker compose run --rm tests`.
FROM base AS test

COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY tests ./tests
COPY pytest.ini .coveragerc ./
RUN chown -R appuser /srv
USER appuser

CMD ["python", "-m", "pytest", "-q", "--cov", "--cov-report=term-missing:skip-covered"]


# Runtime image (the default, being the last stage).
FROM base AS runtime

USER appuser
EXPOSE 5000

# Seed once here instead of in every gunicorn worker, so workers never race on inserts.
CMD ["sh", "-c", "python -m app.seed && exec gunicorn --bind 0.0.0.0:5000 --workers ${GUNICORN_WORKERS:-3} --timeout 120 --access-logfile - 'app:create_app()'"]
