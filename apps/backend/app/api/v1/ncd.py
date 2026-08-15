from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.ncd import NCDScreening
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import NCDScreeningCreate, NCDScreeningResponse
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NCDScreeningResponse])
async def list_ncd_screenings(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(NCDScreening)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(NCDScreening.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([NCDScreeningResponse.model_validate(n) for n in result.scalars().all()], total, page, page_size)


@router.post("", response_model=NCDScreeningResponse, status_code=201)
async def create_ncd_screening(
    payload: NCDScreeningCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    screening = NCDScreening(**payload.model_dump(), recorded_by=user.id)
    db.add(screening)
    await db.flush()
    await log_action(
        db, user.id, "ncd_screening_created", "ncd_screening", screening.id, new_values=payload.model_dump()
    )
    await db.commit()
    await db.refresh(screening)
    return screening


@router.get("/due", response_model=list[NCDScreeningResponse])
async def list_due_screenings(
    from_date: date = Query(default=...),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Beneficiaries aged 30+ who need screening (CBAC due list)."""
    result = await db.execute(
        select(Beneficiary)
        .where(
            Beneficiary.age_years.is_not(None),
            Beneficiary.age_years >= 30,
            Beneficiary.status == "active",
            Beneficiary.id.notin_(select(NCDScreening.beneficiary_id).where(NCDScreening.screening_date >= from_date)),
        )
        .limit(100)
    )
    beneficiaries = result.scalars().all()
    return [
        NCDScreeningResponse(
            id="",
            beneficiary_id=b.id,
            screening_date=date.today(),
            cbac_score=None,
            diabetes_risk=None,
            hypertension_risk=None,
            cardiovascular_risk=None,
            cancer_risk=None,
            referral_made=False,
        )
        for b in beneficiaries
    ]


@router.get("/{screening_id}", response_model=NCDScreeningResponse)
async def get_ncd_screening(
    screening_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    screening = await db.get(NCDScreening, screening_id)
    if not screening:
        raise NotFoundError("NCD screening not found")
    return screening


@router.delete("/{screening_id}", response_model=MessageResponse)
async def delete_ncd_screening(
    screening_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    screening = await db.get(NCDScreening, screening_id)
    if not screening:
        raise NotFoundError("NCD screening not found")
    await db.delete(screening)
    await db.commit()
    return MessageResponse(message="NCD screening deleted")
