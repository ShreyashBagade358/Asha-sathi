from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("abdm")


class ABDMGateway:
    """Client for ABDM (Ayushman Bharat Digital Mission) M1/M2/M3 APIs.

    Live integration requires credentials from ABDM; all methods currently return
    mocked responses and MUST be replaced with real API calls once credentials are available.
    TODO: wire httpx calls against settings.abdm_base_url / abdm_gateway_url using
    settings.abdm_client_id / abdm_client_secret and OAuth2 token exchange.
    """

    def __init__(self) -> None:
        self.base_url = settings.abdm_base_url
        self.gateway_url = settings.abdm_gateway_url
        self._access_token: str | None = None

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        # TODO(ABDM): real integration
        url = f"{self.base_url}{path}"
        logger.info("abdm_request", path=path, url=url)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {self._access_token or ''}"},
                )
                if resp.is_success:
                    return resp.json()
        except httpx.HTTPError as exc:
            logger.warning("abdm_request_failed", path=path, error=str(exc))
        return {"status": "MOCK", "request": payload}

    async def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {self._access_token or ''}"})
                if resp.is_success:
                    return resp.json()
        except httpx.HTTPError as exc:
            logger.warning("abdm_get_failed", path=path, error=str(exc))
        return {"status": "MOCK"}

    async def health_id_phone_verification(self, mobile: str) -> dict[str, Any]:
        return await self._post("/v0.5/verification/phone/generate-otp", {"mobile": mobile, "txnId": "mock-txn-1"})

    async def create_health_id(self, name: str, mobile: str, txn_id: str, otp: str) -> dict[str, Any]:
        return await self._post(
            "/v0.5/registration/hid/create-by-mobile",
            {
                "name": name,
                "mobile": mobile,
                "txnId": txn_id,
                "otp": otp,
                "consent": True,
                "profilePhoto": None,
            },
        )

    async def generate_mobile_link_token(self, abha_address: str, mobile: str) -> dict[str, Any]:
        return await self._post("/v0.5/registration/mobile/link/token", {"abhaAddress": abha_address, "mobile": mobile})

    async def confirm_with_mobile_otp(self, otp: str, txn_id: str) -> dict[str, Any]:
        return await self._post("/v0.5/registration/mobile/link/confirm/withMobileOtp", {"otp": otp, "txnId": txn_id})

    async def get_health_id_status(self, health_id: str) -> dict[str, Any]:
        return await self._get(f"/v0.5/registration/hid/status/{health_id}")

    async def push_health_records(self, document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post(f"/v0.5/health-records/push/{document_id}", {"document": payload, "type": "pushing"})

    async def get_health_records(self, document_id: str) -> dict[str, Any]:
        return await self._get(f"/v0.5/health-records/pull/{document_id}")

    async def create_consent_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post("/v1/consent-requests/init", payload)

    async def get_consent_status(self, request_id: str) -> dict[str, Any]:
        return await self._get(f"/v1/consent-requests/{request_id}/status")
