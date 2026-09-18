"""Offline-first sync layer: version columns, sync_devices, sync_operations

Adds an optimistic-concurrency `version` column to every model table that
inherits BaseModel, and creates the server-side idempotency + device registry
tables used by the offline-first sync endpoints.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.core.database import Base
import app.models  # noqa: F401 register all models on Base.metadata

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. version column on every concrete table that inherits BaseModel
    for table in Base.metadata.sorted_tables:
        if "version" not in {c.name for c in table.columns}:
            continue
        if not inspector.has_table(table.name):
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        if "version" not in existing_cols:
            op.add_column(
                table.name,
                sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            )
        existing_idx = {i["name"] for i in inspector.get_indexes(table.name)}
        if f"ix_{table.name}_version" not in existing_idx:
            op.create_index(f"ix_{table.name}_version", table.name, ["version"])

    # 2. sync_devices - bound to the authenticated user, tracked for rotation/revocation
    op.create_table(
        "sync_devices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("app_version", sa.String(40), nullable=True),
        sa.Column("platform", sa.String(40), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sync_devices_device_id", "sync_devices", ["device_id"], unique=True)
    op.create_index("ix_sync_devices_user_id", "sync_devices", ["user_id"])

    # 3. sync_operations - idempotency ledger for push requests
    op.create_table(
        "sync_operations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("client_request_id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("device_id", sa.String(128), nullable=True),
        sa.Column("entity_type", sa.String(60), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=False),
        sa.Column("operation", sa.String(20), nullable=False),
        sa.Column("request", sa.JSON(), nullable=True),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="processed"),
    )
    op.create_index("ix_sync_operations_client_request_id", "sync_operations", ["client_request_id"], unique=True)
    op.create_index("ix_sync_operations_user_id", "sync_operations", ["user_id"])
    op.create_index("ix_sync_operations_entity_type", "sync_operations", ["entity_type"])
    op.create_index("ix_sync_operations_entity_id", "sync_operations", ["entity_id"])
    op.create_index("ix_sync_operations_device_id", "sync_operations", ["device_id"])
    op.create_index("ix_sync_operations_status", "sync_operations", ["status"])


def downgrade() -> None:
    op.drop_index("ix_sync_operations_status", table_name="sync_operations")
    op.drop_index("ix_sync_operations_device_id", table_name="sync_operations")
    op.drop_index("ix_sync_operations_entity_id", table_name="sync_operations")
    op.drop_index("ix_sync_operations_entity_type", table_name="sync_operations")
    op.drop_index("ix_sync_operations_user_id", table_name="sync_operations")
    op.drop_index("ix_sync_operations_client_request_id", table_name="sync_operations")
    op.drop_table("sync_operations")
    op.drop_index("ix_sync_devices_user_id", table_name="sync_devices")
    op.drop_index("ix_sync_devices_device_id", table_name="sync_devices")
    op.drop_table("sync_devices")

    for table in Base.metadata.sorted_tables:
        if "version" not in {c.name for c in table.columns}:
            continue
        bind = op.get_bind()
        inspector = inspect(bind)
        if not inspector.has_table(table.name):
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        if "version" in existing_cols:
            op.drop_column(table.name, "version")