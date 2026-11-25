"""Durable full-assessment jobs with immutable inputs and worker leases."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, new_id


class AssessmentJob(Base):
    __tablename__ = "assessment_jobs"
    __table_args__ = (
        Index(
            "uq_assessment_jobs_active",
            "application_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
        CheckConstraint("status IN ('queued', 'running', 'completed', 'failed')", name="status"),
        CheckConstraint(
            "(status = 'running' AND lease_until IS NOT NULL) OR "
            "(status <> 'running' AND lease_until IS NULL)",
            name="lease_state",
        ),
    )
    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    requested_by: Mapped[str] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    inputs: Mapped[dict] = mapped_column(JSONB)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
