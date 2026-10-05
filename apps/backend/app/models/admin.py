from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.json import JSON


class State(BaseModel):
    __tablename__ = "states"

    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    districts: Mapped[list["District"]] = relationship(back_populates="state", cascade="all, delete-orphan")


class District(BaseModel):
    __tablename__ = "districts"

    state_id: Mapped[str] = mapped_column(String(36), ForeignKey("states.id"), index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    state: Mapped[Optional["State"]] = relationship(back_populates="districts")
    blocks: Mapped[list["Block"]] = relationship(back_populates="district", cascade="all, delete-orphan")


class Block(BaseModel):
    __tablename__ = "blocks"

    district_id: Mapped[str] = mapped_column(String(36), ForeignKey("districts.id"), index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    district: Mapped[Optional["District"]] = relationship(back_populates="blocks")
    phcs: Mapped[list["PHC"]] = relationship(back_populates="block", cascade="all, delete-orphan")


class PHC(BaseModel):
    __tablename__ = "phcs"

    block_id: Mapped[str] = mapped_column(String(36), ForeignKey("blocks.id"), index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    head_officer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    block: Mapped[Optional["Block"]] = relationship(back_populates="phcs")
    sub_centers: Mapped[list["SubCenter"]] = relationship(back_populates="phc", cascade="all, delete-orphan")


class SubCenter(BaseModel):
    __tablename__ = "sub_centers"

    phc_id: Mapped[str] = mapped_column(String(36), ForeignKey("phcs.id"), index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    phc: Mapped[Optional["PHC"]] = relationship(back_populates="sub_centers")
    villages: Mapped[list["Village"]] = relationship(back_populates="sub_center", cascade="all, delete-orphan")


class Village(BaseModel):
    __tablename__ = "villages"

    sub_center_id: Mapped[str] = mapped_column(String(36), ForeignKey("sub_centers.id"), index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    name_local: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_households: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    sub_center: Mapped[Optional["SubCenter"]] = relationship(back_populates="villages")
