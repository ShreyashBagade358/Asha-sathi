"""Offline-first sync layer: version columns, sync_devices, sync_operations

Adds an optimistic-concurrency `version` column to every model table that
inherits BaseModelaine, and creates the server-side idempotency + device
registry tables used by offline-first sync.

NOTE: 0001 creates tables from Base.metadata (the *current* model metadata,
which already includes sync_devices/sync_operations and every version column),
so every create/index/add here is guarded to keep the chain idempotent against
a freshly-created schema, while still applying cleanly to an incrementally
migrated Postgres database that predates these tables.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from sqlalchemy import inspect

import app.models  # noqa: F401 register all models on Base.metadata
from alembic import op
from app.core.database import Base

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _get_inspector():
    return inspect(op.get_bind())


def upgrade() -> None:
    inspector = _get_inspector()

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
    if not inspector.has_table("sync_devices"):
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
    existing_idx = {i["name"] for i in inspector.get_indexes("sync_devices")}
    if "ix_sync_devices_device_id" not in existing_idx:
        op.create_index("ix_sync_devices_device_id", "sync_devices", ["device_id"], unique=True)
    if "ix_sync_devices_user_id" not in existing_idx:
        op.create_index("ix_sync_devices_user_id", "sync_devices", ["user_id"])

    # 3. sync_operations - idempotency ledger for push requests
    if not inspector.has_table("sync_operations"):
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
    existing_op_idx = {i["name"] for i in inspector.get_indexes("sync_operations")}
    for idx_name, cols in (
        ("ix_sync_operations_client_request_id", ["client_request_id"]),
        ("ix_sync_operations_user_id", ["user_id"]),
        ("ix_sync_operations_entity_type", ["entity_type"]),
        ("ix_sync_operations_entity_id", ["entity_id"]),
        ("ix_sync_operations_device_id", ["device_id"]),
        ("ix_sync_operations_status", ["status"]),
    ):
        if idx_name not in existing_op_idx:
            op.create_index(idx_name, "sync_operations", cols)


def downgrade() -> None:
    inspector = _get_inspector()
    existing_op_idx = {i["name"] for i in inspector.get_indexes("sync_operations")}
    for idx_name in (
        "ix_sync_operations_status",
        "ix_sync_operations_device_id",
        "ix_sync_operations_entity_id",
        "ix_sync_operations_entity_type",
        "ix_sync_operations_user_id",
        "ix_sync_operations_client_request_id",
    ):
        if idx_name in existing_op_idx:
            op.drop_index(idx_name, table_name="sync_operations")
    if inspector.has_table("sync_operations"):
        op.drop_table("sync_operations")

    existing_dev_idx = {i["name"] for i in inspector.get_indexes("sync_devices")}
    for idx_name in ("ix_sync_devices_user_id", "ix_sync_devices_device_id"):
        if idx_name in existing_dev_idx:
            op.drop_index(idx_name, table_name="sync_devices")
    if inspector.has_table("sync_devices"):
        op.drop_table("sync_devices")

    for table in Base.metadata.sorted_tables:
        if "version" not in {c.name for c in table.columns}:
            continue
        if not inspector.has_table(table.name):
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        existing_idx = {i["name"] for i in inspector.get_indexes(table.name)}
        if f"ix_{table.name}_version" in existing_idx:
            op.drop_index(f"ix_{table.name}_version", table_name=table.name)
        if "version" in existing_cols:
            op.drop_column(table.name, "version")
