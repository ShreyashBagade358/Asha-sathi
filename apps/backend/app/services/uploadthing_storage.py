"""UploadThing storage helpers for the ASHA Sathi backend.

Uploads go to UploadThing (https://uploadthing.com). Requires UPLOADTHING_TOKEN
and UPLOADTHING_APP_ID in the environment. Returns public CDN URLs.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _client():
    """Return a singleton UploadThing client."""
    if not settings.uploadthing_token or not settings.uploadthing_app_id:
        raise ServiceUnavailableError(
            "UploadThing is not configured. "
            "Set UPLOADTHING_TOKEN and UPLOADTHING_APP_ID."
        )
    from uploadthing_python import UploadThing

    return UploadThing(
        secret=settings.uploadthing_token,
        app_id=settings.uploadthing_app_id,
    )


def upload(file_path: str, data: bytes, content_type: str = "image/jpeg") -> str:
    """Upload data to UploadThing and return the public CDN URL."""
    client = _client()
    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    filename = f"{file_path}.{extension}" if "." not in file_path else file_path

    try:
        result = client.upload(
            files=[{
                "name": filename,
                "data": data,
                "type": content_type,
            }]
        )
    except Exception as exc:
        raise ServiceUnavailableError(f"UploadThing upload failed: {exc}") from exc

    if not result or not result[0].get("url"):
        raise ServiceUnavailableError("UploadThing returned no URL")

    return result[0]["url"]


def delete(file_url: str) -> None:
    """Remove an object from UploadThing (best-effort)."""
    try:
        client = _client()
        parsed = urlparse(file_url)
        if "utfs.io" in parsed.netloc:
            file_key = parsed.path.lstrip("/f/")
            client.delete_files(file_key)
    except Exception:
        logger.warning("UploadThing delete failed for %s", file_url, exc_info=True)


def is_uploadthing_url(url: str) -> bool:
    """Check if a URL is an UploadThing CDN URL."""
    return "utfs.io" in url