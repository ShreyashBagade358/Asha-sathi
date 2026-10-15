from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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
    HouseholdVisitCheck,
    Immunization,
    NCDScreening,
    Notification,
    PNCVisit,
    Pregnancy,
    Referral,
    ReferralFollowup,
    VillageForm,
)
from app.models.audit import SyncLog
from app.models.beneficiary import Beneficiary
from app.models.sync import SyncOperation
from app.models.user import Role, User
from app.schemas.common import MessageResponse
from app.schemas.other_domain import (
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    SyncConflictResolveRequest,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushItemResult,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusResponse,
)
from app.services.audit import log_action
from app.services.sync_scope import (
    allowed_tables_for,
    register_links,
    resolve_scope,
    scope_predicate,
)
from app.services.sync_service import apply_operation, touch_device, upsert_batch
from app.services.task_plan import generate_daily_plan, plan_today

SYNC_TABLES: dict[str, Any] = {
    "households": Household,
    "beneficiaries": Beneficiary,
    "household_visit_checks": HouseholdVisitCheck,
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
    "referral_followups": ReferralFollowup,
    "notifications": Notification,
}

PULL_LIMIT = 1000

register_links(SYNC_TABLES)

router = APIRouter()


@router.post("/push", response_model=SyncPushResponse)
async def push_records(
    payload: SyncPushRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    started = datetime.now(UTC)
    results: list[SyncPushItemResult] = []
    pushed = conflicts = failed = 0

    ops = payload.operations
    if ops:
        for op in ops:
            denial = allowed_tables_for(user, op.entity)
            if denial is not None:
                failed += 1
                results.append(
                    SyncPushItemResult(
                        client_request_id=op.client_request_id or f"{op.entity}:{op.id}",
                        entity=op.entity,
                        operation=op.operation,
                        status="failed",
                        error="forbidden",
                    )
                )
                continue
            res = await apply_operation(
                db,
                user_id=user.id,
                device_id=payload.device_id,
                entity=op.entity,
                operation=op.operation,
                record_id=op.id,
                version=op.version,
                data=op.data,
                client_request_id=op.client_request_id,
                model_registry=SYNC_TABLES,
            )
            if res["status"] == "success":
                pushed += 1
            elif res["status"] == "conflict":
                conflicts += 1
            else:
                failed += 1
            results.append(SyncPushItemResult(**res))
    elif payload.records:
        # Legacy path: versionless upsert (web dashboard / older clients). Each
        # record maps to a deterministic per-entity idempotency key so the server
        # never double-applies a retried batch.
        import hashlib

        for table, records in payload.records.items():
            if table not in SYNC_TABLES:
                for rec in records:
                    results.append(
                        SyncPushItemResult(
                            client_request_id=f"{table}:{rec.get('id', '?')}",
                            entity=table,
                            operation="upsert",
                            status="failed",
                            error="unknown_entity",
                        )
                    )
                    failed += 1
                continue
            if allowed_tables_for(user, table) is not None:
                for rec in records:
                    results.append(
                        SyncPushItemResult(
                            client_request_id=f"{table}:{rec.get('id', '?')}",
                            entity=table,
                            operation="upsert",
                            status="failed",
                            error="forbidden",
                        )
                    )
                    failed += 1
                continue
            count = await upsert_batch(db, table, records, SYNC_TABLES)
            pushed += count["pushed"]
            for rec in records:
                rid = rec.get("id", "?")
                key = hashlib.sha1(f"{table}:{rid}".encode()).hexdigest()
                results.append(
                    SyncPushItemResult(
                        client_request_id=key,
                        entity=table,
                        operation="upsert",
                        status="success",
                        server_id=rid,
                        record=rec,
                    )
                )

    await touch_device(
        db,
        user_id=user.id,
        device_id=payload.device_id,
        app_version=payload.app_version,
        platform="mobile" if payload.app_version else None,
    )

    sync_log = SyncLog(
        user_id=user.id,
        device_id=payload.device_id,
        app_version=payload.app_version,
        sync_type="push",
        status="completed" if not conflicts and not failed else "partial",
        records_pushed=sum(1 for r in results if r.status == "success"),
        started_at=started,
        completed_at=datetime.now(UTC),
        duration_ms=0,
        errors=[r.model_dump(exclude_none=True) for r in results if r.status != "success"],
    )
    db.add(sync_log)
    await log_action(db, user.id, "sync_push", "sync", sync_log.id, new_values={"pushed": pushed})
    await db.commit()
    return SyncPushResponse(
        results=results,
        server_time=datetime.now(UTC),
        summary={"pushed": pushed, "conflicts": conflicts, "failed": failed, "total": len(results)},
    )


@router.post("/pull", response_model=SyncPullResponse)
async def pull_records(
    payload: SyncPullRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Return rows changed since the client's watermark, scoped to the caller's tenant.

    Uses ``updated_at`` (not ``created_at``) so server-side edits propagate.
    Rows are limited to what ``user`` is allowed to see; a scoped role never
    receives another tenant's PHI.
    """
    scope = await resolve_scope(db, user)

    # The daily visit plan is built lazily by GET /me/tasks (the web calls it
    # on every Tasks page load). A phone-only worker never hits that endpoint,
    # so the plan would never exist and the app's "Today's Visits" stayed
    # empty. Building it here — before the watermark scan — means the freshly
    # inserted tasks carry an `updated_at` newer than the client's cursor and
    # ride the normal pull like any other row.
    if user.role == Role.ASHA and (payload.tables is None or "asha_tasks" in payload.tables):
        try:
            await generate_daily_plan(db, user.id, plan_today())
        except IntegrityError:
            # A concurrent tab/device built the same plan first — its commit
            # wins, the pull below simply reads the result.
            await db.rollback()

    result: dict[str, list[dict]] = {}
    tables = payload.tables or list(SYNC_TABLES.keys())

    # Per-table remaining budget so a single table cannot starve the others and
    # the total response stays within the caller's limit.
    limit = payload.limit
    truncated = False

    for table in tables:
        if limit <= 0:
            truncated = True
            break
        model = SYNC_TABLES.get(table)
        if not model:
            continue

        stmt = select(model).where(model.updated_at >= payload.last_pull_at)
        predicate = scope_predicate(model, scope)
        if predicate is not None:
            stmt = stmt.where(predicate)
        stmt = stmt.order_by(model.updated_at.asc(), model.id.asc()).limit(limit)

        rows = (await db.execute(stmt)).scalars().all()
        result[table] = [row.to_dict() for row in rows]
        limit -= len(rows)
        if len(rows) == 0:
            continue

    has_more = False
    next_cursor: str | None = None
    if truncated or limit == 0:
        # The client should immediately pull again from the server watermark.
        has_more = True
        next_cursor = datetime.now(UTC).isoformat()

    await touch_device(db, user_id=user.id, device_id=payload.device_id)
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
    return SyncPullResponse(
        records=result,
        server_time=datetime.now(UTC),
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.post("/devices/register", response_model=DeviceRegisterResponse)
async def register_device(
    payload: DeviceRegisterRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Register/refresh a device (used to update the FCM push token)."""
    from app.models.sync import SyncDevice

    now = datetime.now(UTC)
    row = (await db.execute(select(SyncDevice).where(SyncDevice.device_id == payload.device_id))).scalar_one_or_none()
    if row is None:
        row = SyncDevice(
            device_id=payload.device_id,
            user_id=user.id,
            app_version=payload.app_version,
            platform=payload.platform,
            last_seen_at=now,
            last_sync_at=now,
        )
        db.add(row)
    else:
        row.user_id = user.id
        row.app_version = payload.app_version or row.app_version
        row.platform = payload.platform or row.platform
        row.is_active = True
        row.last_seen_at = now
    if payload.fcm_token is not None:
        row.fcm_token = payload.fcm_token
        row.fcm_updated_at = now
    await db.commit()
    return DeviceRegisterResponse(
        device_id=payload.device_id,
        registered=True,
        server_time=now,
    )


@router.post("/conflicts/resolve", response_model=MessageResponse)
async def resolve_conflict(
    payload: SyncConflictResolveRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    model = SYNC_TABLES.get(payload.table)
    if not model:
        raise ValidationError(f"Unknown table '{payload.table}'")

    scope = await resolve_scope(db, user)
    stmt = select(model).where(model.id == payload.record_id)
    predicate = scope_predicate(model, scope)
    if predicate is not None:
        stmt = stmt.where(predicate)
    record = (await db.execute(stmt)).scalar_one_or_none()
    if not record:
        # Do not distinguish "does not exist" from "not yours".
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
            if key in ("id", "created_at", "version"):
                continue
            setattr(record, key, value)
        record.version = int(record.version or 1) + 1
        await db.commit()
        return MessageResponse(message="Conflict resolved (client wins) - client values applied")
    raise ValidationError("client_values required for client_wins resolution")


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Real sync counters for the caller's devices.

    ``pending_push`` counts operations this device still has queued, derived
    from the device's last successful push versus the operations the server has
    acknowledged. ``pending_pull`` counts rows in the caller's scope that
    changed after their last completed pull.
    """
    last = (
        await db.execute(select(SyncLog).where(SyncLog.user_id == user.id).order_by(SyncLog.created_at.desc()).limit(1))
    ).scalar_one_or_none()
    conflicts = (
        await db.execute(
            select(func.count(SyncOperation.id)).where(
                SyncOperation.user_id == user.id, SyncOperation.status == "conflict"
            )
        )
    ).scalar_one()

    # Failed pushes still awaiting a retry.
    failed_push = (
        await db.execute(
            select(func.count(SyncOperation.id)).where(
                SyncOperation.user_id == user.id, SyncOperation.status == "failed"
            )
        )
    ).scalar_one()

    # Rows changed since the caller's last pull, within their scope.
    pending_pull = 0
    last_pull = (
        await db.execute(
            select(SyncLog)
            .where(SyncLog.user_id == user.id, SyncLog.sync_type == "pull")
            .order_by(SyncLog.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last_pull and last_pull.completed_at:
        scope = await resolve_scope(db, user)
        for model in SYNC_TABLES.values():
            stmt = select(func.count(model.id)).where(model.updated_at > last_pull.completed_at)
            predicate = scope_predicate(model, scope)
            if predicate is not None:
                stmt = stmt.where(predicate)
            pending_pull += (await db.execute(stmt)).scalar_one() or 0

    return SyncStatusResponse(
        online=True,
        last_sync_at=last.completed_at if last else None,
        pending_push=failed_push or 0,
        pending_pull=pending_pull,
        conflicts=conflicts or 0,
    )
