"""Add worker registration fields to asha_profiles

date_of_birth, gender, emergency contact and date_of_joining are collected
by the PHC admin registration form but were not persisted anywhere.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("asha_profiles", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("asha_profiles", sa.Column("gender", sa.String(16), nullable=True))
    op.add_column("asha_profiles", sa.Column("emergency_contact_name", sa.String(200), nullable=True))
    op.add_column("asha_profiles", sa.Column("emergency_contact_phone", sa.String(15), nullable=True))
    op.add_column("asha_profiles", sa.Column("date_of_joining", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("asha_profiles", "date_of_joining")
    op.drop_column("asha_profiles", "emergency_contact_phone")
    op.drop_column("asha_profiles", "emergency_contact_name")
    op.drop_column("asha_profiles", "gender")
    op.drop_column("asha_profiles", "date_of_birth")
