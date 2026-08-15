from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_roles
from app.core.exceptions import NotFoundError
from app.models.death import DeathReport
from app.models.incentive import IncentiveClaim, VillageForm
from app.models.user import Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import DeathReportResponse, IncentiveClaimResponse, VillageFormResponse
from app.services.audit import log_action

router = APIRouter()

VERIFIER = require_roles(Role.ANM, Role.MOIC, Role.BPM, Role.DPM, Role.STATE_ADMIN, Role.SUPER_ADMIN)

ENTITY_MODELS: dict[str, Any] = {
    "death_report": DeathReport,
    "village_form": VillageForm,
    "incentive_claim": IncentiveClaim,
}

ENTITY_SCHEMAS: dict[str, Any] = {
    "death_report": DeathReportResponse,
    "village_form": VillageFormResponse,
    "incentive_claim": IncentiveClaimResponse,
}


@router.get("/pending")
async def list_pending(
    entity: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(VERIFIER),
):
    result: list[dict] = []
    entities = [entity] if entity else list(ENTITY_MODELS.keys())
    for ent in entities:
        model = ENTITY_MODELS.get(ent)
        if not model:
            continue
        rows = (
            (
                await db.execute(
                    select(model).where(model.status.in_(["reported", "submitted", "draft"])).limit(page_size)
                )
            )
            .scalars()
            .all()
        )
        result.extend([{"entity": ent, **row.to_dict()} for row in rows])
    return {"count": len(result), "items": result}


@router.post("/{entity}/{entity_id}/approve", response_model=MessageResponse)
async def approve_record(
    entity: str,
    entity_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(VERIFIER),
):
    return await _review(entity, entity_id, db, user, request, approved=True)


@router.post("/{entity}/{entity_id}/reject", response_model=MessageResponse)
async def reject_record(
    entity: str,
    entity_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(VERIFIER),
):
    return await _review(entity, entity_id, db, user, request, approved=False)


async def _review(entity, entity_id, db, user, request, approved: bool) -> MessageResponse:
    model = ENTITY_MODELS.get(entity)
    if not model:
        raise NotFoundError(f"Unknown entity '{entity}'")
    record = await db.get(model, entity_id)
    if not record:
        raise NotFoundError(f"{entity} not found")
    if approved:
        record.status = "verified"
        record.verified_by = user.id
        record.verified_at = datetime.now(UTC)
        if entity == "incentive_claim":
            record.approved_amount = record.total_amount
    else:
        record.status = "rejected"
        if entity == "incentive_claim":
            record.reviewed_by = user.id
            record.reviewed_at = datetime.now(UTC)
    await log_action(db, user.id, f"{entity}_{'approved' if approved else 'rejected'}", entity, entity_id)
    await db.commit()
    return MessageResponse(message=f"{entity} {record.status}")


@router.get("/{entity}", response_model=PaginatedResponse[dict])
async def list_entity_for_verification(
    entity: str,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(VERIFIER),
):
    model = ENTITY_MODELS.get(entity)
    if not model:
        raise NotFoundError(f"Unknown entity '{entity}'")
    stmt = select(model)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(model.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = [row.to_dict() for row in result.scalars().all()]
    return paginate(items, total, page, page_size)
