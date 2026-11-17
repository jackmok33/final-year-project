"""Persist intake workspaces and imported review histories.

Revision ID: 20261117_0003
Revises: 20261117_0002
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20261117_0003"
down_revision = "20261117_0002"
branch_labels = None
depends_on = None
EMPTY_REVIEW = '\'{"runs":[],"corrections":[],"decisions":[]}\'::jsonb'


def upgrade():
    op.add_column(
        "documents",
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "users",
        sa.Column(
            "can_publish_criteria", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "programmes",
        sa.Column("model_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column("programmes", sa.Column("active_rubric_id", sa.String(200), nullable=True))
    op.create_table(
        "upload_batches",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column("programme_id", sa.String(200), nullable=False),
        sa.Column("intake_year", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("uploaded_by", sa.String(200), nullable=True),
        sa.Column(
            "uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "source IN ('zip', 'existing')", name=op.f("ck_upload_batches_source_allowed")
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            ondelete="CASCADE",
            name=op.f("fk_upload_batches_programme_id_programmes"),
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_upload_batches_uploaded_by_users"),
        ),
    )
    op.create_index(op.f("ix_upload_batches_programme_id"), "upload_batches", ["programme_id"])
    op.create_index(op.f("ix_upload_batches_uploaded_by"), "upload_batches", ["uploaded_by"])
    op.create_index(
        "uq_upload_batches_existing_intake",
        "upload_batches",
        ["programme_id", "intake_year"],
        unique=True,
        postgresql_where=sa.text("source = 'existing'"),
    )
    op.create_table(
        "rubrics",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column("programme_id", sa.String(200), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("criteria", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("programme_id", "version", name="uq_rubrics_programme_version"),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            ondelete="CASCADE",
            name=op.f("fk_rubrics_programme_id_programmes"),
        ),
    )
    op.create_index(op.f("ix_rubrics_programme_id"), "rubrics", ["programme_id"])
    op.create_index(op.f("ix_programmes_active_rubric_id"), "programmes", ["active_rubric_id"])
    op.create_foreign_key(
        op.f("fk_programmes_active_rubric_id_rubrics"),
        "programmes",
        "rubrics",
        ["active_rubric_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
    )
    op.add_column(
        "applications",
        sa.Column("intake_year", sa.Text(), nullable=False, server_default=sa.text("''")),
    )
    op.execute(
        "UPDATE applications SET intake_year = programmes.year FROM programmes "
        "WHERE applications.programme_id = programmes.id"
    )
    op.add_column("applications", sa.Column("batch_id", sa.String(200), nullable=True))
    op.add_column("applications", sa.Column("fixture", sa.Text(), nullable=True))
    op.add_column(
        "applications",
        sa.Column("review_state", JSONB(), nullable=False, server_default=sa.text(EMPTY_REVIEW)),
    )
    op.create_index(op.f("ix_applications_batch_id"), "applications", ["batch_id"])
    op.create_foreign_key(
        op.f("fk_applications_batch_id_upload_batches"),
        "applications",
        "upload_batches",
        ["batch_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.execute(
        "LOCK TABLE users, programmes, applications, documents, upload_batches, rubrics, "
        "audit_events IN ACCESS EXCLUSIVE MODE"
    )
    op.execute("""DO $migration$ BEGIN
        IF EXISTS (SELECT 1 FROM upload_batches) OR EXISTS (SELECT 1 FROM rubrics)
           OR EXISTS (SELECT 1 FROM audit_events)
           OR EXISTS (SELECT 1 FROM applications WHERE fixture IS NOT NULL
                      OR review_state <> '{"runs":[],"corrections":[],"decisions":[]}'::jsonb)
           OR EXISTS (SELECT 1 FROM applications a JOIN programmes p ON a.programme_id = p.id
                      WHERE a.intake_year <> '' AND a.intake_year <> p.year)
           OR EXISTS (SELECT 1 FROM users WHERE can_publish_criteria)
           OR EXISTS (SELECT 1 FROM programmes WHERE NOT model_available)
           OR EXISTS (SELECT 1 FROM documents WHERE position <> 0)
        THEN RAISE EXCEPTION
            'Cannot downgrade workspace schema while persisted workspace data exists.';
        END IF;
        END; $migration$;""")
    op.drop_constraint(
        op.f("fk_applications_batch_id_upload_batches"), "applications", type_="foreignkey"
    )
    op.drop_index(op.f("ix_applications_batch_id"), table_name="applications")
    for name in ("review_state", "fixture", "batch_id", "intake_year"):
        op.drop_column("applications", name)
    op.drop_constraint(
        op.f("fk_programmes_active_rubric_id_rubrics"), "programmes", type_="foreignkey"
    )
    op.drop_index(op.f("ix_programmes_active_rubric_id"), table_name="programmes")
    op.drop_column("programmes", "active_rubric_id")
    op.drop_column("programmes", "model_available")
    op.drop_column("users", "can_publish_criteria")
    op.drop_table("audit_events")
    op.drop_table("rubrics")
    op.drop_table("upload_batches")
    op.drop_column("documents", "position")
