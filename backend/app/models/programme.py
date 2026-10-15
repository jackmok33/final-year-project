from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, new_id

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.programme_membership import ProgrammeMembership
    from app.models.user import User


class Programme(Base):
    __tablename__ = "programmes"
    __table_args__ = (
        CheckConstraint(
            "name <> '' AND name !~ '(^[[:space:]]|[[:space:]]$)'", name="name_trimmed"
        ),
        CheckConstraint(
            "code <> '' AND code !~ '(^[[:space:]]|[[:space:]]$)'", name="code_trimmed"
        ),
        CheckConstraint("year ~ '[^[:space:]]'", name="year_nonblank"),
        Index("uq_programmes_code_lower", text("lower(code)"), unique=True),
    )

    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(Text)
    year: Mapped[str] = mapped_column(Text)
    department: Mapped[str] = mapped_column(Text, server_default=text("''"))
    description: Mapped[str] = mapped_column(Text, server_default=text("''"))
    created_by: Mapped[str | None] = mapped_column(
        String(200), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator: Mapped[User | None] = relationship(back_populates="created_programmes")
    memberships: Mapped[list[ProgrammeMembership]] = relationship(
        back_populates="programme", passive_deletes="all"
    )
    applications: Mapped[list[Application]] = relationship(
        back_populates="programme", passive_deletes="all"
    )
