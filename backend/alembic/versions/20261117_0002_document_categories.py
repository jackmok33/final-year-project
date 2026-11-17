"""Six document categories with repeatable references.

Revision ID: 20261117_0002
Revises: 20261015_0001
"""

import sqlalchemy as sa

from alembic import op

revision = "20261117_0002"
down_revision = "20261015_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TABLE holds the lock until commit, including while replacing its index.
    op.drop_constraint("uq_documents_application_type", "documents", type_="unique")
    op.create_index(
        "uq_documents_application_type",
        "documents",
        ["application_id", "document_type"],
        unique=True,
        postgresql_where=sa.text("document_type <> 'reference'"),
    )
    # The partial unique index excludes references; FK lookups must cover all rows.
    op.create_index(op.f("ix_documents_application_id"), "documents", ["application_id"])
    op.drop_constraint(op.f("ck_documents_type_allowed"), "documents", type_="check")
    op.create_check_constraint(
        op.f("ck_documents_type_allowed"),
        "documents",
        "document_type IN "
        "('transcript', 'cv', 'statement', 'application_form', 'english_test', 'reference')",
    )


def downgrade() -> None:
    # Do not delete, relabel or race uploads that the older schema cannot represent.
    op.execute("LOCK TABLE documents IN ACCESS EXCLUSIVE MODE")
    op.execute(
        """
        DO $migration$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM documents
                WHERE document_type NOT IN ('transcript', 'cv', 'statement')
            ) THEN
                RAISE EXCEPTION
                    'Cannot downgrade document schema while new document categories exist.';
            END IF;
        END;
        $migration$;
        """
    )
    op.drop_index("uq_documents_application_type", table_name="documents")
    op.drop_index(op.f("ix_documents_application_id"), table_name="documents")
    op.create_unique_constraint(
        "uq_documents_application_type", "documents", ["application_id", "document_type"]
    )
    op.drop_constraint(op.f("ck_documents_type_allowed"), "documents", type_="check")
    op.create_check_constraint(
        op.f("ck_documents_type_allowed"),
        "documents",
        "document_type IN ('transcript', 'cv', 'statement')",
    )
