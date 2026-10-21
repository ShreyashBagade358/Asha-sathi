"""Add photo support to household surveys and visit checks.

Revision ID: 0014
Revises: 0013
"""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add photo_urls JSON column to household_surveys for household-level photos
    op.add_column(
        "household_surveys",
        sa.Column("photo_urls", JSONB, nullable=True),
    )

    # Add photo_url column to household_visit_checks for per-member photos
    op.add_column(
        "household_visit_checks",
        sa.Column("photo_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("household_visit_checks", "photo_url")
    op.drop_column("household_surveys", "photo_urls")