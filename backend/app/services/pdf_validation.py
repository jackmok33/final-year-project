"""Validate originals in a bounded child process; never rewrite their bytes."""

import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from app.document_errors import DocumentError
from app.document_limits import (
    MAX_DOCUMENT_PAGES,
    MAX_PDF_BYTES,
    PDF_VALIDATION_TIMEOUT_SECONDS,
)

WORKER = Path(__file__).with_name("pdf_worker.py")


@dataclass(frozen=True)
class ValidatedPdf:
    contents: bytes
    page_count: int
    sha256: str


def validate_filename(filename: str) -> str:
    if (
        not 1 <= len(filename) <= 255
        or filename != filename.strip()
        or not filename.lower().endswith(".pdf")
        or any(
            character in "/\\" or ord(character) < 32 or 127 <= ord(character) < 160
            for character in filename
        )
    ):
        raise DocumentError(422, "DOCUMENT_FILENAME_INVALID", "Supply a plain PDF filename.")
    return filename


def validate_pdf(contents: bytes) -> ValidatedPdf:
    if not contents or len(contents) > MAX_PDF_BYTES:
        raise DocumentError(413, "DOCUMENT_SIZE_LIMIT", "PDFs must be nonempty and at most 20 MiB.")
    if not contents.startswith(b"%PDF-"):
        raise DocumentError(422, "PDF_INVALID", "The file is not a readable PDF.")
    try:
        result = subprocess.run(
            [sys.executable, "-I", "-B", str(WORKER)],
            input=contents,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=PDF_VALIDATION_TIMEOUT_SECONDS,
            check=False,
            env={},
        )
        value = json.loads(result.stdout)
        if result.returncode or not isinstance(value, dict):
            raise ValueError
        if value.get("error") == "encrypted":
            raise DocumentError(422, "PDF_ENCRYPTED", "Password-protected PDFs are not supported.")
        pages = value.get("pages")
        if type(pages) is not int or not 1 <= pages <= MAX_DOCUMENT_PAGES:
            raise ValueError
    except OSError:
        raise DocumentError(
            503, "PDF_VALIDATOR_UNAVAILABLE", "PDF validation is unavailable."
        ) from None
    except (subprocess.TimeoutExpired, ValueError, RecursionError):
        raise DocumentError(
            422, "PDF_INVALID", "The PDF could not be safely read within the validation limits."
        ) from None
    return ValidatedPdf(contents, pages, hashlib.sha256(contents).hexdigest())
