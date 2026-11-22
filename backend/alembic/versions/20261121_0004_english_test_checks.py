"""Store English-test jobs and immutable terminal results.

Revision ID: 20261121_0004
Revises: 20261117_0003
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261121_0004"
down_revision = "20261117_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "english_test_checks",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(200),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.String(200),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            sa.String(200),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("document_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("rule_version", sa.Text(), nullable=False),
        sa.Column("result", postgresql.JSONB(none_as_null=True)),
        sa.Column("error", sa.Text()),
        sa.CheckConstraint(
            "(status = 'queued' AND lease_until IS NULL AND result IS NULL AND error IS NULL) OR "
            "(status = 'running' AND lease_until IS NOT NULL AND result IS NULL "
            "AND error IS NULL) OR "
            "(status = 'completed' AND lease_until IS NULL AND result IS NOT NULL "
            "AND error IS NULL) OR "
            "(status = 'failed' AND lease_until IS NULL AND result IS NULL AND error IS NOT NULL)",
            name=op.f("ck_english_test_checks_state"),
        ),
    )
    op.create_index(
        "uq_english_test_checks_active_application",
        "english_test_checks",
        ["application_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )
    op.create_index(
        "ix_english_test_checks_application_created",
        "english_test_checks",
        ["application_id", "created_at", "id"],
    )
    for name in ("document_id", "requested_by"):
        op.create_index(f"ix_english_test_checks_{name}", "english_test_checks", [name])


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM english_test_checks)")):
        raise RuntimeError(
            "Back up and explicitly remove English-test check history before downgrading."
        )
    op.drop_table("english_test_checks")
