from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.eligible_couple import ECFollowup, EligibleCouple
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import (
    ECFollowupCreate,
    ECFollowupResponse,
    EligibleCoupleCreate,
    EligibleCoupleResponse,
    EligibleCoupleUpdate,
)
from app.services.audit import log_action

router = APIRouter()


async def _get_ec(db: AsyncSession, ec_id: str) -> EligibleCouple:
    ec = await db.get(EligibleCouple, ec_id)
    if not ec:
        raise NotFoundError("Eligible couple not found")
    return ec


@router.get("", response_model=PaginatedResponse[EligibleCoupleResponse])
async def list_eligible_couples(
    status: str = "active",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(EligibleCouple)
    if status and status != "all":
        stmt = stmt.where(EligibleCouple.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(EligibleCouple.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([EligibleCoupleResponse.model_validate(e) for e in result.scalars().all()], total, page, page_size)


@router.post("", response_model=EligibleCoupleResponse, status_code=201)
async def create_eligible_couple(
    payload: EligibleCoupleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    ec = EligibleCouple(**payload.model_dump(), registered_by=user.id)
    db.add(ec)
    await db.flush()
    await log_action(db, user.id, "ec_created", "eligible_couple", ec.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(ec)
    return ec


@router.get("/{ec_id}", response_model=EligibleCoupleResponse)
async def get_eligible_couple(
    ec_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    return await _get_ec(db, ec_id)


@router.put("/{ec_id}", response_model=EligibleCoupleResponse)
async def update_eligible_couple(
    ec_id: str,
    payload: EligibleCoupleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    ec = await _get_ec(db, ec_id)
    data = payload.model_dump(exclude_unset=True)
    was_confirmed = ec.pregnancy_confirmed
    await log_action(db, user.id, "ec_updated", "eligible_couple", ec.id, old_values=ec.to_dict(), new_values=data)
    for key, value in data.items():
        setattr(ec, key, value)

    if data.get("pregnancy_confirmed") and not was_confirmed:
        wife = await db.get(Beneficiary, ec.wife_id)
        husband = await db.get(Beneficiary, ec.husband_id)
        wife_name = wife.full_name if wife else "Wife"
        husband_name = husband.full_name if husband else "Husband"
        asha_ids = {b.asha_id for b in (wife, husband) if b and b.asha_id}
        for asha_id in asha_ids:
            db.add(
                Notification(
                    user_id=asha_id,
                    type="pregnancy_confirmed",
                    priority="high",
                    title="Pregnancy Confirmed",
                    message=(
                        f"Pregnancy confirmed for {wife_name} & {husband_name}."
                        " Register ANC and schedule first visit."
                    ),
                    action_url="/phc/maternal-health",
                    action_label="Open Maternal Health",
                    reference_id=ec.id,
                    reference_type="eligible_couple",
                )
            )

    await db.commit()
    await db.refresh(ec)
    return ec


@router.delete("/{ec_id}", response_model=MessageResponse)
async def delete_eligible_couple(
    ec_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    ec = await _get_ec(db, ec_id)
    await db.delete(ec)
    await db.commit()
    return MessageResponse(message="Eligible couple record deleted")


@router.post("/{ec_id}/followups", response_model=ECFollowupResponse, status_code=201)
async def add_ec_followup(
    ec_id: str,
    payload: ECFollowupCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    ec = await _get_ec(db, ec_id)
    followup = ECFollowup(**payload.model_dump(), ec_id=ec_id, recorded_by=user.id)
    db.add(followup)
    ec.last_followup_date = payload.followup_date
    await db.flush()
    await log_action(db, user.id, "ec_followup_created", "ec_followup", followup.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(followup)
    return followup


@router.get("/{ec_id}/followups", response_model=list[ECFollowupResponse])
async def list_ec_followups(
    ec_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_ec(db, ec_id)
    result = await db.execute(select(ECFollowup).where(ECFollowup.ec_id == ec_id).order_by(ECFollowup.followup_date))
    return [ECFollowupResponse.model_validate(f) for f in result.scalars().all()]
