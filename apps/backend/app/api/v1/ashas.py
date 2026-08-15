from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import get_password_hash
from app.models.admin import Village
from app.models.audit import SyncLog
from app.models.beneficiary import Household
from app.models.incentive import IncentiveClaim
from app.models.task import ASHAKPI, ASHATask
from app.models.user import ASHAProfile, Role, User
from app.schemas.beneficiary import HouseholdResponse
from app.schemas.common import PaginatedResponse, paginate
from app.schemas.other_domain import (
    ASHAKPIResponse,
    ASHATaskResponse,
    IncentiveClaimCreate,
    IncentiveClaimResponse,
)
from app.schemas.user import (
    ASHAAssignVillages,
    ASHACreate,
    ASHADetailResponse,
    ASHAProfileCreate,
    ASHAProfileResponse,
    ASHAProfileUpdate,
    ASHAUpdate,
    ASHAUserResponse,
)
from app.services.audit import log_action
from app.services.incentive_calc import calculate_claim

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
    _: User = Depends(require_roles(Role.ANM, Role.MOIC, Role.BPM, Role.DPM, Role.STATE_ADMIN, Role.SUPER_ADMIN)),
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
    if user.role in (Role.STATE_ADMIN.value, Role.SUPER_ADMIN.value):
        return stmt
    if user.district_id:
        return stmt.where(User.district_id == user.district_id)
    if user.block_id:
        return stmt.where(User.block_id == user.block_id)
    if user.phc_id:
        return stmt.where(User.phc_id == user.phc_id)
    return stmt


def _build_asha_user_response(user: User, profile: ASHAProfile, village_name: str | None, households: int, last_sync_at) -> ASHAUserResponse:
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
    q: str | None = Query(None),
    village: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
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
    if village:
        stmt = stmt.where(Village.name == village)
    if status in ("active", "inactive"):
        stmt = stmt.where(User.is_active == (status == "active"))

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


@router.post("", response_model=ASHAUserResponse, status_code=201)
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
    if payload.village:
        village = (
            await db.execute(select(Village).where(Village.name == payload.village))
        ).scalar_one_or_none()
        village_id = village.id if village else None
    new_user = User(
        role=Role.ASHA.value,
        state_id=user.state_id,
        district_id=user.district_id,
        block_id=user.block_id,
        phc_id=user.phc_id,
        sub_center_id=user.sub_center_id,
        village_id=village_id,
        phone=payload.phone,
        full_name=payload.name,
        is_active=payload.status != "inactive",
        hashed_password=get_password_hash(f"dev-{payload.phone}"),
    )
    db.add(new_user)
    await db.flush()
    profile = ASHAProfile(
        user_id=new_user.id,
        asha_id=f"ASH-{new_user.id[:8].upper()}",
        catchment_villages=[village_id] if village_id else None,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(new_user)
    await db.refresh(profile)
    return _build_asha_user_response(new_user, profile, payload.village, 0, None)


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
    names = [v.strip() for v in payload.villages if v and v.strip()]
    ids: list[str] = []
    if names:
        found = (
            await db.execute(select(Village.id).where(Village.name.in_(names)))
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
