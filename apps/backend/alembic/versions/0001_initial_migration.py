"""initial migration - create all tables from model metadata

Revision ID: 0001
Revises:
Create Date: 2026-01-01

This migration programmatically creates every table defined on Base.metadata.
For a strict hand-written migration, run `alembic revision --autogenerate` after
this baseline to capture incremental schema changes.
"""
from alembic import op

from app.core.database import Base
import app.models  # noqa: F401 ensure all models are registered on Base.metadata

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
