from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(String(36), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    title: Mapped[str] = mapped_column(String(255))
    title_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    message: Mapped[str] = mapped_column(String(1000))
    message_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    action_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    channels: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, default=dict)


class ReminderSchedule(BaseModel):
    __tablename__ = "reminder_schedules"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    reminder_type: Mapped[str] = mapped_column(String(40), index=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(30), nullable=True)
    frequency_config: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    message_template: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    message_template_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    channels: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
