"""Per-member health checks captured during a household visit.

Revision ID: 0010
Revises: 0009

The visit screen records one row per family member (ok / concern) alongside
the household survey, and the row is pushed straight from the field, so the
three link columns are plain strings with no FK — a check must be able to
land before the rows it references have reached the server.

Guarded against a table that already exists: 0001 builds every table in
Base.metadata, so a fresh database already has this one.
"""

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

_INDEXED = ("household_id", "survey_id", "beneficiary_id", "check_type")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("household_visit_checks"):
        return

    op.create_table(
        "household_visit_checks",
        sa.Column("household_id", sa.String(36), nullable=False),
        sa.Column("survey_id", sa.String(36), nullable=True),
        sa.Column("beneficiary_id", sa.String(36), nullable=True),
        sa.Column("check_type", sa.String(40), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("visited_at", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(36), nullable=True),
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in _INDEXED:
        op.create_index(
            f"ix_household_visit_checks_{column}",
            "household_visit_checks",
            [column],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("household_visit_checks"):
        return
    for column in _INDEXED:
        op.drop_index(f"ix_household_visit_checks_{column}", table_name="household_visit_checks")
    op.drop_table("household_visit_checks")
