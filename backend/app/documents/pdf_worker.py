"""Child-process PDF parser. Input/output contain bytes and a page count only."""

import io
import json
import resource
import sys
from pathlib import Path

# Isolated Python ignores PYTHONPATH; this fixed directory belongs to this package.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.documents.limits import MAX_DOCUMENT_PAGES, MAX_PDF_BYTES  # noqa: E402


def inspect_pdf() -> dict:
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    from pypdf import PdfReader

    contents = sys.stdin.buffer.read(MAX_PDF_BYTES + 1)
    if not contents or len(contents) > MAX_PDF_BYTES:
        return {"error": "invalid"}
    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted:
        return {"error": "encrypted"}
    pages = len(reader.pages)
    if not 1 <= pages <= MAX_DOCUMENT_PAGES:
        return {"error": "invalid"}
    for page in reader.pages:
        # Resolve/decode page streams, so a readable page tree alone is insufficient.
        content = page.get_contents()
        if content is not None:
            content.get_data()
    return {"pages": pages}


if __name__ == "__main__":
    try:
        output = inspect_pdf()
    except Exception:
        output = {"error": "invalid"}
    print(json.dumps(output))
