"""Metadata for original documents in PostgreSQL."""

from datetime import datetime
from typing import Literal

from app.api import ApiModel, Identifier

StoredDocumentType = Literal[
    "transcript", "cv", "statement", "application_form", "english_test", "reference"
]


class StoredDocument(ApiModel):
    id: Identifier
    application_id: Identifier
    document_type: StoredDocumentType
    filename: str
    content_type: Literal["application/pdf"]
    size_bytes: int
    page_count: int
    sha256: str
    uploaded_at: datetime
