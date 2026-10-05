from typing import Any

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class AppConfig(BaseModel):
    __tablename__ = "app_configs"

    config_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    config_value: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    scope: Mapped[str] = mapped_column(String(30), default="app")
    scope_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
