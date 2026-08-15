from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.exceptions import NotFoundError
from app.models.notification import Notification, ReminderSchedule
from app.models.user import Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import (
    BroadcastCreate,
    NotificationCreate,
    NotificationResponse,
    ReminderScheduleCreate,
    ReminderScheduleResponse,
)
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NotificationResponse])
async def list_notifications(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if status:
        stmt = stmt.where(Notification.status == status)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate([NotificationResponse.model_validate(n) for n in result.scalars().all()], total, page, page_size)


@router.post("", response_model=NotificationResponse, status_code=201)
async def create_notification(
    payload: NotificationCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    notification = Notification(**payload.model_dump())
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user.id:
        raise NotFoundError("Notification not found")
    notification.status = "read"
    notification.read_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/broadcast", response_model=MessageResponse)
async def broadcast(
    payload: BroadcastCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(require_roles(Role.MOIC, Role.BPM, Role.DPM, Role.STATE_ADMIN, Role.SUPER_ADMIN)),
):
    stmt = select(User.id).where(User.is_active.is_(True))
    if payload.roles:
        stmt = stmt.where(User.role.in_(payload.roles))
    user_ids = (await db.execute(stmt)).scalars().all()
    count = 0
    for user_id in user_ids:
        db.add(
            Notification(
                user_id=user_id,
                type="broadcast",
                title=payload.title,
                message=payload.message,
                channels=payload.channels,
                status="pending",
            )
        )
        count += 1
    await log_action(
        db, user.id, "broadcast_sent", "notification", None, new_values={"recipients": count, "title": payload.title}
    )
    await db.commit()
    return MessageResponse(message=f"Broadcast queued for {count} users")


@router.get("/reminders/schedules", response_model=PaginatedResponse[ReminderScheduleResponse])
async def list_reminder_schedules(
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(ReminderSchedule).where(ReminderSchedule.is_active == is_active)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(ReminderSchedule.next_send_at).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(
        [ReminderScheduleResponse.model_validate(r) for r in result.scalars().all()], total, page, page_size
    )


@router.post("/reminders/schedules", response_model=ReminderScheduleResponse, status_code=201)
async def create_reminder_schedule(
    payload: ReminderScheduleCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    schedule = ReminderSchedule(**payload.model_dump(), created_by=user.id)
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule
