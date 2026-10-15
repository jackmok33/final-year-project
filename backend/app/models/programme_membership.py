from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.programme import Programme
    from app.models.user import User


class ProgrammeMembership(Base):
    __tablename__ = "programme_memberships"

    user_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    programme_id: Mapped[str] = mapped_column(
        String(200), ForeignKey("programmes.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="memberships")
    programme: Mapped[Programme] = relationship(back_populates="memberships")
