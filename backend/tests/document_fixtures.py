"""Synthetic PDF bytes and credentials; never real applicant documents or keys."""

import hashlib
import io
import json

from pypdf import PdfWriter

TOKENS = {
    user: "document-test-" + user + "-" + "x" * 40
    for user in ("tutor-a", "tutor-b", "admin-a", "former-tutor", "missing-user")
}
UPLOAD_PATH = "/api/v1/applications/APP-TEST-1/documents"


def make_pdf(pages=1, *, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=72, height=72)
    if encrypted:
        writer.encrypt("synthetic-password")
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


def enable_documents(monkeypatch, tmp_path):
    path = tmp_path / "document-tokens.json"
    path.write_text(
        json.dumps(
            {hashlib.sha256(token.encode()).hexdigest(): user for user, token in TOKENS.items()}
        )
    )
    path.chmod(0o600)
    monkeypatch.setenv("DOCUMENT_API_TOKENS_FILE", str(path))
    return path


def auth(user="tutor-a"):
    return {"Authorization": "Bearer " + TOKENS[user]}


def upload(client, data=None, *, kind="cv", filename="example.pdf", user="tutor-a", **kwargs):
    return client.post(
        UPLOAD_PATH,
        params={"documentType": kind, "filename": filename},
        content=make_pdf() if data is None else data,
        headers={**auth(user), "Content-Type": "application/pdf"},
        **kwargs,
    )
