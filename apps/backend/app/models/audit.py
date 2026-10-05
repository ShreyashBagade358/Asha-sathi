from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    old_values: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    new_values: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    changed_fields: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_info: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)


class SyncLog(BaseModel):
    __tablename__ = "sync_logs"

    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sync_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    records_pushed: Mapped[int] = mapped_column(Integer, default=0)
    records_pulled: Mapped[int] = mapped_column(Integer, default=0)
    conflicts_detected: Mapped[int] = mapped_column(Integer, default=0)
    conflicts_resolved: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, default=list)
    duration_ms: Mapped[int | None]
    network_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    battery_level: Mapped[int | None]
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, default=dict)
