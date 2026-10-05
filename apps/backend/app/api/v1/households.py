from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.admin import Village
from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey
from app.models.eligible_couple import EligibleCouple
from app.models.task import ASHATask
from app.models.user import Role, User
from app.schemas.beneficiary import (
    BeneficiaryResponse,
    ConsentRecord,
    HouseholdCreate,
    HouseholdResponse,
    HouseholdSurveyCreate,
    HouseholdSurveyResponse,
    HouseholdUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.services.audit import log_action
from app.services.task_plan import OPEN_TASK_STATUSES

router = APIRouter()


async def _hydrate_households(db: AsyncSession, households: list[Household]) -> list[HouseholdResponse]:
    """Resolve the village name and the member roll-ups the list renders.

    These five values are not columns on `households`, so without this step the
    UI could only ever show a blank village and four zeros. Everything below is
    derived from rows that actually exist, using the same membership rule as
    `GET /households/{id}/members` (no status filter) so the list and the
    detail page agree.
    """
    if not households:
        return []
    hh_ids = [h.id for h in households]
    village_ids = {h.village_id for h in households}

    village_names: dict[str, str] = {}
    if village_ids:
        rows = await db.execute(select(Village.id, Village.name).where(Village.id.in_(village_ids)))
        village_names = dict(rows.all())

    under_five = or_(
        Beneficiary.age_years < 5,
        and_(Beneficiary.age_years.is_(None), Beneficiary.age_months < 60),
    )
    member_rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                func.count(),
                func.sum(case((Beneficiary.is_pregnant.is_(True), 1), else_=0)),
                func.sum(case((under_five, 1), else_=0)),
            )
            .where(Beneficiary.household_id.in_(hh_ids))
            .group_by(Beneficiary.household_id)
        )
    ).all()
    member_counts = {
        hid: {
            "member_count": int(count or 0),
            "pregnant_women": int(pregnant or 0),
            "children_under5": int(children or 0),
        }
        for hid, count, pregnant, children in member_rows
    }

    ec_rows = (
        await db.execute(
            select(Beneficiary.household_id, func.count())
            .join(EligibleCouple, EligibleCouple.wife_id == Beneficiary.id)
            .where(Beneficiary.household_id.in_(hh_ids), EligibleCouple.status == "active")
            .group_by(Beneficiary.household_id)
        )
    ).all()
    eligible_women = {hid: int(count or 0) for hid, count in ec_rows}

    out: list[HouseholdResponse] = []
    for h in households:
        data = HouseholdResponse.model_validate(h).model_dump()
        counts = member_counts.get(h.id, {})
        data["village"] = village_names.get(h.village_id)
        data["member_count"] = counts.get("member_count", 0)
        data["pregnant_women"] = counts.get("pregnant_women", 0)
        data["children_under5"] = counts.get("children_under5", 0)
        data["eligible_women"] = eligible_women.get(h.id, 0)
        out.append(HouseholdResponse(**data))
    return out


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
    return paginate(await _hydrate_households(db, list(result.scalars().all())), total, page, page_size)


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
    return (await _hydrate_households(db, [household]))[0]


@router.get("/{household_id}", response_model=HouseholdResponse)
async def get_household(
    household_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    return (await _hydrate_households(db, [household]))[0]


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
    return (await _hydrate_households(db, [household]))[0]


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
    return (await _hydrate_households(db, [household]))[0]


# ---------------------------------------------------------------------------
# Household surveys
# ---------------------------------------------------------------------------
@router.post("/{household_id}/survey", response_model=HouseholdSurveyResponse, status_code=201)
async def create_household_survey(
    household_id: str,
    payload: HouseholdSurveyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Record one administered survey for a household."""
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    survey = HouseholdSurvey(
        household_id=household.id,
        asha_id=user.id if user.role == Role.ASHA.value else None,
        answers=payload.answers,
        consent_obtained=payload.consent_obtained,
        visited_at=payload.visited_at,
        created_by=user.id,
    )
    db.add(survey)
    await db.flush()
    await log_action(
        db,
        user.id,
        "household_survey_created",
        "household_survey",
        survey.id,
        new_values={"household_id": household.id},
    )

    open_tasks = (
        await db.execute(
            select(ASHATask).where(
                ASHATask.household_id == household.id,
                ASHATask.status.in_(OPEN_TASK_STATUSES),
            )
        )
    ).scalars().all()
    completed_at = datetime.now(UTC)
    for task in open_tasks:
        old_values = task.to_dict()
        task.status = "completed"
        task.completed_time = completed_at
        await log_action(
            db,
            user.id,
            "asha_task_completed",
            "asha_task",
            task.id,
            old_values=old_values,
            new_values={"status": "completed", "completed_time": completed_at.isoformat()},
        )

    await db.commit()
    await db.refresh(survey)
    return survey


@router.get("/{household_id}/surveys", response_model=list[HouseholdSurveyResponse])
async def list_household_surveys(
    household_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    result = await db.execute(
        select(HouseholdSurvey)
        .where(HouseholdSurvey.household_id == household.id)
        .order_by(HouseholdSurvey.created_at.desc())
    )
    return list(result.scalars().all())
