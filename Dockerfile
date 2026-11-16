FROM python:3.12-slim

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
USER appuser

EXPOSE 5000

# Seed once here instead of in every gunicorn worker, so workers never race on inserts.
CMD ["sh", "-c", "python -m app.seed && exec gunicorn --bind 0.0.0.0:5000 --workers ${GUNICORN_WORKERS:-3} --timeout 120 --access-logfile - 'app:create_app()'"]
