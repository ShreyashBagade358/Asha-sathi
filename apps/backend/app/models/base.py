import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class BaseModel(Base):
    __abstract__ = True

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Optimistic-concurrency guard used by the offline sync layer.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    def to_dict(self) -> dict[str, Any]:
        return {attr.key: getattr(self, attr.key) for attr in self.__mapper__.column_attrs}
