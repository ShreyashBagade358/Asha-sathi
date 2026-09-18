"""Device push notifications: FCM token columns on sync_devices

Adds fcm_token + fcm_updated_at to sync_devices so the backend can fan
out push notifications to every device registered to a user.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-05
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sync_devices", sa.Column("fcm_token", sa.String(512), nullable=True))
    op.add_column(
        "sync_devices",
        sa.Column("fcm_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sync_devices", "fcm_updated_at")
    op.drop_column("sync_devices", "fcm_token")