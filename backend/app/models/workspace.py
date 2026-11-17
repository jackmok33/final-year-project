"""Persistent intake batches, immutable criteria versions and attribution history."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, new_id


class UploadBatch(Base):
    __tablename__ = "upload_batches"
    __table_args__ = (
        CheckConstraint("source IN ('zip', 'existing')", name="source_allowed"),
        Index(
            "uq_upload_batches_existing_intake",
            "programme_id",
            "intake_year",
            unique=True,
            postgresql_where=text("source = 'existing'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    programme_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("programmes.id", ondelete="CASCADE"), index=True
    )
    intake_year: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(Text, server_default=text("''"))
    source: Mapped[str] = mapped_column(Text)
    uploaded_by: Mapped[str | None] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class StoredRubric(Base):
    __tablename__ = "rubrics"
    __table_args__ = (
        UniqueConstraint("programme_id", "version", name="uq_rubrics_programme_version"),
    )
    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    programme_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("programmes.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[str] = mapped_column(Text)
    criteria: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor: Mapped[str] = mapped_column(Text)
    action: Mapped[str] = mapped_column(Text)
    target: Mapped[str] = mapped_column(Text)
