"""Upload file checks: allowed types, content sniffing and safe filenames."""

import os
import unicodedata

from app.utils import ApiError

EXTENSION_KINDS = {
    "pdf": "pdf",
    "png": "png",
    "jpg": "jpeg",
    "jpeg": "jpeg",
    "tif": "tiff",
    "tiff": "tiff",
    "bmp": "bmp",
    "webp": "webp",
}

MIME_TYPES = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpeg": "image/jpeg",
    "tiff": "image/tiff",
    "bmp": "image/bmp",
    "webp": "image/webp",
}

MAX_FILENAME_LENGTH = 200


def sniff_kind(data):
    """Identify the file type from its first bytes, or None if it isn't a supported type."""
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith((b"II*\x00", b"MM\x00*")):
        return "tiff"
    if data.startswith(b"BM"):
        return "bmp"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def detect_kind(filename, data):
    """Check the extension is allowed and the bytes really are a supported type.

    The type comes from the content, not from the client's Content-Type header,
    so a renamed executable can't be stored as a "PDF".
    """
    extension = os.path.splitext(filename)[1].lower().lstrip(".")
    if extension not in EXTENSION_KINDS:
        allowed = ", ".join(sorted(EXTENSION_KINDS))
        raise ApiError(400, "unsupported_file_type", f"Only these file types are allowed: {allowed}.")

    kind = sniff_kind(data)
    if kind is None:
        raise ApiError(400, "invalid_file", f"The file content is not a valid {extension.upper()} file.")
    return kind


def clean_filename(filename):
    """Keep the user's filename (including non-English names) minus paths and control characters."""
    name = os.path.basename(filename.replace("\\", "/"))
    name = "".join(ch for ch in name if unicodedata.category(ch)[0] != "C").strip()
    if len(name) > MAX_FILENAME_LENGTH:
        stem, extension = os.path.splitext(name)
        name = stem[: MAX_FILENAME_LENGTH - len(extension)] + extension
    return name or "document"
