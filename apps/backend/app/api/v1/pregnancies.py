from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.maternal import ANCVISIT, DeliveryOutcome, MicroBirthPlan, PNCVisit, Pregnancy
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.health import (
    ANCVisitCreate,
    ANCVisitResponse,
    DeliveryOutcomeCreate,
    DeliveryOutcomeResponse,
    MicroBirthPlanCreate,
    MicroBirthPlanResponse,
    PNCVisitCreate,
    PNCVisitResponse,
    PregnancyCreate,
    PregnancyResponse,
    PregnancyUpdate,
)
from app.services.audit import log_action

router = APIRouter()


async def _get_pregnancy(db: AsyncSession, pregnancy_id: str) -> Pregnancy:
    pregnancy = await db.get(Pregnancy, pregnancy_id)
    if not pregnancy:
        raise NotFoundError("Pregnancy not found")
    return pregnancy


@router.get("", response_model=PaginatedResponse[PregnancyResponse])
async def list_pregnancies(
    status: str = "ongoing",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Pregnancy).where(Pregnancy.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Pregnancy.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([PregnancyResponse.model_validate(p) for p in result.scalars().all()], total, page, page_size)


@router.post("", response_model=PregnancyResponse, status_code=201)
async def create_pregnancy(
    payload: PregnancyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    pregnancy = Pregnancy(**payload.model_dump())
    db.add(pregnancy)
    beneficiary.is_pregnant = True
    await db.flush()
    await log_action(db, user.id, "pregnancy_created", "pregnancy", pregnancy.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(pregnancy)
    return pregnancy


@router.get("/{pregnancy_id}", response_model=PregnancyResponse)
async def get_pregnancy(
    pregnancy_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    return await _get_pregnancy(db, pregnancy_id)


@router.put("/{pregnancy_id}", response_model=PregnancyResponse)
async def update_pregnancy(
    pregnancy_id: str,
    payload: PregnancyUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    pregnancy = await _get_pregnancy(db, pregnancy_id)
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "pregnancy_updated", "pregnancy", pregnancy.id, old_values=pregnancy.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(pregnancy, key, value)
    await db.commit()
    await db.refresh(pregnancy)
    return pregnancy


@router.delete("/{pregnancy_id}", response_model=MessageResponse)
async def delete_pregnancy(
    pregnancy_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    pregnancy = await _get_pregnancy(db, pregnancy_id)
    await db.delete(pregnancy)
    await db.commit()
    return MessageResponse(message="Pregnancy record deleted")


@router.post("/{pregnancy_id}/anc", response_model=ANCVisitResponse, status_code=201)
async def add_anc_visit(
    pregnancy_id: str,
    payload: ANCVisitCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    pregnancy = await _get_pregnancy(db, pregnancy_id)
    visit = ANCVISIT(**payload.model_dump(), pregnancy_id=pregnancy_id, recorded_by=user.id)
    db.add(visit)
    pregnancy.anc_count = (pregnancy.anc_count or 0) + 1
    pregnancy.last_anc_date = payload.visit_date
    await db.flush()
    await log_action(db, user.id, "anc_visit_created", "anc_visit", visit.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(visit)
    return visit


@router.get("/{pregnancy_id}/anc", response_model=list[ANCVisitResponse])
async def list_anc_visits(
    pregnancy_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_pregnancy(db, pregnancy_id)
    result = await db.execute(
        select(ANCVISIT).where(ANCVISIT.pregnancy_id == pregnancy_id).order_by(ANCVISIT.visit_date)
    )
    return [ANCVisitResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/{pregnancy_id}/pnc", response_model=PNCVisitResponse, status_code=201)
async def add_pnc_visit(
    pregnancy_id: str,
    payload: PNCVisitCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_pregnancy(db, pregnancy_id)
    visit = PNCVisit(**payload.model_dump(), pregnancy_id=pregnancy_id, recorded_by=user.id)
    db.add(visit)
    await db.flush()
    await log_action(db, user.id, "pnc_visit_created", "pnc_visit", visit.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(visit)
    return visit


@router.get("/{pregnancy_id}/pnc", response_model=list[PNCVisitResponse])
async def list_pnc_visits(
    pregnancy_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_pregnancy(db, pregnancy_id)
    result = await db.execute(
        select(PNCVisit).where(PNCVisit.pregnancy_id == pregnancy_id).order_by(PNCVisit.visit_date)
    )
    return [PNCVisitResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/{pregnancy_id}/delivery", response_model=DeliveryOutcomeResponse, status_code=201)
async def record_delivery(
    pregnancy_id: str,
    payload: DeliveryOutcomeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    pregnancy = await _get_pregnancy(db, pregnancy_id)
    outcome = DeliveryOutcome(**payload.model_dump(), pregnancy_id=pregnancy_id, recorded_by=user.id)
    db.add(outcome)
    pregnancy.delivery_outcome_id = outcome.id
    pregnancy.status = "delivered"
    await db.flush()
    await log_action(db, user.id, "delivery_recorded", "delivery_outcome", outcome.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(outcome)
    return outcome


@router.get("/{pregnancy_id}/delivery", response_model=DeliveryOutcomeResponse)
async def get_delivery_outcome(
    pregnancy_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(DeliveryOutcome).where(DeliveryOutcome.pregnancy_id == pregnancy_id))
    outcome = result.scalar_one_or_none()
    if not outcome:
        raise NotFoundError("No delivery outcome found")
    return outcome


@router.post("/{pregnancy_id}/birth-plan", response_model=MicroBirthPlanResponse, status_code=201)
async def create_birth_plan(
    pregnancy_id: str,
    payload: MicroBirthPlanCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_pregnancy(db, pregnancy_id)
    plan = MicroBirthPlan(**payload.model_dump(), pregnancy_id=pregnancy_id)
    db.add(plan)
    await db.flush()
    await log_action(db, user.id, "birth_plan_created", "micro_birth_plan", plan.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(plan)
    return plan


@router.put("/{pregnancy_id}/birth-plan", response_model=MicroBirthPlanResponse)
async def update_birth_plan(
    pregnancy_id: str,
    payload: MicroBirthPlanCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_pregnancy(db, pregnancy_id)
    plan = (
        await db.execute(select(MicroBirthPlan).where(MicroBirthPlan.pregnancy_id == pregnancy_id))
    ).scalar_one_or_none()
    if not plan:
        raise NotFoundError("No birth plan found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(plan, key, value)
    await log_action(db, user.id, "birth_plan_updated", "micro_birth_plan", plan.id, new_values=data)
    await db.commit()
    await db.refresh(plan)
    return plan
