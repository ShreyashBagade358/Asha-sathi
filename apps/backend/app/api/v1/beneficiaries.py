from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.abha import ABHARecord
from app.models.admin import Village
from app.models.beneficiary import Beneficiary, Household
from app.models.user import User
from app.schemas.beneficiary import (
    BeneficiaryCreate,
    BeneficiaryResponse,
    BeneficiaryUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import ABHAResponse
from app.services.audit import log_action

router = APIRouter()


async def _hydrate_beneficiaries(db: AsyncSession, beneficiaries: list[Beneficiary]) -> list[BeneficiaryResponse]:
    hh_ids = [b.household_id for b in beneficiaries if b.household_id]
    lookup: dict[str, tuple[Household, str]] = {}
    if hh_ids:
        rows = (
            await db.execute(
                select(Household, Village.name)
                .join(Village, Village.id == Household.village_id)
                .where(Household.id.in_(hh_ids))
            )
        ).all()
        lookup = {h.id: (h, vname) for h, vname in rows}
    out: list[BeneficiaryResponse] = []
    for b in beneficiaries:
        data = BeneficiaryResponse.model_validate(b).model_dump()
        hh = lookup.get(b.household_id or "")
        if hh:
            data["village_id"] = hh[0].village_id
            data["village"] = hh[1]
            data["asha_id"] = hh[0].asha_id
        out.append(BeneficiaryResponse(**data))
    return out


@router.get("", response_model=PaginatedResponse[BeneficiaryResponse])
async def search_beneficiaries(
    q: str = Query(None),
    gender: str = Query(None),
    status: str = Query(None),
    village_id: str = Query(None),
    village: str = Query(None),
    abha_id: str = Query(None),
    has_abha: bool = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Beneficiary)
    if q:
        stmt = stmt.where(
            or_(
                Beneficiary.full_name.ilike(f"%{q}%"),
                Beneficiary.beneficiary_id.ilike(f"%{q}%"),
                Beneficiary.phone.ilike(f"%{q}%"),
            )
        )
    if gender:
        stmt = stmt.where(Beneficiary.gender == gender)
    if status:
        stmt = stmt.where(Beneficiary.status == status)
    if abha_id:
        stmt = stmt.where(Beneficiary.abha_id == abha_id)
    if has_abha is not None:
        stmt = stmt.where(Beneficiary.abha_id.is_not(None)) if has_abha else stmt.where(Beneficiary.abha_id.is_(None))
    if village_id:
        stmt = stmt.where(Beneficiary.household_id.in_(select(Household.id).where(Household.village_id == village_id)))
    if village:
        stmt = stmt.where(
            Beneficiary.household_id.in_(
                select(Household.id).where(
                    Household.village_id.in_(select(Village.id).where(Village.name == village))
                )
            )
        )
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Beneficiary.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = await _hydrate_beneficiaries(db, result.scalars().all())
    return paginate(items, total, page, page_size)


@router.post("", response_model=BeneficiaryResponse, status_code=201)
async def create_beneficiary(
    payload: BeneficiaryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    existing = (
        await db.execute(select(Beneficiary).where(Beneficiary.beneficiary_id == payload.beneficiary_id))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Beneficiary with this id already exists")
    beneficiary = Beneficiary(**payload.model_dump(), registered_by=user.id)
    db.add(beneficiary)
    await db.flush()
    await log_action(db, user.id, "beneficiary_created", "beneficiary", beneficiary.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(beneficiary)
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


@router.get("/{beneficiary_id}", response_model=BeneficiaryResponse)
async def get_beneficiary(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


@router.put("/{beneficiary_id}", response_model=BeneficiaryResponse)
async def update_beneficiary(
    beneficiary_id: str,
    payload: BeneficiaryUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db,
        user.id,
        "beneficiary_updated",
        "beneficiary",
        beneficiary.id,
        old_values=beneficiary.to_dict(),
        new_values=data,
    )
    for key, value in data.items():
        setattr(beneficiary, key, value)
    await db.commit()
    await db.refresh(beneficiary)
    return (await _hydrate_beneficiaries(db, [beneficiary]))[0]


@router.delete("/{beneficiary_id}", response_model=MessageResponse)
async def delete_beneficiary(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    beneficiary.status = "inactive"
    await db.commit()
    return MessageResponse(message="Beneficiary marked inactive")


@router.get("/{beneficiary_id}/timeline")
async def get_beneficiary_timeline(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    beneficiary = result.scalar_one_or_none()
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    from app.models.child import Child, GrowthRecord, HBNCVisit, HBYCVisit, Immunization
    from app.models.death import DeathReport
    from app.models.maternal import ANCVISIT, DeliveryOutcome, PNCVisit, Pregnancy

    events: list[dict] = []

    def _append(model_cls: type[Any], rows: Any) -> None:
        for row in rows:
            events.append(
                {"type": model_cls.__name__, "date": row.created_at.isoformat(), "record": row.to_dict()}
            )

    pregnancies = (
        await db.execute(select(Pregnancy).where(Pregnancy.beneficiary_id == beneficiary.id))
    ).scalars().all()
    for pregnancy in pregnancies:
        _append(Pregnancy, [pregnancy])
        for model in [ANCVISIT, PNCVisit, DeliveryOutcome]:
            rows = (
                await db.execute(
                    select(model).where(model.pregnancy_id == pregnancy.id).order_by(model.created_at)
                )
            ).scalars()
            _append(model, rows)

    rows = (
        await db.execute(select(DeathReport).where(DeathReport.beneficiary_id == beneficiary.id))
    ).scalars()
    _append(DeathReport, rows)

    child = (await db.execute(select(Child).where(Child.beneficiary_id == beneficiary.id))).scalar_one_or_none()
    if child:
        child_models: list[Any] = [Immunization, HBNCVisit, HBYCVisit, GrowthRecord]
        for model in child_models:
            rows = (
                await db.execute(select(model).where(model.child_id == child.id).order_by(model.created_at))
            ).scalars()
            for row in rows:
                events.append({"type": model.__name__, "date": row.created_at.isoformat(), "record": row.to_dict()})

    events.sort(key=lambda e: e["date"])
    return {"beneficiary_id": beneficiary.id, "events": events}


@router.get("/{beneficiary_id}/abha", response_model=ABHAResponse)
async def get_beneficiary_abha(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(ABHARecord).where(ABHARecord.beneficiary_id == beneficiary_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("No ABHA record found for beneficiary")
    return record
