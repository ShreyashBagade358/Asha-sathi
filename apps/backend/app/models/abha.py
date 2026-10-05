from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.json import JSON


class ABHARecord(BaseModel):
    __tablename__ = "abha_records"

    beneficiary_id: Mapped[str] = mapped_column(String(36), index=True)
    abha_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    abha_address: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    creation_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    kyc_status: Mapped[str] = mapped_column(String(30), default="pending")
    kyc_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    kyc_reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    linked_mobile: Mapped[str | None] = mapped_column(String(15), nullable=True)
    linked_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    consent_artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consent_status: Mapped[str] = mapped_column(String(20), default="inactive")
    consent_purpose_codes: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    hip_ids: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    hiu_ids: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    profile_photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    demographic_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_kyc_update: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HealthRecord(BaseModel):
    __tablename__ = "health_records"

    abha_record_id: Mapped[str] = mapped_column(String(36), index=True)
    record_type: Mapped[str] = mapped_column(String(40), index=True)
    document_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    facility_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    encounter_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    encounter_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    document_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="created")
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    consent_artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ConsentArtifact(BaseModel):
    __tablename__ = "consent_artifacts"

    artifact_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    abha_record_id: Mapped[str] = mapped_column(String(36), index=True)
    hip_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hiu_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    purpose_codes: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)
    hi_types: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    permission_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permission_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", index=True)
    signature: Mapped[str | None] = mapped_column(String(512), nullable=True)
