from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.child import Child, GrowthRecord, HBNCVisit, HBYCVisit, Immunization
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.health import (
    ChildCreate,
    ChildResponse,
    GrowthRecordCreate,
    GrowthRecordResponse,
    HBNCVisitCreate,
    HBNCVisitResponse,
    HBYCVisitCreate,
    HBYCVisitResponse,
    ImmunizationCreate,
    ImmunizationResponse,
    ImmunizationStatusUpdate,
)
from app.services.audit import log_action

router = APIRouter()


async def _get_child(db: AsyncSession, child_id: str) -> Child:
    child = await db.get(Child, child_id)
    if not child:
        raise NotFoundError("Child not found")
    return child


@router.get("", response_model=PaginatedResponse[ChildResponse])
async def list_children(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Child)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Child.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate([ChildResponse.model_validate(c) for c in result.scalars().all()], total, page, page_size)


@router.post("", response_model=ChildResponse, status_code=201)
async def create_child(
    payload: ChildCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    existing = (
        await db.execute(select(Child).where(Child.beneficiary_id == payload.beneficiary_id))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("A child record already exists for this beneficiary")
    child = Child(**payload.model_dump())
    db.add(child)
    await db.flush()
    await log_action(db, user.id, "child_created", "child", child.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(child)
    return child


@router.get("/{child_id}", response_model=ChildResponse)
async def get_child(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    return await _get_child(db, child_id)


@router.delete("/{child_id}", response_model=MessageResponse)
async def delete_child(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    child = await _get_child(db, child_id)
    await db.delete(child)
    await db.commit()
    return MessageResponse(message="Child record deleted")


@router.get("/{child_id}/immunizations", response_model=list[ImmunizationResponse])
async def list_immunizations(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    result = await db.execute(
        select(Immunization).where(Immunization.child_id == child_id).order_by(Immunization.due_date)
    )
    return [ImmunizationResponse.model_validate(i) for i in result.scalars().all()]


@router.post("/{child_id}/immunizations", response_model=ImmunizationResponse, status_code=201)
async def create_immunization(
    child_id: str,
    payload: ImmunizationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    imm = Immunization(**payload.model_dump(exclude={"child_id"}), child_id=child_id, recorded_by=user.id)
    db.add(imm)
    await db.flush()
    await log_action(db, user.id, "immunization_created", "immunization", imm.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(imm)
    return imm


@router.put("/immunizations/{immunization_id}", response_model=ImmunizationResponse)
async def update_immunization_status(
    immunization_id: str,
    payload: ImmunizationStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    imm = await db.get(Immunization, immunization_id)
    if not imm:
        raise NotFoundError("Immunization record not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "immunization_updated", "immunization", imm.id, old_values=imm.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(imm, key, value)
    await db.commit()
    await db.refresh(imm)
    return imm


@router.post("/{child_id}/hbnc", response_model=HBNCVisitResponse, status_code=201)
async def add_hbnc_visit(
    child_id: str,
    payload: HBNCVisitCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    visit = HBNCVisit(**payload.model_dump(), child_id=child_id, recorded_by=user.id)
    db.add(visit)
    await db.flush()
    await log_action(db, user.id, "hbnc_visit_created", "hbnc_visit", visit.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(visit)
    return visit


@router.get("/{child_id}/hbnc", response_model=list[HBNCVisitResponse])
async def list_hbnc_visits(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    result = await db.execute(select(HBNCVisit).where(HBNCVisit.child_id == child_id).order_by(HBNCVisit.visit_date))
    return [HBNCVisitResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/{child_id}/hbyc", response_model=HBYCVisitResponse, status_code=201)
async def add_hbyc_visit(
    child_id: str,
    payload: HBYCVisitCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    visit = HBYCVisit(**payload.model_dump(), child_id=child_id, recorded_by=user.id)
    db.add(visit)
    await db.flush()
    await log_action(db, user.id, "hbyc_visit_created", "hbyc_visit", visit.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(visit)
    return visit


@router.get("/{child_id}/hbyc", response_model=list[HBYCVisitResponse])
async def list_hbyc_visits(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    result = await db.execute(select(HBYCVisit).where(HBYCVisit.child_id == child_id).order_by(HBYCVisit.visit_date))
    return [HBYCVisitResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/{child_id}/growth", response_model=GrowthRecordResponse, status_code=201)
async def add_growth_record(
    child_id: str,
    payload: GrowthRecordCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    record = GrowthRecord(**payload.model_dump(), child_id=child_id, recorded_by=user.id)
    db.add(record)
    await db.flush()
    await log_action(db, user.id, "growth_record_created", "growth_record", record.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{child_id}/growth", response_model=list[GrowthRecordResponse])
async def list_growth_records(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_child(db, child_id)
    result = await db.execute(
        select(GrowthRecord).where(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date)
    )
    return [GrowthRecordResponse.model_validate(r) for r in result.scalars().all()]
