"""Builders for the sample files used in document tests."""

import io

import fitz
from PIL import Image, ImageDraw, ImageFont

FAKE_PDF = b"%PDF-1.4\n%" + b"A" * 1024 + b"\n%%EOF"


def text_pdf(text):
    """A one-page PDF with a real text layer."""
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), text, fontsize=14)
    data = pdf.tobytes()
    pdf.close()
    return data


def scanned_image(text, image_format="PNG"):
    """A white image with large black text, like a scanned page."""
    font = ImageFont.load_default(size=64)
    image = Image.new("RGB", (1600, 220), "white")
    ImageDraw.Draw(image).text((40, 60), text, fill="black", font=font)
    buffer = io.BytesIO()
    image.save(buffer, format=image_format)
    return buffer.getvalue()


def scanned_pdf(text):
    """A PDF whose only page is an image: no text layer, so it needs OCR."""
    pdf = fitz.open()
    page = pdf.new_page(width=1600, height=220)
    page.insert_image(page.rect, stream=scanned_image(text))
    data = pdf.tobytes()
    pdf.close()
    return data
