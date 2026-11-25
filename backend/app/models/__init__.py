"""Import all tables so Alembic and SQLAlchemy can resolve their relationships."""

from app.models.application import Application
from app.models.assessment_job import AssessmentJob
from app.models.document import Document
from app.models.english_test import EnglishTestCheck
from app.models.programme import Programme
from app.models.programme_membership import ProgrammeMembership
from app.models.user import User
from app.models.workspace import AuditEvent, StoredRubric, UploadBatch

__all__ = [
    "Application",
    "AssessmentJob",
    "Document",
    "EnglishTestCheck",
    "Programme",
    "ProgrammeMembership",
    "User",
    "AuditEvent",
    "StoredRubric",
    "UploadBatch",
]
