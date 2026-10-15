from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, case, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.api.v1.beneficiaries import _hydrate_beneficiaries
from app.core.exceptions import ConflictError, NotFoundError
from app.models.admin import Village
from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey, HouseholdVisitCheck
from app.models.eligible_couple import EligibleCouple
from app.models.task import ASHATask
from app.models.user import Role, User
from app.schemas.beneficiary import (
    BeneficiaryCreate,
    BeneficiaryResponse,
    ConsentRecord,
    HouseholdCreate,
    HouseholdMemberLink,
    HouseholdResponse,
    HouseholdSurveyCreate,
    HouseholdSurveyResponse,
    HouseholdUpdate,
    MemberCheckResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.services.audit import log_action
from app.services.sync_scope import resolve_scope
from app.services.task_plan import OPEN_TASK_STATUSES

router = APIRouter()


async def _asha_can_access(db: AsyncSession, user: User, household_id: str) -> bool:
    """ASHA workers may only reach households they own or in their catchment.

    Mirrors the sync scope (own households + catchment villages); failing
    closed with a 404 keeps the REST API from leaking other workers' rows.
    """
    if user.role != Role.ASHA.value:
        return True
    scope = await resolve_scope(db, user)
    return household_id in scope.household_ids


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
    # For ASHA users, ignore explicit asha_id param and use scope-based access
    # (own households + catchment villages). The param is for admins/supervisors.
    if asha_id and user.role != Role.ASHA.value:
        stmt = stmt.where(Household.asha_id == asha_id)
    if user.role == Role.ASHA.value:
        # ASHAs see only their own households plus their catchment villages —
        # the same set the sync scope hands the mobile app.
        scope = await resolve_scope(db, user)
        clauses = [Household.asha_id == user.id]
        if scope.village_ids:
            clauses.append(Household.village_id.in_(scope.village_ids))
        stmt = stmt.where(or_(*clauses))
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
    if not await _asha_can_access(db, user, household.id):
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
    if not await _asha_can_access(db, user, household.id):
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
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Delete a household — refused while it still has family members.

    A member row's ``household_id`` is a bare string with no FK (the sync
    layer writes it directly), so deleting under them would leave the family
    dangling with no trace. ``force=true`` unlinks the members first instead,
    preserving the members themselves. Household surveys cascade on force —
    they are household-owned history and would otherwise block the delete
    through their FK.
    """
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    if not await _asha_can_access(db, user, household.id):
        raise NotFoundError("Household not found")
    member_count = (await db.execute(select(func.count()).where(Beneficiary.household_id == household.id))).scalar_one()
    survey_count = (
        await db.execute(select(func.count()).where(HouseholdSurvey.household_id == household.id))
    ).scalar_one()
    check_count = (
        await db.execute(select(func.count()).where(HouseholdVisitCheck.household_id == household.id))
    ).scalar_one()
    blocked = member_count or survey_count
    if blocked and not force:
        detail = f"Household still has {member_count} family members and {survey_count} surveys"
        raise ConflictError(f"{detail}; pass force=true to unlink them first")
    if member_count:
        await db.execute(update(Beneficiary).where(Beneficiary.household_id == household.id).values(household_id=None))
    if survey_count:
        await db.execute(delete(HouseholdSurvey).where(HouseholdSurvey.household_id == household.id))
    # Visit checks hang off the household alone (no FK), so they are removed
    # with it rather than left dangling — including when nothing blocked the
    # delete in the first place.
    if check_count:
        await db.execute(delete(HouseholdVisitCheck).where(HouseholdVisitCheck.household_id == household.id))
    await log_action(
        db,
        user.id,
        "household_deleted",
        "household",
        household.id,
        old_values=household.to_dict(),
        new_values={
            "unlinked_members": int(member_count),
            "deleted_surveys": int(survey_count),
            "deleted_visit_checks": int(check_count),
        },
    )
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


@router.post("/{household_id}/members", response_model=BeneficiaryResponse, status_code=201)
async def add_household_member(
    household_id: str,
    payload: BeneficiaryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Create a new beneficiary directly inside the household."""
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    existing = (
        await db.execute(select(Beneficiary).where(Beneficiary.beneficiary_id == payload.beneficiary_id))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Beneficiary with this id already exists")
    data = payload.model_dump()
    data["household_id"] = household.id
    beneficiary = Beneficiary(**data, registered_by=user.id)
    db.add(beneficiary)
    await db.flush()
    await log_action(db, user.id, "beneficiary_created", "beneficiary", beneficiary.id, new_values=data)
    await db.commit()
    await db.refresh(beneficiary)
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


@router.post("/{household_id}/members/{beneficiary_id}", response_model=BeneficiaryResponse)
async def link_household_member(
    household_id: str,
    beneficiary_id: str,
    payload: HouseholdMemberLink | None = None,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Link an existing beneficiary into this household."""
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    data: dict = {"household_id": household.id}
    if payload and payload.relationship_to_head is not None:
        data["relationship_to_head"] = payload.relationship_to_head
    await log_action(
        db,
        user.id,
        "beneficiary_updated",
        "beneficiary",
        beneficiary.id,
        old_values={"household_id": beneficiary.household_id},
        new_values=data,
    )
    for key, value in data.items():
        setattr(beneficiary, key, value)
    await db.commit()
    await db.refresh(beneficiary)
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


@router.delete("/{household_id}/members/{beneficiary_id}", response_model=BeneficiaryResponse)
async def unlink_household_member(
    household_id: str,
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Unlink a member from this household (the member row itself is kept)."""
    household = await db.get(Household, household_id)
    if not household:
        raise NotFoundError("Household not found")
    result = await db.execute(
        select(Beneficiary).where(
            or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id),
            Beneficiary.household_id == household.id,
        )
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Member not found in this household")
    await log_action(
        db,
        user.id,
        "beneficiary_updated",
        "beneficiary",
        beneficiary.id,
        old_values={"household_id": beneficiary.household_id},
        new_values={"household_id": None},
    )
    beneficiary.household_id = None
    await db.commit()
    await db.refresh(beneficiary)
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


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
async def _survey_responses(db: AsyncSession, surveys: list[HouseholdSurvey]) -> list[HouseholdSurveyResponse]:
    """Survey rows plus the member checks captured with each one.

    Built explicitly rather than through a relationship: the checks are a
    sync table with no FK back to the survey, and the async session cannot
    lazy-load what Pydantic touches after the fact.
    """
    if not surveys:
        return []
    survey_ids = [s.id for s in surveys]
    check_rows = (
        (
            await db.execute(
                select(HouseholdVisitCheck)
                .where(HouseholdVisitCheck.survey_id.in_(survey_ids))
                .order_by(HouseholdVisitCheck.created_at, HouseholdVisitCheck.id)
            )
        )
        .scalars()
        .all()
    )
    checks_by_survey: dict[str, list[HouseholdVisitCheck]] = {}
    for check in check_rows:
        if check.survey_id:
            checks_by_survey.setdefault(check.survey_id, []).append(check)
    return [
        HouseholdSurveyResponse(
            id=survey.id,
            household_id=survey.household_id,
            answers=survey.answers,
            consent_obtained=survey.consent_obtained,
            visited_at=survey.visited_at,
            created_at=survey.created_at,
            member_checks=[MemberCheckResponse.model_validate(check) for check in checks_by_survey.get(survey.id, [])],
        )
        for survey in surveys
    ]


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

    member_ids = {c.beneficiary_id for c in payload.member_checks if c.beneficiary_id}
    if member_ids:
        known = set(
            (
                await db.execute(
                    select(Beneficiary.id).where(
                        Beneficiary.id.in_(member_ids),
                        Beneficiary.household_id == household.id,
                    )
                )
            )
            .scalars()
            .all()
        )
        unknown = sorted(member_ids - known)
        if unknown:
            raise ConflictError(f"Member(s) not part of this household: {', '.join(unknown)}")

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
    for check in payload.member_checks:
        db.add(
            HouseholdVisitCheck(
                household_id=household.id,
                survey_id=survey.id,
                beneficiary_id=check.beneficiary_id,
                check_type=check.check_type,
                result=check.result,
                notes=check.notes,
                visited_at=payload.visited_at,
                created_by=user.id,
            )
        )
    await db.flush()
    await log_action(
        db,
        user.id,
        "household_survey_created",
        "household_survey",
        survey.id,
        new_values={
            "household_id": household.id,
            "member_checks": len(payload.member_checks),
        },
    )

    open_tasks = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.household_id == household.id,
                    ASHATask.status.in_(OPEN_TASK_STATUSES),
                )
            )
        )
        .scalars()
        .all()
    )
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
    return (await _survey_responses(db, [survey]))[0]


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
    return await _survey_responses(db, list(result.scalars().all()))
