from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.core.security import generate_secure_id
from app.models.abha import ABHARecord, ConsentArtifact
from app.models.beneficiary import Beneficiary
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services.audit import log_action

router = APIRouter()


class ConsentArtifactCreate(BaseModel):
    abha_record_id: str
    hip_id: str
    hiu_id: str
    purpose_codes: list[str]
    hi_types: list[str]
    permission_start: datetime
    permission_end: datetime


class ConsentArtifactResponse(BaseModel):
    artifact_id: str
    abha_record_id: str
    hip_id: str
    hiu_id: str
    purpose_codes: list[str]
    hi_types: list[str]
    permission_start: datetime
    permission_end: datetime
    status: str


@router.get("/artifacts")
async def list_artifacts(
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(ConsentArtifact)
    if status:
        stmt = stmt.where(ConsentArtifact.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(ConsentArtifact.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = []
    for art in result.scalars().all():
        items.append(ConsentArtifactResponse(**art.to_dict()))
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/artifacts", response_model=ConsentArtifactResponse, status_code=201)
async def create_artifact(
    payload: ConsentArtifactCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    abha = await db.get(ABHARecord, payload.abha_record_id)
    if not abha:
        raise NotFoundError("ABHA record not found")
    artifact = ConsentArtifact(
        artifact_id=generate_secure_id("CA"),
        abha_record_id=payload.abha_record_id,
        hip_id=payload.hip_id,
        hiu_id=payload.hiu_id,
        purpose_codes={"purpose": payload.purpose_codes},
        hi_types=payload.hi_types,
        permission_start=payload.permission_start,
        permission_end=payload.permission_end,
        status="ACTIVE",
    )
    db.add(artifact)
    abha.consent_artifact_id = artifact.artifact_id
    abha.consent_status = "active"
    await db.flush()
    await log_action(
        db,
        user.id,
        "consent_artifact_created",
        "consent_artifact",
        artifact.artifact_id,
        new_values=payload.model_dump(),
    )
    await db.commit()
    return ConsentArtifactResponse(**artifact.to_dict())


@router.put("/artifacts/{artifact_id}/revoke", response_model=MessageResponse)
async def revoke_artifact(
    artifact_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(ConsentArtifact).where(ConsentArtifact.artifact_id == artifact_id))
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise NotFoundError("Consent artifact not found")
    artifact.status = "REVOKED"
    await log_action(db, user.id, "consent_artifact_revoked", "consent_artifact", artifact_id)
    await db.commit()
    return MessageResponse(message="Consent revoked")


@router.get("/beneficiary/{beneficiary_id}")
async def get_beneficiary_consents(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    abha = (
        await db.execute(select(ABHARecord).where(ABHARecord.beneficiary_id == beneficiary_id))
    ).scalar_one_or_none()
    artifacts: list[dict] = []
    if abha:
        rows = (
            (await db.execute(select(ConsentArtifact).where(ConsentArtifact.abha_record_id == abha.id))).scalars().all()
        )
        artifacts = [row.to_dict() for row in rows]
    return {
        "beneficiary_id": beneficiary_id,
        "abha": abha.to_dict() if abha else None,
        "consents": artifacts,
    }
