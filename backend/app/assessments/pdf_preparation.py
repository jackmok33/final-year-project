"""Bound PDF preparation shared by the assessment workers."""

import base64
import io
import json
import re
import resource
import subprocess
import sys
from contextlib import closing
from pathlib import Path

from app.documents.limits import MAX_PDF_BYTES
from app.inference.client import MAX_IMAGE_BYTES

MAX_TEXT_CHARACTERS = 4800
FULL_PAGE = (0, 0, 0, 0)
BACKEND_DIR = Path(__file__).resolve().parents[2]


def page_text(page, *, limit: int = MAX_TEXT_CHARACTERS) -> str:
    text = page.extract_text(extraction_mode="layout") or ""
    return re.sub(r"[^\S\n]+", " ", text[: MAX_TEXT_CHARACTERS * 4]).strip()[:limit]


def render_png(page, crop=FULL_PAGE) -> bytes:
    width, height = page.get_size()
    left, bottom, right, top = crop
    longest_edge = max(width - left - right, height - bottom - top)
    with closing(page.render(scale=1023 / longest_edge, crop=crop)) as bitmap:
        with bitmap.to_pil().convert("L") as image:
            output = io.BytesIO()
            image.save(output, format="PNG")
    png = output.getvalue()
    if len(png) > MAX_IMAGE_BYTES:
        raise ValueError("Rendered page exceeds the inference image limit.")
    return png


def read_pdf() -> bytes:
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    contents = sys.stdin.buffer.read(MAX_PDF_BYTES + 1)
    if not contents or len(contents) > MAX_PDF_BYTES:
        raise ValueError("PDF exceeds the preparation limit.")
    return contents


def encode_page(text: str, png: bytes) -> dict[str, str]:
    return {"text": text, "png": base64.b64encode(png).decode("ascii")}


def decode_page(page: dict[str, str]) -> tuple[str, bytes]:
    return page["text"], base64.b64decode(page["png"], validate=True)


def prepare_in_child(module: str, contents: bytes):
    if not contents or len(contents) > MAX_PDF_BYTES:
        raise ValueError("PDF exceeds the preparation limit.")
    prepared = subprocess.run(
        [sys.executable, "-B", "-m", module],
        input=contents,
        capture_output=True,
        timeout=12,
        check=True,
        cwd=BACKEND_DIR,
        env={},
    )
    return json.loads(prepared.stdout)
