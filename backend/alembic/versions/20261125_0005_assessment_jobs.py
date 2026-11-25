"""Persist queued full-assessment jobs without changing existing review histories."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261125_0005"
down_revision = "20261121_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assessment_jobs",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(200),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            sa.String(200),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("inputs", postgresql.JSONB(), nullable=False),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_assessment_jobs_status",
        ),
        sa.CheckConstraint(
            "(status = 'running' AND lease_until IS NOT NULL) OR "
            "(status <> 'running' AND lease_until IS NULL)",
            name="ck_assessment_jobs_lease_state",
        ),
    )
    op.create_index("ix_assessment_jobs_application_id", "assessment_jobs", ["application_id"])
    op.create_index("ix_assessment_jobs_requested_by", "assessment_jobs", ["requested_by"])
    op.create_index(
        "uq_assessment_jobs_active",
        "assessment_jobs",
        ["application_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade():
    bind = op.get_bind()
    if bind.scalar(sa.text("SELECT EXISTS (SELECT 1 FROM assessment_jobs)")):
        raise RuntimeError("Preserve assessment job history before downgrading.")
    op.drop_table("assessment_jobs")
