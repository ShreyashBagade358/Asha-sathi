from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.beneficiary import Beneficiary, Household
from app.models.user import User
from app.schemas.beneficiary import (
    BeneficiaryResponse,
    ConsentRecord,
    HouseholdCreate,
    HouseholdResponse,
    HouseholdUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=PaginatedResponse[HouseholdResponse])
async def list_households(
    q: str | None = None,
    village_id: str | None = None,
    asha_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Household)
    if q:
        stmt = stmt.where(Household.hhid.ilike(f"%{q}%"))
    if village_id:
        stmt = stmt.where(Household.village_id == village_id)
    if asha_id:
        stmt = stmt.where(Household.asha_id == asha_id)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Household.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([HouseholdResponse.model_validate(h) for h in result.scalars().all()], total, page, page_size)


@router.post("", response_model=HouseholdResponse, status_code=201)
async def create_household(
    payload: HouseholdCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    existing = (await db.execute(select(Household).where(Household.hhid == payload.hhid))).scalar_one_or_none()
    if existing:
        raise ConflictError("Household with this hhid already exists")
    household = Household(asha_id=user.id, **payload.model_dump())
    db.add(household)
    await db.flush()
    await log_action(db, user.id, "household_created", "household", household.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(household)
    return household


@router.get("/{household_id}", response_model=HouseholdResponse)
async def get_household(
    household_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    return household


@router.put("/{household_id}", response_model=HouseholdResponse)
async def update_household(
    household_id: str,
    payload: HouseholdUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "household_updated", "household", household.id, old_values=household.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(household, key, value)
    await db.commit()
    await db.refresh(household)
    return household


@router.delete("/{household_id}", response_model=MessageResponse)
async def delete_household(
    household_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    await db.delete(household)
    await db.commit()
    return MessageResponse(message="Household deleted")


@router.get("/{household_id}/members", response_model=PaginatedResponse[BeneficiaryResponse])
async def list_household_members(
    household_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    stmt = select(Beneficiary).where(Beneficiary.household_id == household_id)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Beneficiary.created_at).offset((page - 1) * page_size).limit(page_size))
    return paginate([BeneficiaryResponse.model_validate(b) for b in result.scalars().all()], total, page, page_size)


@router.post("/{household_id}/consent", response_model=HouseholdResponse)
async def update_consent(
    household_id: str,
    payload: ConsentRecord,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    data = payload.model_dump()
    await log_action(db, user.id, "consent_updated", "household", household.id, new_values=data)
    for key, value in data.items():
        setattr(household, key, value)
    await db.commit()
    await db.refresh(household)
    return household
