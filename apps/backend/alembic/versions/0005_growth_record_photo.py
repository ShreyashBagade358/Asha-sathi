"""Add photo_url column to growth_records table.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("growth_records")}
    if "photo_url" not in existing:
        op.add_column("growth_records", sa.Column("photo_url", sa.String(512), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("growth_records")}
    if "photo_url" in existing:
        op.drop_column("growth_records", "photo_url")
