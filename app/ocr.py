"""Text extraction for uploaded files.

PDFs use their embedded text layer first, which is fast and exact, and only pages
with little or no text (scans) are rendered and sent to tesseract. Images always
go through tesseract. Extraction never raises: any failure is reported in the
result, so a broken or unreadable file still gets stored.
"""

import io
from dataclasses import dataclass

import fitz
import pytesseract
from flask import current_app
from PIL import Image, ImageSequence

# A PDF page with less text than this is treated as a scan and OCR'd.
MIN_TEXT_CHARS_PER_PAGE = 20
RENDER_DPI = 200
# Keeps one document well under Mongo's 16 MB document limit.
MAX_TEXT_CHARS = 2_000_000
MAX_ERROR_CHARS = 300

# MuPDF prints repair warnings to stderr for every damaged PDF; we report errors ourselves.
fitz.TOOLS.mupdf_display_errors(False)


@dataclass
class OcrResult:
    """Outcome of text extraction for one file."""

    text: str = ""
    status: str = "done"
    error: str | None = None
    page_count: int = 0


def extract_text(data, kind):
    """Extract text from file bytes of the given kind ("pdf" or an image kind)."""
    config = current_app.config
    if not config["OCR_ENABLED"]:
        return OcrResult(status="skipped")
    try:
        text, page_count = pdf_text(data, config) if kind == "pdf" else image_text(data, config)
    # Deliberately broad: PyMuPDF, Pillow and tesseract each raise their own error types,
    # and no extraction problem may ever fail the upload itself.
    except Exception as exc:
        current_app.logger.warning("Text extraction failed: %s", exc)
        return OcrResult(status="failed", error=describe_error(exc))
    return OcrResult(text=text[:MAX_TEXT_CHARS], page_count=page_count)


def pdf_text(data, config):
    """Return (text, page_count) for a PDF, OCR'ing only pages without a text layer."""
    with fitz.open(stream=data, filetype="pdf") as pdf:
        if pdf.needs_pass:
            raise ValueError("PDF is password protected.")
        if pdf.page_count == 0:
            raise ValueError("PDF has no readable pages.")

        pages_left_to_ocr = config["OCR_MAX_PAGES"]
        parts = []
        for page in pdf:
            text = page.get_text().strip()
            if len(text) < MIN_TEXT_CHARS_PER_PAGE and pages_left_to_ocr > 0:
                pages_left_to_ocr -= 1
                text = ocr_image(render_page(page), config) or text
            parts.append(text)
        return join_pages(parts), pdf.page_count


def image_text(data, config):
    """Return (text, frame_count) for an image. Multi-page TIFFs are OCR'd frame by frame."""
    with Image.open(io.BytesIO(data)) as image:
        parts = []
        for index, frame in enumerate(ImageSequence.Iterator(image)):
            if index >= config["OCR_MAX_PAGES"]:
                break
            parts.append(ocr_image(frame.convert("RGB"), config))
        return join_pages(parts), getattr(image, "n_frames", 1)


def render_page(page):
    """Render a PDF page to a Pillow image for OCR."""
    pixmap = page.get_pixmap(dpi=RENDER_DPI)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def ocr_image(image, config):
    """Run tesseract on one image and return the stripped text."""
    text = pytesseract.image_to_string(
        image,
        lang=config["OCR_LANGUAGES"],
        timeout=config["OCR_PAGE_TIMEOUT"],
    )
    return text.strip()


def join_pages(parts):
    """Join per-page text, skipping empty pages."""
    return "\n\n".join(part for part in parts if part)


def describe_error(exc):
    """Short, human-readable reason for a failed extraction."""
    message = str(exc).strip() or exc.__class__.__name__
    return message[:MAX_ERROR_CHARS]
