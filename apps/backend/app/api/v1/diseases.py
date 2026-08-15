from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.disease import DiseaseCase, MalariaCase, TBCase
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import DiseaseCaseCreate, DiseaseCaseResponse
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=PaginatedResponse[DiseaseCaseResponse])
async def list_disease_cases(
    disease_type: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(DiseaseCase)
    if disease_type:
        stmt = stmt.where(DiseaseCase.disease_type == disease_type)
    if status:
        stmt = stmt.where(DiseaseCase.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(DiseaseCase.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([DiseaseCaseResponse.model_validate(d) for d in result.scalars().all()], total, page, page_size)


@router.post("", response_model=DiseaseCaseResponse, status_code=201)
async def create_disease_case(
    payload: DiseaseCaseCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    case = DiseaseCase(**payload.model_dump(), recorded_by=user.id)
    db.add(case)
    await db.flush()
    if payload.disease_type.lower() in ("malaria", "tb", "tuberculosis"):
        sub = (
            MalariaCase(disease_case_id=case.id)
            if payload.disease_type.lower() == "malaria"
            else TBCase(disease_case_id=case.id)
        )
        db.add(sub)
    await log_action(db, user.id, "disease_case_created", "disease_case", case.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(case)
    return case


@router.get("/outbreaks")
async def get_outbreaks(
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Group disease cases by village + disease_type for the given window."""
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(
            DiseaseCase.village_id,
            DiseaseCase.disease_type,
            func.count(DiseaseCase.id).label("case_count"),
        )
        .where(DiseaseCase.detection_date >= since, DiseaseCase.village_id.is_not(None))
        .group_by(DiseaseCase.village_id, DiseaseCase.disease_type)
        .order_by(func.count(DiseaseCase.id).desc())
    )
    rows = result.all()
    outbreaks = [
        {
            "village_id": row.village_id,
            "disease_type": row.disease_type,
            "count": row.case_count,
            "alert": row.case_count >= 3,
            "window_days": days,
        }
        for row in rows
    ]
    return {"since": since.isoformat(), "outbreaks": outbreaks}


@router.get("/{case_id}", response_model=DiseaseCaseResponse)
async def get_disease_case(
    case_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    case = await db.get(DiseaseCase, case_id)
    if not case:
        raise NotFoundError("Disease case not found")
    return case


@router.put("/{case_id}", response_model=DiseaseCaseResponse)
async def update_disease_case(
    case_id: str,
    payload: DiseaseCaseCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    case = await db.get(DiseaseCase, case_id)
    if not case:
        raise NotFoundError("Disease case not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "disease_case_updated", "disease_case", case.id, old_values=case.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(case, key, value)
    await db.commit()
    await db.refresh(case)
    return case


@router.delete("/{case_id}", response_model=MessageResponse)
async def delete_disease_case(
    case_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    case = await db.get(DiseaseCase, case_id)
    if not case:
        raise NotFoundError("Disease case not found")
    await db.delete(case)
    await db.commit()
    return MessageResponse(message="Disease case deleted")


@router.get("/outbreaks")
async def get_outbreaks(
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Group disease cases by village + disease_type for the given window."""
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(
            DiseaseCase.village_id,
            DiseaseCase.disease_type,
            func.count(DiseaseCase.id).label("case_count"),
        )
        .where(DiseaseCase.detection_date >= since, DiseaseCase.village_id.is_not(None))
        .group_by(DiseaseCase.village_id, DiseaseCase.disease_type)
        .order_by(func.count(DiseaseCase.id).desc())
    )
    rows = result.all()
    outbreaks = [
        {
            "village_id": row.village_id,
            "disease_type": row.disease_type,
            "count": row.case_count,
            "alert": row.case_count >= 3,
            "window_days": days,
        }
        for row in rows
    ]
    return {"since": since.isoformat(), "outbreaks": outbreaks}
