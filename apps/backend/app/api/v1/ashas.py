import hashlib
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import generate_asha_password, get_password_hash
from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.audit import SyncLog
from app.models.beneficiary import Beneficiary, Household
from app.models.incentive import IncentiveClaim
from app.models.task import ASHAKPI, ASHATask
from app.models.user import ASHAProfile, Role, User
from app.schemas.beneficiary import HouseholdResponse
from app.schemas.common import PaginatedResponse, paginate
from app.schemas.other_domain import (
    ASHAKPIResponse,
    ASHATaskCreate,
    ASHATaskResponse,
    ASHATaskUpdate,
    IncentiveClaimCreate,
    IncentiveClaimResponse,
)
from app.schemas.user import (
    ASHAAssignVillages,
    ASHACreate,
    ASHACreateResponse,
    ASHADetailResponse,
    ASHAProfileCreate,
    ASHAProfileResponse,
    ASHAProfileUpdate,
    ASHAUpdate,
    ASHAUserResponse,
)
from app.services.audit import log_action
from app.services.incentive_calc import calculate_claim
from app.services.sync_scope import resolve_scope
from app.services.task_plan import generate_daily_plan, pending_first_order, plan_today

router = APIRouter()


@router.get("/me/profile", response_model=ASHAProfileResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    profile = (
        await db.execute(select(ASHAProfile).where(ASHAProfile.user_id == user.id))
    ).scalar_one_or_none()
    if not profile:
        raise NotFoundError("ASHA profile not found")
    return profile


@router.put("/me/profile", response_model=ASHAProfileResponse)
async def update_my_profile(
    payload: ASHAProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    profile = (
        await db.execute(select(ASHAProfile).where(ASHAProfile.user_id == user.id))
    ).scalar_one_or_none()
    if not profile:
        raise NotFoundError("ASHA profile not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.post("/me/profile", response_model=ASHAProfileResponse, status_code=201)
async def create_my_profile(
    payload: ASHAProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    existing = (
        await db.execute(select(ASHAProfile).where(ASHAProfile.user_id == user.id))
    ).scalar_one_or_none()
    if existing:
        for key, value in payload.model_dump(exclude_unset=True, exclude={"asha_id"}).items():
            setattr(existing, key, value)
        await db.commit()
        await db.refresh(existing)
        return existing
    profile = ASHAProfile(user_id=user.id, **payload.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/me/catchment", response_model=list[HouseholdResponse])
async def get_my_catchment(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Household).where(Household.asha_id == user.id).order_by(Household.created_at))
    return [HouseholdResponse.model_validate(h) for h in result.scalars().all()]


@router.get("/me/kpis", response_model=PaginatedResponse[ASHAKPIResponse])
async def get_my_kpis(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    stmt = select(ASHAKPI).where(ASHAKPI.asha_id == user.id)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(ASHAKPI.period_start.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([ASHAKPIResponse.model_validate(k) for k in result.scalars().all()], total, page, page_size)


@router.get("/me/work-plan", response_model=PaginatedResponse[ASHATaskResponse])
async def get_my_work_plan(
    status: str = Query("pending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    stmt = select(ASHATask).where(ASHATask.asha_id == user.id, ASHATask.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(ASHATask.task_date).offset((page - 1) * page_size).limit(page_size))
    return paginate([ASHATaskResponse.model_validate(t) for t in result.scalars().all()], total, page, page_size)


# ---------------------------------------------------------------------------
# ASHA task REST (the worker's own to-do list)
# ---------------------------------------------------------------------------
@router.get("/me/tasks", response_model=list[ASHATaskResponse])
async def list_my_tasks(
    status: str | None = Query(None),
    day: date | None = Query(
        None,
        alias="date",
        description="Plan day (YYYY-MM-DD). Asking for today builds that day's visit plan first.",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """The worker's own task list.

    Passing today's date lazily generates the day's plan (carry-over first,
    then up to five new visits) so no scheduler has to run at midnight.
    """
    if day is not None and day == plan_today():
        try:
            await generate_daily_plan(db, user.id, day)
        except IntegrityError:
            # A concurrent tab/device built the same plan first — its commit
            # wins, we simply read the result.
            await db.rollback()

    # Build scope for this ASHA (same logic as households sync scope)
    scope = await resolve_scope(db, user)
    
    stmt = (
        select(ASHATask, Household.hhid, Village.name)
        .outerjoin(Household, Household.id == ASHATask.household_id)
        .outerjoin(Village, Village.id == func.coalesce(ASHATask.village_id, Household.village_id))
    )
    
    # ASHA sees tasks assigned to them OR tasks for households in their scope
    if scope.household_ids:
        stmt = stmt.where(
            or_(ASHATask.asha_id == user.id, ASHATask.household_id.in_(scope.household_ids))
        )
    else:
        stmt = stmt.where(ASHATask.asha_id == user.id)
    if day is not None:
        stmt = stmt.where(ASHATask.task_date == day)
    if status:
        stmt = stmt.where(ASHATask.status == status)
    else:
        # Cancelled rows (superseded duplicates the plan cleaned up) are not
        # work — they stay out of the queue unless explicitly asked for.
        stmt = stmt.where(ASHATask.status != "cancelled")

    result = await db.execute(stmt.order_by(*pending_first_order()))
    items: list[ASHATaskResponse] = []
    for task, household_hhid, village_name in result.all():
        item = ASHATaskResponse.model_validate(task).model_dump()
        item["household_hhid"] = household_hhid
        item["village_name"] = village_name
        items.append(ASHATaskResponse(**item))
    return items


async def _asha_can_access_task_target(
    db: AsyncSession,
    user: User,
    household_id: str | None,
    village_id: str | None,
    beneficiary_id: str | None,
) -> bool:
    """Check if ASHA can create tasks for the given target.
    
    ASHA can create tasks for:
    - Households they directly own (Household.asha_id == user.id)
    - Households in their catchment villages (from ASHAProfile.catchment_villages)
    - Beneficiaries in their households
    - Villages in their catchment
    """
    if user.role != "asha":
        return True  # non-ASHAs (admins) can create tasks anywhere
    
    # Get ASHA's catchment villages
    profile = (await db.execute(
        select(ASHAProfile).where(ASHAProfile.user_id == user.id)
    )).scalar_one_or_none()
    catchment_villages = set(profile.catchment_villages or []) if profile else set()
    if user.village_id:
        catchment_villages.add(user.village_id)
    
    # Check household
    if household_id:
        household = await db.get(Household, household_id)
        if not household:
            return False
        if household.asha_id == user.id:
            return True
        if household.village_id and household.village_id in catchment_villages:
            return True
        return False
    
    # Check village directly
    if village_id:
        return village_id in catchment_villages
    
    # Check beneficiary
    if beneficiary_id:
        beneficiary = await db.get(Beneficiary, beneficiary_id)
        if not beneficiary:
            return False
        if beneficiary.household_id:
            household = await db.get(Household, beneficiary.household_id)
            if not household:
                return False
            if household.asha_id == user.id:
                return True
            if household.village_id and household.village_id in catchment_villages:
                return True
        return False
    
    # No target specified - allow (e.g., general task)
    return True
    
    # Check village directly
    if village_id:
        return village_id in catchment_villages
    
    # Check beneficiary
    if beneficiary_id:
        beneficiary = await db.get(Beneficiary, beneficiary_id)
        if not beneficiary:
            return False
        if beneficiary.household_id:
            household = await db.get(Household, beneficiary.household_id)
            if not household:
                return False
            if household.asha_id == user.id:
                return True
            if household.village_id and household.village_id in catchment_villages:
                return True
        return False
    
    # No target specified - allow (e.g., general task)
    return True


@router.post("/me/tasks", response_model=ASHATaskResponse, status_code=201)
async def create_my_task(
    payload: ASHATaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Validate ASHA can create task for the given target
    if not await _asha_can_access_task_target(
        db, user, payload.household_id, payload.village_id, payload.beneficiary_id
    ):
        raise NotFoundError("Cannot create task for this household/village/beneficiary — not in your assigned area")
    
    task = ASHATask(**payload.model_dump(), asha_id=user.id)
    db.add(task)
    try:
        await db.flush()
        await log_action(
            db, user.id, "asha_task_created", "asha_task", task.id, new_values=payload.model_dump()
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("This task is already scheduled for that household and day") from exc
    await db.refresh(task)
    return task


@router.patch("/me/tasks/{task_id}", response_model=ASHATaskResponse)
async def update_my_task(
    task_id: str,
    payload: ASHATaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    task = await db.get(ASHATask, task_id)
    # A task belongs to exactly one worker: someone else's id must look the
    # same as a task that does not exist.
    if not task or task.asha_id != user.id:
        raise NotFoundError("Task not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db,
        user.id,
        "asha_task_updated",
        "asha_task",
        task.id,
        old_values=task.to_dict(),
        new_values=data,
    )
    for key, value in data.items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/me/incentives", response_model=list[IncentiveClaimResponse])
async def get_my_incentives(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(IncentiveClaim).where(IncentiveClaim.asha_id == user.id).order_by(IncentiveClaim.claim_month)
    )
    return [IncentiveClaimResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/me/incentives/claim", response_model=IncentiveClaimResponse)
async def claim_incentive(
    payload: IncentiveClaimCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    month_start = datetime.strptime(payload.claim_month + "-01", "%Y-%m-%d").date()
    result = await db.execute(select(ASHAKPI).where(ASHAKPI.asha_id == user.id, ASHAKPI.period_start == month_start))
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise NotFoundError("No KPI record found for this claim month")
    breakdown = calculate_claim(kpi)
    existing = (
        await db.execute(
            select(IncentiveClaim).where(
                IncentiveClaim.asha_id == user.id, IncentiveClaim.claim_month == payload.claim_month
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.activities = breakdown["activities"]
        existing.total_amount = breakdown["total_amount"]
        claim = existing
    else:
        claim = IncentiveClaim(
            asha_id=user.id,
            claim_month=payload.claim_month,
            claim_period_start=payload.claim_period_start or month_start,
            claim_period_end=payload.claim_period_end,
            activities=breakdown["activities"],
            total_amount=breakdown["total_amount"],
            status="draft",
        )
        db.add(claim)
    await log_action(
        db,
        user.id,
        "incentive_claimed",
        "incentive_claim",
        claim.id,
        new_values={"month": payload.claim_month, "amount": breakdown["total_amount"]},
    )
    await db.commit()
    await db.refresh(claim)
    return claim


@router.get("/{asha_id}/performance", response_model=ASHAKPIResponse)
async def get_asha_performance(
    asha_id: str,
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    start = datetime.strptime(period_start, "%Y-%m-%d").date()
    result = await db.execute(select(ASHAKPI).where(ASHAKPI.asha_id == asha_id, ASHAKPI.period_start == start))
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise NotFoundError("No KPI record found")
    return kpi


# ---------------------------------------------------------------------------
# ASHA directory (admin views)
# ---------------------------------------------------------------------------
def _scope_filter(user: User, stmt):
    """Restrict the directory to what the caller is allowed to see.

    Admins are unrestricted. An ASHA is narrowed to the *narrowest* geography
    they are anchored to, because the directory response carries worker phone
    numbers and household counts — a district-wide view would leak colleagues
    outside their own facility.
    """
    if user.role == Role.ADMIN.value:
        return stmt
    if user.phc_id:
        return stmt.where(User.phc_id == user.phc_id)
    if user.block_id:
        return stmt.where(User.block_id == user.block_id)
    if user.district_id:
        return stmt.where(User.district_id == user.district_id)
    return stmt


def _build_asha_user_response(
    user: User, profile: ASHAProfile, village_name: str | None, households: int, last_sync_at
) -> ASHAUserResponse:
    return ASHAUserResponse(
        id=user.id,
        asha_id=profile.asha_id,
        name=user.full_name,
        village=village_name,
        phone=user.phone,
        assigned_households=households or 0,
        performance_score=profile.performance_score,
        status="active" if user.is_active else "inactive",
        last_sync_at=last_sync_at,
    )


async def _get_asha_profile(db: AsyncSession, asha_code: str) -> ASHAProfile:
    profile = (
        await db.execute(select(ASHAProfile).where(ASHAProfile.asha_id == asha_code))
    ).scalar_one_or_none()
    if not profile:
        raise NotFoundError("ASHA profile not found")
    return profile


async def _village_name_for(db: AsyncSession, user: User) -> str | None:
    if not user.village_id:
        return None
    village = await db.get(Village, user.village_id)
    return village.name if village else None


@router.get("", response_model=PaginatedResponse[ASHAUserResponse])
async def list_ashas(
    q: str = Query(None),
    status: str = Query(None),
    role: str = Query(None),
    phc_id: str = Query(None),
    village: str = Query(None, description="Village id or name — narrows the directory to that catchment"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=1000),
    user: User = Depends(require_roles(Role.ASHA, Role.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """ASHA directory.

    Admins see everyone; an ASHA caller is narrowed to their own
    district/block/PHC by `_scope_filter`, which is what the registration form
    needs to list the workers a patient can be assigned to.
    """
    hh_count = (
        select(func.count(Household.id)).where(Household.asha_id == User.id).correlate(User).scalar_subquery()
    )
    last_sync = (
        select(func.max(SyncLog.completed_at)).where(SyncLog.user_id == User.id).correlate(User).scalar_subquery()
    )
    stmt = (
        select(
            User,
            ASHAProfile,
            Village.name.label("village_name"),
            hh_count.label("assigned_households"),
            last_sync.label("last_sync_at"),
        )
        .join(ASHAProfile, ASHAProfile.user_id == User.id)
        .outerjoin(Village, Village.id == User.village_id)
        .where(User.role == Role.ASHA.value)
    )
    stmt = _scope_filter(user, stmt)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.full_name.ilike(like), ASHAProfile.asha_id.ilike(like), User.phone.ilike(like))
        )
    if status in ("active", "inactive"):
        stmt = stmt.where(User.is_active == (status == "active"))
    if village:
        stmt = stmt.where(or_(User.village_id == village, Village.name == village))

    total = (
        await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    items = [
        _build_asha_user_response(u, p, vname, hh, last)
        for u, p, vname, hh, last in rows
    ]
    return paginate(items, total, page, page_size)


@router.get("/{asha_id}/kpis", response_model=list[ASHAKPIResponse])
async def get_asha_kpis(
    asha_id: str,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    profile = await _get_asha_profile(db, asha_id)
    result = await db.execute(
        select(ASHAKPI)
        .where(ASHAKPI.asha_id == profile.user_id)
        .order_by(ASHAKPI.period_start.desc())
    )
    return [ASHAKPIResponse.model_validate(k) for k in result.scalars().all()]


@router.get("/{asha_id}", response_model=ASHADetailResponse)
async def get_asha_detail(
    asha_id: str,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    profile = await _get_asha_profile(db, asha_id)
    asha_user = await db.get(User, profile.user_id)
    if not asha_user:
        raise NotFoundError("ASHA user not found")
    households = (
        await db.execute(select(func.count(Household.id)).where(Household.asha_id == asha_user.id))
    ).scalar_one()
    last_sync = (
        await db.execute(select(func.max(SyncLog.completed_at)).where(SyncLog.user_id == asha_user.id))
    ).scalar_one()
    village_names: list[str] = []
    if profile.catchment_villages:
        found = (
            await db.execute(select(Village.name).where(Village.id.in_(profile.catchment_villages)))
        ).scalars().all()
        village_names = list(found)
    kpi_result = await db.execute(
        select(ASHAKPI).where(ASHAKPI.asha_id == asha_user.id).order_by(ASHAKPI.period_start.desc())
    )
    return ASHADetailResponse(
        asha=_build_asha_user_response(
            asha_user, profile, await _village_name_for(db, asha_user), households, last_sync
        ),
        kpis=[ASHAKPIResponse.model_validate(k) for k in kpi_result.scalars().all()],
        villages=village_names,
        assigned_beneficiaries=households,
    )


@router.patch("/{asha_id}", response_model=ASHAUserResponse)
async def update_asha(
    asha_id: str,
    payload: ASHAUpdate,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    profile = await _get_asha_profile(db, asha_id)
    asha_user = await db.get(User, profile.user_id)
    if not asha_user:
        raise NotFoundError("ASHA user not found")
    if payload.name is not None:
        asha_user.full_name = payload.name
    if payload.phone is not None:
        dup = (
            await db.execute(select(User).where(User.phone == payload.phone, User.id != asha_user.id))
        ).scalar_one_or_none()
        if dup:
            raise ConflictError("Phone number already in use")
        asha_user.phone = payload.phone
    if payload.status is not None:
        asha_user.is_active = payload.status != "inactive"
    if payload.village is not None:
        village = (
            await db.execute(select(Village).where(Village.name == payload.village))
        ).scalar_one_or_none()
        asha_user.village_id = village.id if village else None
    if payload.performance_score is not None:
        profile.performance_score = payload.performance_score
    await db.commit()
    await db.refresh(asha_user)
    households = (
        await db.execute(select(func.count(Household.id)).where(Household.asha_id == asha_user.id))
    ).scalar_one()
    return _build_asha_user_response(
        asha_user, profile, await _village_name_for(db, asha_user), households, None
    )


async def _geo_from_village(db: AsyncSession, village: Village) -> dict:
    """Resolve the full geo chain for a village.

    The village is the source of truth: sub-centre -> PHC -> block ->
    district -> state are all derived from it, so an ASHA created by a
    district-level admin (no PHC of their own) still lands in the village's
    real PHC instead of inheriting a null one.
    """
    sub_center = await db.get(SubCenter, village.sub_center_id)
    phc = await db.get(PHC, sub_center.phc_id) if sub_center else None
    block = await db.get(Block, phc.block_id) if phc else None
    district = await db.get(District, block.district_id) if block else None
    state = await db.get(State, district.state_id) if district else None
    return {
        "state_id": state.id if state else None,
        "district_id": district.id if district else None,
        "block_id": block.id if block else None,
        "phc_id": phc.id if phc else None,
        "sub_center_id": sub_center.id if sub_center else None,
    }


@router.post("", response_model=ASHACreateResponse, status_code=201)
async def create_asha(
    payload: ASHACreate,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    existing = (
        await db.execute(select(User).where(User.phone == payload.phone))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("A user with this phone number already exists")
    village_id = None
    village_name = payload.village
    village = None
    if payload.village:
        # Match by id or by name, like the sub-centre lookup below: with the
        # full India directory a bare name can be ambiguous (4 duplicated names).
        village = (
            await db.execute(
                select(Village).where(
                    or_(Village.id == payload.village, Village.name == payload.village)
                )
            )
        ).scalars().first()
        if village:
            village_id = village.id
            village_name = village.name
    # The village decides the worker's whole geography (sub-centre -> PHC ->
    # block -> district -> state). A district-level admin with no PHC of their
    # own still lands the worker in the village's real PHC instead of null.
    geo = await _geo_from_village(db, village) if village else {}
    # No village (or a village with no PHC chain): fall back to the PHC the
    # form picked directly, deriving its block/district/state.
    if not geo.get("phc_id") and payload.phc:
        phc_row = (
            await db.execute(
                select(PHC).where(or_(PHC.id == payload.phc, PHC.name == payload.phc))
            )
        ).scalars().first()
        if phc_row:
            block_row = await db.get(Block, phc_row.block_id)
            district_row = await db.get(District, block_row.district_id) if block_row else None
            state_row = await db.get(State, district_row.state_id) if district_row else None
            geo = {
                "state_id": state_row.id if state_row else None,
                "district_id": district_row.id if district_row else None,
                "block_id": block_row.id if block_row else None,
                "phc_id": phc_row.id,
                "sub_center_id": None,
            }
    # The form may name the sub-centre by id or by label; an unknown or absent
    # value falls back to the village's own sub-centre, then the admin's.
    sub_center_id = geo.get("sub_center_id") or user.sub_center_id
    if payload.sub_center:
        sub_center = (
            await db.execute(
                select(SubCenter).where(
                    or_(SubCenter.id == payload.sub_center, SubCenter.name == payload.sub_center)
                )
            )
        ).scalars().first()
        if sub_center:
            sub_center_id = sub_center.id
    password = payload.password or generate_asha_password(payload.phone)
    new_user = User(
        role=Role.ASHA.value,
        state_id=geo.get("state_id") or user.state_id,
        district_id=geo.get("district_id") or user.district_id,
        block_id=geo.get("block_id") or user.block_id,
        phc_id=geo.get("phc_id") or user.phc_id,
        sub_center_id=sub_center_id,
        village_id=village_id,
        phone=payload.phone,
        email=payload.email,
        full_name=payload.name,
        is_active=payload.status != "inactive",
        hashed_password=get_password_hash(password),
    )
    db.add(new_user)
    await db.flush()

    aadhaar_hash = None
    if payload.aadhaar:
        aadhaar_hash = hashlib.sha256(payload.aadhaar.replace(" ", "").encode()).hexdigest()

    profile = ASHAProfile(
        user_id=new_user.id,
        asha_id=f"ASH-{new_user.id[:8].upper()}",
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        date_of_joining=payload.date_of_joining or datetime.now(UTC).date(),
        aadhaar_hash=aadhaar_hash,
        catchment_villages=[village_id] if village_id else None,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(new_user)
    await db.refresh(profile)

    await log_action(
        db,
        user.id,
        "asha_worker_registered",
        "user",
        new_user.id,
    )
    await db.commit()

    created = _build_asha_user_response(new_user, profile, village_name, 0, None)
    # Returned exactly once: only the bcrypt hash is stored.
    return ASHACreateResponse(**created.model_dump(), password=password)


@router.post("/{asha_id}/villages", response_model=ASHAUserResponse)
async def assign_villages(
    asha_id: str,
    payload: ASHAAssignVillages,
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    profile = await _get_asha_profile(db, asha_id)
    asha_user = await db.get(User, profile.user_id)
    if not asha_user:
        raise NotFoundError("ASHA user not found")
    # Ids or names both work (the form sends ids; names stay supported).
    values = [v.strip() for v in payload.villages if v and v.strip()]
    ids: list[str] = []
    if values:
        found = (
            await db.execute(
                select(Village.id).where(or_(Village.id.in_(values), Village.name.in_(values)))
            )
        ).scalars().all()
        ids = list(found)
    profile.catchment_villages = ids
    await db.commit()
    households = (
        await db.execute(select(func.count(Household.id)).where(Household.asha_id == asha_user.id))
    ).scalar_one()
    return _build_asha_user_response(
        asha_user, profile, await _village_name_for(db, asha_user), households, None
    )
