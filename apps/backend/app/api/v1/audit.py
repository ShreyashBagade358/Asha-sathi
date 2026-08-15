from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_roles
from app.models.audit import AuditLog
from app.models.user import Role, User
from app.schemas.common import PaginatedResponse, paginate

router = APIRouter()

ADMIN = require_roles(Role.ANM, Role.MOIC, Role.BPM, Role.DPM, Role.STATE_ADMIN, Role.SUPER_ADMIN)


@router.get("/logs", response_model=PaginatedResponse[dict])
async def list_audit_logs(
    user_id: str = Query(None),
    action: str = Query(None),
    entity_type: str = Query(None),
    entity_id: str = Query(None),
    status: str = Query(None),
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
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = [row.to_dict() for row in result.scalars().all()]
    return paginate(items, total, page, page_size)
