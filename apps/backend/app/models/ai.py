from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class AIPrediction(BaseModel):
    __tablename__ = "ai_predictions"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    model_name: Mapped[str] = mapped_column(String(60), index=True)
    model_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    input_features: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    prediction: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    triggered_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    action_taken: Mapped[str | None] = mapped_column(String(255), nullable=True)
