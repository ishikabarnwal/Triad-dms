"""OCR input size limits, which keep one OCR job's memory bounded on small servers."""

import io

import fitz
import pytest
from PIL import Image

from app.ocr import MAX_DECODE_PIXELS, MAX_OCR_PIXELS, RENDER_DPI, fit_for_ocr, render_page


def encoded(image, image_format):
    """Bytes of an image saved in the given format, reopened lazily as an upload would be."""
    buffer = io.BytesIO()
    image.save(buffer, format=image_format)
    return Image.open(io.BytesIO(buffer.getvalue()))


def test_large_images_are_scaled_down_before_ocr():
    fitted = fit_for_ocr(Image.new("RGB", (6000, 4000), "white"))

    assert fitted.width * fitted.height <= MAX_OCR_PIXELS
    assert abs(fitted.width / fitted.height - 1.5) < 0.01


def test_jpegs_beyond_the_decode_limit_are_decoded_at_a_reduced_scale():
    image = encoded(Image.new("RGB", (8000, 6000), "white"), "JPEG")
    assert image.width * image.height > MAX_DECODE_PIXELS

    fitted = fit_for_ocr(image)

    assert fitted.width * fitted.height <= MAX_OCR_PIXELS


def test_other_formats_beyond_the_decode_limit_are_refused():
    image = encoded(Image.new("L", (7000, 6000), "white"), "PNG")

    with pytest.raises(ValueError, match="too large to read"):
        fit_for_ocr(image)


def test_normal_images_pass_through_untouched():
    image = Image.new("RGB", (2480, 3508), "white")

    assert fit_for_ocr(image) is image


def test_palette_images_are_converted_for_tesseract():
    assert fit_for_ocr(Image.new("P", (400, 300))).mode == "RGB"


def test_normal_pages_render_at_full_dpi():
    page = fitz.open().new_page(width=595, height=842)

    assert abs(render_page(page).width - 595 / 72 * RENDER_DPI) <= 1


def test_huge_pages_render_within_the_pixel_limit():
    rendered = render_page(fitz.open().new_page(width=3000, height=3000))

    assert rendered.width * rendered.height <= MAX_OCR_PIXELS


def test_an_image_too_large_to_read_is_still_stored(upload, tokens):
    data = io.BytesIO()
    Image.new("L", (7000, 6000), "white").save(data, format="PNG")

    response = upload(data.getvalue(), filename="poster.png", mimetype="image/png", headers=tokens["a"])

    assert response.status_code == 201
    body = response.get_json()
    assert body["ocr_status"] == "failed"
    assert "too large to read" in body["ocr_error"]
