from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, new_id

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.programme import Programme
    from app.models.programme_membership import ProgrammeMembership


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("name ~ '[^[:space:]]'", name="name_nonblank"),
        CheckConstraint(
            "email <> '' AND email !~ '(^[[:space:]]|[[:space:]]$)' AND email = lower(email)",
            name="email_normalized",
        ),
        CheckConstraint("is_tutor OR is_admin", name="has_role"),
    )

    id: Mapped[str] = mapped_column(String(200), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    is_tutor: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_admin: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list[ProgrammeMembership]] = relationship(
        back_populates="user", passive_deletes="all"
    )
    created_programmes: Mapped[list[Programme]] = relationship(
        back_populates="creator", passive_deletes="all"
    )
    submitted_applications: Mapped[list[Application]] = relationship(
        back_populates="creator", passive_deletes="all"
    )
