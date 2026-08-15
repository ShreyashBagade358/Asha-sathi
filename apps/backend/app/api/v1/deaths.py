from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.death import DeathReport
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import DeathReportCreate, DeathReportResponse, DeathReportUpdate
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=PaginatedResponse[DeathReportResponse])
async def list_death_reports(
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(DeathReport)
    if status:
        stmt = stmt.where(DeathReport.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(DeathReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([DeathReportResponse.model_validate(d) for d in result.scalars().all()], total, page, page_size)


@router.post("", response_model=DeathReportResponse, status_code=201)
async def create_death_report(
    payload: DeathReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    report = DeathReport(**payload.model_dump(), reported_by=user.id, reported_at=datetime.now(UTC))
    db.add(report)
    await db.flush()
    await log_action(db, user.id, "death_report_created", "death_report", report.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/{report_id}", response_model=DeathReportResponse)
async def get_death_report(
    report_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    report = await db.get(DeathReport, report_id)
    if not report:
        raise NotFoundError("Death report not found")
    return report


@router.put("/{report_id}", response_model=DeathReportResponse)
async def update_death_report(
    report_id: str,
    payload: DeathReportUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    report = await db.get(DeathReport, report_id)
    if not report:
        raise NotFoundError("Death report not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "death_report_updated", "death_report", report.id, old_values=report.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(report, key, value)
    await db.commit()
    await db.refresh(report)
    return report


@router.delete("/{report_id}", response_model=MessageResponse)
async def delete_death_report(
    report_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    report = await db.get(DeathReport, report_id)
    if not report:
        raise NotFoundError("Death report not found")
    await db.delete(report)
    await db.commit()
    return MessageResponse(message="Death report deleted")
