"""Prepare bounded CV evidence one page at a time."""

import io
import json
import sys
from contextlib import closing

from app.assessments.pdf_preparation import encode_page, page_text, read_pdf, render_png

MAX_CV_PAGES = 2


def prepare_cv(contents: bytes) -> list[dict[str, str]]:
    from pypdf import PdfReader
    from pypdfium2 import PdfDocument

    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= MAX_CV_PAGES:
        raise ValueError("Expected an unencrypted CV of one or two pages.")

    pages = []
    with PdfDocument(contents) as document:
        for index, source in enumerate(reader.pages):
            text = page_text(source)
            if not text:
                # This pilot requires embedded text to verify evidence quotes.
                pages.append(encode_page("", b""))
                continue
            with closing(document[index]) as page:
                pages.append(encode_page(text, render_png(page)))
    return pages


if __name__ == "__main__":
    try:
        print(json.dumps(prepare_cv(read_pdf())))
    except Exception:
        sys.exit(1)
