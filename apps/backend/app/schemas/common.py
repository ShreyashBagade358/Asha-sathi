from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "Success"


class ErrorResponse(BaseModel):
    detail: str
    code: str
    status: int


class MessageResponse(BaseModel):
    message: str


def paginate(items: list[T], total: int, page: int, page_size: int) -> PaginatedResponse[T]:
    import math

    return PaginatedResponse[T](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )
