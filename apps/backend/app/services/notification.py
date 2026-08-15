from typing import Any

import httpx

from app.core.config import settings


class NotificationService:
    """Delivery adapters for push / SMS / WhatsApp. Uses mocked providers by default."""

    @staticmethod
    async def send_push(user_id: str, title: str, body: str, data: dict[str, Any] | None = None) -> bool:
        if not settings.fcm_server_key:
            return False
        url = "https://fcm.googleapis.com/v1/projects/asha-sathi/messages:send"
        payload = {
            "message": {
                "token": user_id,
                "notification": {"title": title, "body": body},
                "data": data or {},
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
