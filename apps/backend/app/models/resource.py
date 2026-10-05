from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ResourceAllocation(BaseModel):
    __tablename__ = "resource_allocations"

    district_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("districts.id"), nullable=True, index=True
    )
    phc_id: Mapped[str] = mapped_column(String(36), ForeignKey("phcs.id"), index=True)
    resource_type: Mapped[str] = mapped_column(String(16))
    quantity: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
