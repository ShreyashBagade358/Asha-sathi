from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ValidationError
from app.models import (
    ANCVISIT,
    ASHATask,
    Child,
    DeathReport,
    DeliveryOutcome,
    DiseaseCase,
    ECFollowup,
    EligibleCouple,
    GrowthRecord,
    HBNCVisit,
    HBYCVisit,
    Household,
    Immunization,
    NCDScreening,
    PNCVisit,
    Pregnancy,
    Referral,
    VillageForm,
)
from app.models.audit import SyncLog
from app.models.beneficiary import Beneficiary
from app.models.user import User
from app.schemas.common import MessageResponse, SuccessResponse
from app.schemas.other_domain import (
    SyncConflictResolveRequest,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncStatusResponse,
)
from app.services.audit import log_action
from app.services.sync_service import register_models, upsert_batch

SYNC_TABLES: dict[str, Any] = {
    "households": Household,
    "beneficiaries": Beneficiary,
    "pregnancies": Pregnancy,
    "anc_visits": ANCVISIT,
    "pnc_visits": PNCVisit,
    "delivery_outcomes": DeliveryOutcome,
    "children": Child,
    "immunizations": Immunization,
    "hbnc_visits": HBNCVisit,
    "hbyc_visits": HBYCVisit,
    "growth_records": GrowthRecord,
    "eligible_couples": EligibleCouple,
    "ec_followups": ECFollowup,
    "ncd_screenings": NCDScreening,
    "disease_cases": DiseaseCase,
    "death_reports": DeathReport,
    "asha_tasks": ASHATask,
    "village_forms": VillageForm,
    "referrals": Referral,
}

register_models(SYNC_TABLES)

router = APIRouter()


@router.post("/push", response_model=SuccessResponse)
async def push_records(
    payload: SyncPushRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    sync_log = SyncLog(
        user_id=user.id,
        device_id=payload.device_id,
        app_version=payload.app_version,
        sync_type="push",
        started_at=datetime.now(UTC),
    )
    db.add(sync_log)
    await db.flush()
    pushed = 0
    errors: list[dict] = []
    for table, records in payload.records.items():
        if table not in SYNC_TABLES:
            errors.append({"table": table, "error": "unknown_table"})
            continue
        try:
            result = await upsert_batch(db, table, records)
            pushed += result["pushed"]
        except Exception as exc:
            await db.rollback()
            errors.append({"table": table, "error": str(exc)})
            db.add(sync_log)
    sync_log.records_pushed = pushed
    sync_log.completed_at = datetime.now(UTC)
    sync_log.status = "completed" if not errors else "partial"
    sync_log.errors = errors
    sync_log.duration_ms = 0
    await log_action(db, user.id, "sync_push", "sync", sync_log.id, new_values={"records": pushed})
    await db.commit()
    return SuccessResponse(message=f"Pushed {pushed} records")


@router.post("/pull", response_model=SyncPullResponse)
async def pull_records(
    payload: SyncPullRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result: dict[str, list[dict]] = {}
    tables = payload.tables or list(SYNC_TABLES.keys())
    for table in tables:
        model = SYNC_TABLES.get(table)
        if not model:
            continue
        rows = (
            (await db.execute(select(model).where(model.created_at >= payload.last_pull_at).limit(500))).scalars().all()
        )
        result[table] = [row.to_dict() for row in rows]
    sync_log = SyncLog(
        user_id=user.id,
        device_id=payload.device_id,
        sync_type="pull",
        status="completed",
        records_pulled=sum(len(v) for v in result.values()),
        started_at=payload.last_pull_at,
        completed_at=datetime.now(UTC),
    )
    db.add(sync_log)
    await db.commit()
    return SyncPullResponse(records=result, server_time=datetime.now(UTC))


@router.post("/conflicts/resolve", response_model=MessageResponse)
async def resolve_conflict(
    payload: SyncConflictResolveRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    model = SYNC_TABLES.get(payload.table)
    if not model:
        raise ValidationError(f"Unknown table '{payload.table}'")
    record = await db.get(model, payload.record_id)
    if not record:
        raise ValidationError("Conflict record not found")
    if payload.resolution == "server_wins" or payload.resolution == "merge":
        await log_action(
            db,
            user.id,
            "sync_conflict_resolved",
            payload.table,
            payload.record_id,
            new_values={"resolution": payload.resolution},
        )
        await db.commit()
        return MessageResponse(message=f"Conflict resolved ({payload.resolution}) - server values kept")
    if payload.client_values:
        for key, value in payload.client_values.items():
            setattr(record, key, value)
        await db.commit()
        return MessageResponse(message="Conflict resolved (client wins) - client values applied")
    raise ValidationError("client_values required for client_wins resolution")


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SyncLog).where(SyncLog.user_id == user.id).order_by(SyncLog.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    return SyncStatusResponse(
        online=True,
        last_sync_at=last.completed_at if last else None,
        pending_push=0,
        pending_pull=0,
    )
