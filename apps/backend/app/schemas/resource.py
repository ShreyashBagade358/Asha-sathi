from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ResourceType = Literal["staff", "vaccines", "equipment", "medicines", "vehicles"]


class ResourceAllocationCreate(BaseModel):
    phc_id: str
    resource_type: ResourceType
    quantity: int = Field(gt=0, le=1000)
    notes: str | None = Field(default=None, max_length=500)
    district_id: str | None = None


class ResourceAllocationResponse(BaseModel):
    id: str
    phc_id: str
    phc_name: str
    resource_type: str
    quantity: int
    notes: str | None
    district_id: str | None
    created_at: datetime
