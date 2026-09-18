from datetime import UTC, datetime, timedelta
from typing import Any, cast

import structlog
from sqlalchemy import CursorResult, delete, select

from app.core.database import async_session_maker
from app.models.notification import Notification, ReminderSchedule
from app.services.notification import NotificationService
from app.tasks.celery_app import celery_app

logger = structlog.get_logger("notification_tasks")


@celery_app.task(name="app.tasks.notification_tasks.send_due_reminders")
def send_due_reminders() -> dict[str, Any]:
    """Send reminders whose next_send_at has passed."""
    import asyncio

    return asyncio.run(_send_due_reminders_async())


async def _send_due_reminders_async() -> dict[str, Any]:
    now = datetime.now(UTC)
    sent = 0
    async with async_session_maker() as db:
        result = await db.execute(
            select(ReminderSchedule).where(
                ReminderSchedule.is_active.is_(True),
                ReminderSchedule.next_send_at.is_not(None),
                ReminderSchedule.next_send_at <= now,
            )
        )
        schedules = result.scalars().all()
        for schedule in schedules:
            notification = Notification(
                user_id=schedule.beneficiary_id,
                type="reminder",
                title="Reminder",
                title_local=schedule.message_template_local or {},
                message=schedule.message_template or schedule.reminder_type,
                message_local=schedule.message_template_local or {},
                reference_id=str(schedule.beneficiary_id),
                reference_type="reminder",
                channels=schedule.channels or ["push"],
            )
            db.add(notification)
            schedule.last_sent_at = now
            schedule.next_send_at = now + timedelta(hours=24)
            sent += 1
        await db.commit()
    logger.info("reminders_sent", count=sent)
    return {"sent": sent}


@celery_app.task(name="app.tasks.notification_tasks.process_notification_queue")
def process_notification_queue() -> dict[str, Any]:
    import asyncio

    return asyncio.run(_process_notification_queue_async())


async def _process_notification_queue_async() -> dict[str, Any]:
    async with async_session_maker() as db:
        result = await db.execute(select(Notification).where(Notification.status == "pending").limit(100))
        notifications = result.scalars().all()
        processed = 0
        for notification in notifications:
            delivered = True
            if "push" in (notification.channels or []):
                delivered = await NotificationService.send_push(
                    notification.user_id,
                    notification.title,
                    notification.message,
                    {"ref": notification.reference_id or ""},
                )
            if "sms" in (notification.channels or []):
                phone = notification.reference_id
                if phone:
                    delivered = await NotificationService.send_sms(phone, notification.message)
            if delivered:
                notification.status = "delivered"
                notification.delivered_at = datetime.now(UTC)
            else:
                notification.retry_count = notification.retry_count + 1
            processed += 1
        await db.commit()
    return {"processed": processed}


@celery_app.task(name="app.tasks.notification_tasks.cleanup_stale_sync_logs")
def cleanup_stale_sync_logs() -> dict[str, Any]:
    import asyncio

    return asyncio.run(_cleanup_stale_sync_logs_async())


async def _cleanup_stale_sync_logs_async() -> dict[str, Any]:
    from app.models.audit import SyncLog

    cutoff = datetime.now(UTC) - timedelta(days=90)
    async with async_session_maker() as db:
        result = await db.execute(delete(SyncLog).where(SyncLog.created_at < cutoff))
        await db.commit()
        deleted = cast(CursorResult, result).rowcount or 0
    return {"deleted": deleted}


@celery_app.task(name="app.tasks.notification_tasks.run_health_alerts")
def run_health_alerts() -> dict[str, Any]:
    """Generate + push health alerts (vaccination / high-risk / follow-ups)."""
    import asyncio

    return asyncio.run(_run_health_alerts_async())


async def _run_health_alerts_async() -> dict[str, Any]:
    from app.models.user import Role, User
    from app.services.health_alerts import generate_alerts_for_user

    async with async_session_maker() as db:
        user_ids = (
            await db.execute(select(User.id).where(User.role == Role.ASHA.value))
        ).scalars().all()
        generated = delivered = 0
        for uid in user_ids:
            for notification, payload in await generate_alerts_for_user(db, uid):
                generated += 1
                sent = await NotificationService.send_push_to_devices(
                    db, uid, payload["title"], payload["message"], payload["data"]
                )
                delivered += sent
                await NotificationService.mark_sent(db, notification, delivered=sent > 0)
        await db.commit()
    logger.info("health_alerts_ran", users=len(user_ids), generated=generated, delivered=delivered)
    return {"users": len(user_ids), "generated": generated, "delivered": delivered}
