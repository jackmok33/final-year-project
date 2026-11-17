from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, new_id

if TYPE_CHECKING:
    from app.models.application import Application


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index(
            "uq_documents_application_type",
            "application_id",
            "document_type",
            unique=True,
            postgresql_where=text("document_type <> 'reference'"),
        ),
        CheckConstraint(
            "document_type IN "
            "('transcript', 'cv', 'statement', 'application_form', 'english_test', 'reference')",
            name="type_allowed",
        ),
        CheckConstraint("filename ~ '[^[:space:]]'", name="filename_nonblank"),
        CheckConstraint("content_type = 'application/pdf'", name="content_type_pdf"),
        CheckConstraint("size_bytes > 0 AND size_bytes <= 20971520", name="size_range"),
        CheckConstraint("page_count BETWEEN 1 AND 100", name="page_range"),
        CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name="hash_format"),
        CheckConstraint("octet_length(pdf_bytes) = size_bytes", name="byte_length"),
    )

    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    document_type: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(Text, server_default=text("'application/pdf'"))
    size_bytes: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    pdf_bytes: Mapped[bytes] = mapped_column(BYTEA)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    application: Mapped[Application] = relationship(back_populates="documents")
