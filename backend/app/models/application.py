from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, new_id

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.programme import Programme
    from app.models.user import User


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint(
            "candidate_reference ~ '[^[:space:]]'", name="candidate_reference_nonblank"
        ),
    )

    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    programme_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("programmes.id", ondelete="CASCADE"), index=True
    )
    candidate_reference: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    programme: Mapped[Programme] = relationship(back_populates="applications")
    creator: Mapped[User] = relationship(back_populates="submitted_applications")
    documents: Mapped[list[Document]] = relationship(
        back_populates="application", passive_deletes="all"
    )
