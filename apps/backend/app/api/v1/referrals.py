from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.referral import Referral, ReferralFollowup
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import (
    ReferralCreate,
    ReferralFollowupCreate,
    ReferralFollowupResponse,
    ReferralResponse,
    ReferralUpdate,
)
from app.services.audit import log_action

router = APIRouter()


async def _get_referral(db: AsyncSession, referral_id: str) -> Referral:
    referral = await db.get(Referral, referral_id)
    if not referral:
        raise NotFoundError("Referral not found")
    return referral


@router.get("", response_model=PaginatedResponse[ReferralResponse])
async def list_referrals(
    status: str | None = None,
    referral_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Referral)
    if status:
        stmt = stmt.where(Referral.status == status)
    if referral_type:
        stmt = stmt.where(Referral.referral_type == referral_type)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Referral.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate([ReferralResponse.model_validate(r) for r in result.scalars().all()], total, page, page_size)


@router.post("", response_model=ReferralResponse, status_code=201)
async def create_referral(
    payload: ReferralCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    referral = Referral(
        **payload.model_dump(),
        referred_from_id=user.id,
        initiated_at=datetime.now(UTC),
    )
    db.add(referral)
    await db.flush()
    await log_action(db, user.id, "referral_created", "referral", referral.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(referral)
    return referral


@router.get("/{referral_id}", response_model=ReferralResponse)
async def get_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    return await _get_referral(db, referral_id)


@router.put("/{referral_id}", response_model=ReferralResponse)
async def update_referral(
    referral_id: str,
    payload: ReferralUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "referral_updated", "referral", referral.id, old_values=referral.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(referral, key, value)
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/accept", response_model=ReferralResponse)
async def accept_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    if referral.status != "initiated":
        raise ConflictError(f"Cannot accept referral in status '{referral.status}'")
    referral.status = "accepted"
    referral.accepted_at = datetime.now(UTC)
    await log_action(db, user.id, "referral_accepted", "referral", referral.id, new_values={"status": "accepted"})
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/complete", response_model=ReferralResponse)
async def complete_referral(
    referral_id: str,
    outcome: str = "",
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    referral.status = "completed"
    referral.completed_at = datetime.now(UTC)
    if outcome:
        referral.outcome = outcome
    await log_action(db, user.id, "referral_completed", "referral", referral.id, new_values={"status": "completed"})
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/followups", response_model=ReferralFollowupResponse, status_code=201)
async def add_referral_followup(
    referral_id: str,
    payload: ReferralFollowupCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_referral(db, referral_id)
    followup = ReferralFollowup(**payload.model_dump(), referral_id=referral_id, conducted_by=user.id)
    db.add(followup)
    await db.commit()
    await db.refresh(followup)
    return followup


@router.get("/{referral_id}/followups", response_model=list[ReferralFollowupResponse])
async def list_referral_followups(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_referral(db, referral_id)
    result = await db.execute(
        select(ReferralFollowup)
        .where(ReferralFollowup.referral_id == referral_id)
        .order_by(ReferralFollowup.followup_date)
    )
    return [ReferralFollowupResponse.model_validate(f) for f in result.scalars().all()]


@router.delete("/{referral_id}", response_model=MessageResponse)
async def delete_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    await db.delete(referral)
    await db.commit()
    return MessageResponse(message="Referral deleted")
