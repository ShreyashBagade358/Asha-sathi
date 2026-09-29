"""Device push notifications: FCM token columns on sync_devices

Adds fcm_token + fcm_updated_at to sync_devices so the backend can fan
out push notifications to every device registered to a user.

NOTE: 0001 creates sync_devices from Base.metadata (the *current* model
metadata), which already contains these columns on a fresh database, so each
add_column below is guarded to keep the chain idempotent against both a
freshly-created schema and an incrementally-migrated database.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-05
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def _get_inspector():
    return inspect(op.get_bind())


def upgrade() -> None:
    inspector = _get_inspector()
    if not inspector.has_table("sync_devices"):
        return
    existing = {c["name"] for c in inspector.get_columns("sync_devices")}
    if "fcm_token" not in existing:
        op.add_column("sync_devices", sa.Column("fcm_token", sa.String(512), nullable=True))
    if "fcm_updated_at" not in existing:
        op.add_column("sync_devices", sa.Column("fcm_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    inspector = _get_inspector()
    if not inspector.has_table("sync_devices"):
        return
    existing = {c["name"] for c in inspector.get_columns("sync_devices")}
    if "fcm_updated_at" in existing:
        op.drop_column("sync_devices", "fcm_updated_at")
    if "fcm_token" in existing:
        op.drop_column("sync_devices", "fcm_token")
