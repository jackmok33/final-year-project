import hashlib
import subprocess

import pytest

from app.document_errors import DocumentError
from app.services import pdf_validation
from app.services.pdf_validation import validate_filename, validate_pdf
from tests.document_fixtures import make_pdf


@pytest.mark.parametrize("pages", [1, 100])
def test_real_pdf_parser_preserves_original_bytes_and_counts_pages(pages):
    contents = make_pdf(pages)
    result = validate_pdf(contents)
    assert result.contents == contents
    assert result.page_count == pages
    assert result.sha256 == hashlib.sha256(contents).hexdigest()


@pytest.mark.parametrize(
    "contents",
    [
        b"not pdf",
        b"%PDF-1.7\nnot really PDF\n%%EOF",
        make_pdf(0),
        make_pdf(101),
        make_pdf(encrypted=True),
    ],
)
def test_invalid_or_encrypted_pdfs_are_rejected(contents):
    with pytest.raises(DocumentError) as error:
        validate_pdf(contents)
    assert error.value.status_code == 422


@pytest.mark.parametrize("contents", [b"", b"x" * (20 * 1024 * 1024 + 1)])
def test_byte_limits_are_enforced_before_parsing(contents):
    with pytest.raises(DocumentError) as error:
        validate_pdf(contents)
    assert error.value.status_code == 413


@pytest.mark.parametrize(
    "exception,status", [(subprocess.TimeoutExpired("private", 10), 422), (OSError("private"), 503)]
)
def test_worker_failure_is_bounded_and_sanitised(monkeypatch, exception, status):
    def fail(*args, **kwargs):
        raise exception

    monkeypatch.setattr(pdf_validation.subprocess, "run", fail)
    with pytest.raises(DocumentError) as error:
        validate_pdf(make_pdf())
    assert error.value.status_code == status
    assert "private" not in error.value.message


@pytest.mark.parametrize(
    "filename",
    [
        "../cv.pdf",
        "folder\\cv.pdf",
        "bad\nname.pdf",
        "bad\x7fname.pdf",
        "not.txt",
        " file.pdf",
        "file.pdf ",
    ],
)
def test_unsafe_filenames_are_rejected(filename):
    with pytest.raises(DocumentError):
        validate_filename(filename)


def test_unicode_filename_is_preserved():
    assert validate_filename("學歷 résumé.PDF") == "學歷 résumé.PDF"
