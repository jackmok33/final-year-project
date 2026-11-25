"""Prepare complete bounded text and page images for specialist evaluation."""

import io
import json
import sys
from contextlib import closing

from app.assessments.shared.pdf_preparation import encode_page, read_pdf, render_png

MAX_SECTION_PAGES = 12
MAX_SECTION_TEXT = 9000


def prepare_pages(contents: bytes) -> list[dict]:
    from pypdf import PdfReader
    from pypdfium2 import PdfDocument

    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= MAX_SECTION_PAGES:
        raise ValueError("This pilot supports at most twelve pages per specialist.")
    result = []
    with PdfDocument(contents) as document:
        for index, source in enumerate(reader.pages):
            text = " ".join((source.extract_text(extraction_mode="layout") or "").split())
            with closing(document[index]) as page:
                result.append(encode_page(text[: MAX_SECTION_TEXT + 1], render_png(page)))
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(prepare_pages(read_pdf())))
    except Exception:
        sys.exit(1)
