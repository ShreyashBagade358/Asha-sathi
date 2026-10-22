"""UploadThing REST API client (no SDK needed - uses httpx directly)."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import httpx
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

UPLOADTHING_API = "https://api.uploadthing.com/v6/uploadFiles"
UPLOADTHING_DELETE_API = "https://api.uploadthing.com/v6/deleteFiles"


@lru_cache(maxsize=1)
def _ut_headers() -> dict[str, str] | None:
    """Return UploadThing auth headers if configured."""
    if not settings.uploadthing_token or not settings.uploadthing_app_id:
        return None
    return {
        "x-uploadthing-api-key": settings.uploadthing_token,
        "x-uploadthing-app-id": settings.uploadthing_app_id,
        "Content-Type": "application/json",
    }


async def ut_upload(file_path: str, data: bytes, content_type: str = "image/jpeg") -> str | None:
    """Upload data to UploadThing via REST API and return public CDN URL."""
    headers = _ut_headers()
    if not headers:
        return None

    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    filename = f"{file_path}.{extension}" if "." not in file_path else file_path

    # UploadThing expects base64 encoded file data
    import base64
    file_data = base64.b64encode(data).decode()

    payload = {
        "files": [{
            "name": filename,
            "type": content_type,
            "data": f"data:{content_type};base64,{file_data}",
        }],
        "appId": settings.uploadthing_app_id,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(UPLOADTHING_API, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()
        except Exception as exc:
            raise ServiceUnavailableError(f"UploadThing upload failed: {exc}") from exc

    if not result.get("data") or not result["data"][0].get("url"):
        raise ServiceUnavailableError(f"UploadThing returned no URL: {result}")

    return result["data"][0]["url"]


async def ut_delete(file_url: str) -> None:
    """Delete file from UploadThing via REST API."""
    headers = _ut_headers()
    if not headers:
        return

    try:
        parsed = urlparse(file_url)
        if "utfs.io" in parsed.netloc:
            file_key = parsed.path.lstrip("/f/")
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    UPLOADTHING_DELETE_API,
                    json={"fileKeys": [file_key], "appId": settings.uploadthing_app_id},
                    headers=headers,
                )
    except Exception:
        logger.warning("UploadThing delete failed for %s", file_url, exc_info=True)


def is_uploadthing_url(url: str) -> bool:
    return "utfs.io" in url