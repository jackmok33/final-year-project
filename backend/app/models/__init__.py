"""Import all tables so Alembic and SQLAlchemy can resolve their relationships."""

from app.models.application import Application
from app.models.document import Document
from app.models.programme import Programme
from app.models.programme_membership import ProgrammeMembership
from app.models.user import User

__all__ = ["Application", "Document", "Programme", "ProgrammeMembership", "User"]
