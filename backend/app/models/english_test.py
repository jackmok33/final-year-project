"""Durable English-test check requests and results."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, new_id


class EnglishTestCheck(Base):
    __tablename__ = "english_test_checks"
    __table_args__ = (
        Index(
            "uq_english_test_checks_active_application",
            "application_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
        Index("ix_english_test_checks_application_created", "application_id", "created_at", "id"),
        CheckConstraint(
            "(status = 'queued' AND lease_until IS NULL AND result IS NULL AND error IS NULL) OR "
            "(status = 'running' AND lease_until IS NOT NULL AND result IS NULL "
            "AND error IS NULL) OR "
            "(status = 'completed' AND lease_until IS NULL AND result IS NOT NULL "
            "AND error IS NULL) OR "
            "(status = 'failed' AND lease_until IS NULL AND result IS NULL AND error IS NOT NULL)",
            name="state",
        ),
    )

    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("applications.id", ondelete="CASCADE")
    )
    document_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    requested_by: Mapped[str] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    document_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prompt_version: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str] = mapped_column(Text)
    rule_version: Mapped[str] = mapped_column(Text)
    result: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    error: Mapped[str | None] = mapped_column(Text)
