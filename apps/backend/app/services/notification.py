from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification


class NotificationService:
    """Delivery adapters for push / SMS / WhatsApp. Uses mocked providers by default."""

    @staticmethod
    async def send_push_to_device(token: str, title: str, body: str, data: dict[str, Any] | None = None) -> bool:
        """Send a single FCM message to a device token."""
        if not settings.fcm_server_key:
            return False
        url = "https://fcm.googleapis.com/v1/projects/asha-sathi/messages:send"
        # FCM data payload values must be strings.
        safe_data = {k: (v if isinstance(v, str) else str(v)) for k, v in (data or {}).items()}
        payload = {
            "message": {
                "token": token,
                "notification": {"title": title, "body": body},
                "data": safe_data,
            }
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    url, json=payload, headers={"Authorization": f"Bearer {settings.fcm_server_key}"}
                )
                return resp.is_success
        except httpx.HTTPError:
            return False

    @staticmethod
    async def send_push_to_devices(
        db: AsyncSession,
        user_id: str,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
    ) -> int:
        """Fan a push notification out to every FCM-enabled device of a user.

        Returns the number of successful deliveries. A missing server key means
        the notification is skipped silently (offline/mocked dev environments).
        """
        from app.models.sync import SyncDevice

        if not settings.fcm_server_key:
            return 0
        rows = (
            await db.execute(
                select(SyncDevice)
                .where(
                    SyncDevice.user_id == user_id,
                    SyncDevice.is_active.is_(True),
                    SyncDevice.fcm_token.is_not(None),
                )
                .order_by(SyncDevice.fcm_updated_at.asc())
            )
        ).scalars().all()
        delivered = 0
        stale_tokens: list[SyncDevice] = []
        for device in rows:
            ok = await NotificationService.send_push_to_device(
                str(device.fcm_token), title, body, data
            )
            if ok:
                delivered += 1
            elif device.fcm_token:  # 401/404 => token invalid; stop retrying it.
                stale_tokens.append(device)
        for stale in stale_tokens:
            stale.fcm_token = None
            stale.fcm_updated_at = None
        await db.flush()
        return delivered

    @staticmethod
    async def send_push(user_id: str, title: str, body: str, data: dict[str, Any] | None = None) -> bool:
        """Legacy single-token push (token passed as user_id). Prefer device fan-out."""
        if not settings.fcm_server_key:
            return False
        return await NotificationService.send_push_to_device(user_id, title, body, data)

    @staticmethod
    async def ensure_notification(
        db: AsyncSession,
        *,
        user_id: str,
        notif_type: str,
        title: str,
        message: str,
        reference_id: str | None = None,
        reference_type: str | None = None,
        priority: str = "normal",
        action_url: str | None = None,
        channels: list[str] | None = None,
        data: dict[str, Any] | None = None,
    ) -> tuple[Notification, bool]:
        """Create a notification unless an equivalent one already exists.

        Dedup key is (user_id, type, reference_type, reference_id) for open,
        non-failed notifications. Returns ``(notification, created)``.
        """
        channels = channels or ["push"]
        existing: Notification | None = None
        if reference_id:
            existing = (
                await db.execute(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.type == notif_type,
                        Notification.reference_type == reference_type,
                        Notification.reference_id == reference_id,
                        Notification.status.notin_(["failed"]),
                    )
                )
            ).scalar_one_or_none()
        if existing is not None:
            return existing, False
        notification = Notification(
            user_id=user_id,
            type=notif_type,
            priority=priority,
            title=title,
            message=message,
            action_url=action_url,
            reference_id=reference_id,
            reference_type=reference_type,
            channels=channels,
            status="pending",
            metadata_json=data,
        )
        db.add(notification)
        await db.flush()
        return notification, True

    @staticmethod
    async def mark_sent(
        db: AsyncSession,
        notification: Notification,
        *,
        delivered: bool = False,
    ) -> None:
        """Mark a notification as sent (delivered optionally) when push succeeds."""
        notification.status = "delivered" if delivered else "sent"
        notification.sent_at = datetime.now(UTC)
        if delivered:
            notification.delivered_at = notification.sent_at
        await db.flush()

    @staticmethod
    async def send_sms(phone: str, message: str) -> bool:
        if not settings.twilio_sid or not settings.twilio_auth_token:
            return False
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_sid}/Messages.json"
        payload = {"To": phone, "From": settings.twilio_from_number or "", "Body": message}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, data=payload, auth=(settings.twilio_sid, settings.twilio_auth_token))
                return resp.is_success
        except httpx.HTTPError:
            return False

    @staticmethod
    async def send_whatsapp(phone: str, message: str) -> bool:
        """WhatsApp Business API stub - not configured by default."""
        if not settings.twilio_sid or not settings.twilio_auth_token:
            return False
        return await NotificationService.send_sms(phone, message)

    @staticmethod
    async def send_email(to: str, subject: str, body: str) -> bool:
        """SMTP email stub."""
        if not settings.smtp_host:
            return False
        # TODO: wire real SMTP client (e.g. aiosmtplib) when smtp_host is configured.
        return True
