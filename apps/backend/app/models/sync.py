from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SyncDevice(BaseModel):
    """A device that performs offline-first synchronization for an account.

    device_id is device-generated (stable UUID persisted in the app's secure store);
    it is bound to the JWT-authenticated user server-side so clients cannot spoof
    another user's device.
    """

    __tablename__ = "sync_devices"

    device_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    app_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(40), nullable=True)
    fcm_token: Mapped[str | None] = mapped_column(String(512), nullable=True, index=False)
    fcm_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncOperation(BaseModel):
    """Idempotency ledger for push operations.

    A row is written for every processed client request keyed by client_request_id.
    If the same request arrives again (network retry, app restart, duplicate batch),
    the stored response is replayed instead of re-applying the change. This is what
    guarantees "no duplicate patients/health records" under retries.
    """

    __tablename__ = "sync_operations"

    client_request_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(60), index=True)
    entity_id: Mapped[str] = mapped_column(String(64), index=True)
    operation: Mapped[str] = mapped_column(String(20))  # create | update | delete
    request: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    response: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="processed", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)