from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_roles
from app.models.audit import AuditLog
from app.models.user import Role, User
from app.schemas.common import PaginatedResponse, paginate

router = APIRouter()

ADMIN = require_roles(Role.ADMIN)


async def _actor_names(db: AsyncSession, user_ids: set[str]) -> dict[str, str]:
    """Batch-resolve actor display names so the log table is not full of ids."""
    if not user_ids:
        return {}
    rows = await db.execute(select(User.id, User.full_name).where(User.id.in_(user_ids)))
    return {uid: (full_name or "") for uid, full_name in rows.all()}


@router.get("/logs", response_model=PaginatedResponse[dict])
async def list_audit_logs(
    user_id: str = Query(None),
    action: str = Query(None),
    entity_type: str = Query(None),
    entity_id: str = Query(None),
    status: str = Query(None),
    q: str = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN),
):
    stmt = select(AuditLog)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if status:
        stmt = stmt.where(AuditLog.status == status)
    if q:
        like = f"%{q}%"
        matching_actors = (
            await db.execute(select(User.id).where(User.full_name.ilike(like)))
        ).scalars().all()
        clauses = [
            AuditLog.action.ilike(like),
            AuditLog.entity_type.ilike(like),
            AuditLog.entity_id.ilike(like),
        ]
        if matching_actors:
            clauses.append(AuditLog.user_id.in_(list(matching_actors)))
        stmt = stmt.where(or_(*clauses))
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    rows = result.scalars().all()
    items = [row.to_dict() for row in rows]
    names = await _actor_names(db, {i["user_id"] for i in items if i.get("user_id")})
    for item in items:
        item["actor_name"] = names.get(item.get("user_id") or "", "")
    return paginate(items, total, page, page_size)


@router.get("/summary")
async def audit_summary(
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN),
):
    """Counts for the audit dashboard tiles — grouped from the same table."""
    rows = (
        await db.execute(select(AuditLog.status, func.count()).group_by(AuditLog.status))
    ).all()
    by_status = {status or "success": count for status, count in rows}
    return {
        "total": sum(by_status.values()),
        "success": by_status.get("success", 0),
        "denied": by_status.get("denied", 0),
        "error": by_status.get("error", 0),
    }
