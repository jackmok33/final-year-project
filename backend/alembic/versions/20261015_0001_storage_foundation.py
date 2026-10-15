"""Five-table PostgreSQL foundation.

Revision ID: 20261015_0001
Revises: None
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261015_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(200), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("is_tutor", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("name ~ '[^[:space:]]'", name=op.f("ck_users_name_nonblank")),
        sa.CheckConstraint(
            "email <> '' AND email !~ '(^[[:space:]]|[[:space:]]$)' AND email = lower(email)",
            name=op.f("ck_users_email_normalized"),
        ),
        sa.CheckConstraint("is_tutor OR is_admin", name=op.f("ck_users_has_role")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "programmes",
        sa.Column("id", sa.String(200), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("year", sa.Text(), nullable=False),
        sa.Column("department", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("description", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("created_by", sa.String(200), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "name <> '' AND name !~ '(^[[:space:]]|[[:space:]]$)'",
            name=op.f("ck_programmes_name_trimmed"),
        ),
        sa.CheckConstraint(
            "code <> '' AND code !~ '(^[[:space:]]|[[:space:]]$)'",
            name=op.f("ck_programmes_code_trimmed"),
        ),
        sa.CheckConstraint("year ~ '[^[:space:]]'", name=op.f("ck_programmes_year_nonblank")),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_programmes_created_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_programmes")),
    )
    op.create_index(op.f("ix_programmes_created_by"), "programmes", ["created_by"])
    op.create_index("uq_programmes_code_lower", "programmes", [sa.text("lower(code)")], unique=True)
    op.create_table(
        "programme_memberships",
        sa.Column("user_id", sa.String(200), nullable=False),
        sa.Column("programme_id", sa.String(200), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_programme_memberships_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_programme_memberships_programme_id_programmes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "programme_id", name=op.f("pk_programme_memberships")),
    )
    op.create_index(
        op.f("ix_programme_memberships_programme_id"), "programme_memberships", ["programme_id"]
    )
    op.create_table(
        "applications",
        sa.Column("id", sa.String(200), nullable=False),
        sa.Column("programme_id", sa.String(200), nullable=False),
        sa.Column("candidate_reference", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(200), nullable=False),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "candidate_reference ~ '[^[:space:]]'",
            name=op.f("ck_applications_candidate_reference_nonblank"),
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_applications_programme_id_programmes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_applications_created_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_applications")),
    )
    op.create_index(op.f("ix_applications_programme_id"), "applications", ["programme_id"])
    op.create_index(op.f("ix_applications_created_by"), "applications", ["created_by"])
    op.create_table(
        "documents",
        sa.Column("id", sa.String(200), nullable=False),
        sa.Column("application_id", sa.String(200), nullable=False),
        sa.Column("document_type", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column(
            "content_type", sa.Text(), server_default=sa.text("'application/pdf'"), nullable=False
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("pdf_bytes", postgresql.BYTEA(), nullable=False),
        sa.Column(
            "uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "document_type IN ('transcript', 'cv', 'statement')",
            name=op.f("ck_documents_type_allowed"),
        ),
        sa.CheckConstraint(
            "filename ~ '[^[:space:]]'", name=op.f("ck_documents_filename_nonblank")
        ),
        sa.CheckConstraint(
            "content_type = 'application/pdf'", name=op.f("ck_documents_content_type_pdf")
        ),
        sa.CheckConstraint(
            "size_bytes > 0 AND size_bytes <= 20971520", name=op.f("ck_documents_size_range")
        ),
        sa.CheckConstraint("page_count BETWEEN 1 AND 100", name=op.f("ck_documents_page_range")),
        sa.CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name=op.f("ck_documents_hash_format")),
        sa.CheckConstraint(
            "octet_length(pdf_bytes) = size_bytes", name=op.f("ck_documents_byte_length")
        ),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            name=op.f("fk_documents_application_id_applications"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
        sa.UniqueConstraint(
            "application_id", "document_type", name="uq_documents_application_type"
        ),
    )


def downgrade() -> None:
    op.drop_table("documents")
    op.drop_table("applications")
    op.drop_table("programme_memberships")
    op.drop_table("programmes")
    op.drop_table("users")
