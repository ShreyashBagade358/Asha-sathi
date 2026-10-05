from typing import Any

from pydantic import BaseModel, Field


class ConfigUpdateItem(BaseModel):
    config_key: str = Field(min_length=1, max_length=120)
    config_value: Any = Field(...)
    description: str | None = Field(default=None, max_length=500)
    is_public: bool = True


class ConfigUpdateRequest(BaseModel):
    configs: list[ConfigUpdateItem] = Field(min_length=1)


class ConfigItem(BaseModel):
    config_key: str
    config_value: Any
    scope: str
    is_public: bool
    version: int


class ConfigUpdateResponse(BaseModel):
    updated: int
    items: list[ConfigItem]
