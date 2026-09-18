from pydantic import BaseModel, Field

from app.schemas.common import SuccessResponse


class VillageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=20)
    sub_center_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    total_households: int | None = Field(default=None, ge=0)
    total_population: int | None = Field(default=None, ge=0)


class SanitizeSummary(BaseModel):
    beneficiaries_total: int
    beneficiaries_phone_issues: int
    beneficiaries_name_issues: int
    beneficiaries_without_household: int
    users_total: int
    users_phone_issues: int
    users_name_issues: int
    ashas_without_profile: int


class SanitizeFixRequest(BaseModel):
    actions: list[str] = Field(default_factory=list)


class SanitizeFixResponse(SuccessResponse):
    message: str
    results: dict[str, int]