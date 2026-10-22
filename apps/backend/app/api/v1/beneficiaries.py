from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.abha import ABHARecord
from app.models.admin import PHC, SubCenter, Village
from app.models.beneficiary import Beneficiary, Household
from app.models.user import User
from app.schemas.beneficiary import (
    BeneficiaryCreate,
    BeneficiaryPhotoResponse,
    BeneficiaryResponse,
    BeneficiaryUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import ABHAResponse
from app.services import images
from app.services import storage as storage_svc
from app.services.audit import log_action

router = APIRouter()


async def _get_beneficiary_or_none(db: AsyncSession, beneficiary_id: str) -> Beneficiary | None:
    result = await db.execute(
        select(Beneficiary).where(or_(Beneficiary.id == beneficiary_id, Beneficiary.beneficiary_id == beneficiary_id))
    )
    return result.scalar_one_or_none()


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


@router.get("/stats")
async def beneficiary_stats(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    total = (await db.execute(select(func.count(Beneficiary.id)))).scalar_one()
    pregnant = (
        (await db.execute(select(func.count(Beneficiary.id)).where(Beneficiary.is_pregnant.is_(True)))).scalar_one()
    )

    bens = (await db.execute(select(Beneficiary))).scalars().all()
    hh_ids = {b.household_id for b in bens if b.household_id}
    meta_villages = {b.village for b in bens if b.village}
    hh_village_ids: set[str] = set()
    if hh_ids:
        hh_village_ids = set(
            (await db.execute(select(Household.village_id).where(Household.id.in_(hh_ids)))).scalars()
        )
    linked_villages = set()
    if hh_village_ids:
        linked_villages = set(
            (await db.execute(select(Village.name).where(Village.id.in_(hh_village_ids)))).scalars()
        )
    villages = sorted(linked_villages | meta_villages)

    phc_rows = []
    if hh_village_ids:
        phc_rows = (
            await db.execute(
                select(PHC.id, PHC.name)
                .join(SubCenter, SubCenter.phc_id == PHC.id)
                .where(SubCenter.id.in_(select(Village.sub_center_id).where(Village.id.in_(hh_village_ids))))
                .order_by(PHC.name)
            )
        ).all()

    return {
        "total": total,
        "pregnant": pregnant,
        "villages": villages,
        "phcs": [{"id": r[0], "name": r[1]} for r in phc_rows],
    }


@router.get("", response_model=PaginatedResponse[BeneficiaryResponse])
async def search_beneficiaries(
    q: str = Query(None),
    gender: str = Query(None),
    status: str = Query(None),
    village_id: str = Query(None),
    village: str = Query(None),
    phc_id: str = Query(None),
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
                Beneficiary.abha_id.ilike(f"%{q}%"),
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
            or_(
                Beneficiary.household_id.in_(
                    select(Household.id).where(
                        Household.village_id.in_(select(Village.id).where(Village.name == village))
                    )
                ),
                Beneficiary.metadata_json["village"].as_string() == village,
            )
        )
    if phc_id:
        stmt = stmt.where(
            Beneficiary.household_id.in_(
                select(Household.id).where(
                    Household.village_id.in_(
                        select(Village.id).where(
                            Village.sub_center_id.in_(select(SubCenter.id).where(SubCenter.phc_id == phc_id))
                        )
                    )
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

    def _append(model_cls: type[Any], rows: Any, when: Any = None) -> None:
        for row in rows:
            stamp = when(row) if when else row.created_at
            events.append(
                {"type": model_cls.__name__, "date": (stamp or row.created_at).isoformat(), "record": row.to_dict()}
            )

    pregnancies = (
        (await db.execute(select(Pregnancy).where(Pregnancy.beneficiary_id == beneficiary.id))).scalars().all()
    )
    for pregnancy in pregnancies:
        _append(Pregnancy, [pregnancy])
        for model in [ANCVISIT, PNCVisit, DeliveryOutcome]:
            rows = (
                await db.execute(select(model).where(model.pregnancy_id == pregnancy.id).order_by(model.created_at))
            ).scalars()
            _append(model, rows)

    rows = (await db.execute(select(DeathReport).where(DeathReport.beneficiary_id == beneficiary.id))).scalars()
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

    # Everything the ASHA records during visits and check-ups — the patient's
    # lived history, not just the clinical milestones above.
    from app.models.beneficiary import HouseholdVisitCheck
    from app.models.disease import DiseaseCase
    from app.models.eligible_couple import ECFollowup, EligibleCouple
    from app.models.ncd import NCDScreening
    from app.models.referral import Referral
    from app.models.task import ASHATask

    visit_checks = (
        await db.execute(select(HouseholdVisitCheck).where(HouseholdVisitCheck.beneficiary_id == beneficiary.id))
    ).scalars()
    _append(HouseholdVisitCheck, visit_checks, lambda row: row.visited_at)

    screenings = (await db.execute(select(NCDScreening).where(NCDScreening.beneficiary_id == beneficiary.id))).scalars()
    _append(NCDScreening, screenings, lambda row: row.screening_date)

    diseases = (await db.execute(select(DiseaseCase).where(DiseaseCase.beneficiary_id == beneficiary.id))).scalars()
    _append(DiseaseCase, diseases, lambda row: row.diagnosis_date)

    referrals = (await db.execute(select(Referral).where(Referral.beneficiary_id == beneficiary.id))).scalars()
    _append(Referral, referrals, lambda row: row.initiated_at)

    ec_ids = (
        (await db.execute(select(EligibleCouple.id).where(EligibleCouple.wife_id == beneficiary.id))).scalars().all()
    )
    if ec_ids:
        followups = (
            await db.execute(select(ECFollowup).where(ECFollowup.ec_id.in_(ec_ids)).order_by(ECFollowup.created_at))
        ).scalars()
        _append(ECFollowup, followups, lambda row: row.followup_date)

    # Completed ASHA visits: the record of the worker actually showing up.
    completed_visits = (
        await db.execute(
            select(ASHATask).where(
                ASHATask.beneficiary_id == beneficiary.id,
                ASHATask.status == "completed",
            )
        )
    ).scalars()
    _append(ASHATask, completed_visits, lambda row: row.completed_time)

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


@router.post("/{beneficiary_id}/photo", response_model=BeneficiaryPhotoResponse)
async def upload_beneficiary_photo(
    beneficiary_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Attach a profile photo to a beneficiary (any authenticated caller)."""
    beneficiary = await _get_beneficiary_or_none(db, beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    data, ext = await images.read_image(file)
    photo_url = await storage_svc.upload(
        f"beneficiaries/{beneficiary_id}.{ext}",
        data,
        content_type=file.content_type or "image/jpeg",
    )
    beneficiary.photo_url = photo_url
    await log_action(
        db,
        user.id,
        "beneficiary_photo_uploaded",
        "beneficiary",
        beneficiary.id,
        new_values={"photo_url": photo_url},
    )
    await db.commit()
    return BeneficiaryPhotoResponse(photo_url=photo_url)


@router.delete("/{beneficiary_id}/photo", response_model=MessageResponse)
async def delete_beneficiary_photo(
    beneficiary_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await _get_beneficiary_or_none(db, beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    if beneficiary.photo_url:
        parsed = storage_svc.bucket_and_path_from_url(beneficiary.photo_url)
        if parsed:
            storage_svc.delete(parsed[1], bucket=parsed[0])
    beneficiary.photo_url = None
    await log_action(db, user.id, "beneficiary_photo_deleted", "beneficiary", beneficiary.id)
    await db.commit()
    return MessageResponse(message="Photo removed")
