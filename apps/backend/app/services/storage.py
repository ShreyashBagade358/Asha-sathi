"""Unified photo storage helpers for the ASHA Sathi backend.

Supports two backends (in order of preference):
1. UploadThing REST API (if UPLOADTHING_TOKEN + UPLOADTHING_APP_ID are set)
2. Neon S3-compatible object storage (if AWS_ENDPOINT_URL_S3 + keys are set)

Returns public CDN/URL for each upload.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

BUCKET_NAME = settings.aws_s3_bucket


# ---------------------------------------------------------------------------
# UploadThing REST API backend
# ---------------------------------------------------------------------------
UPLOADTHING_API = "https://api.uploadthing.com/v6/uploadFiles"
UPLOADTHING_DELETE_API = "https://api.uploadthing.com/v6/deleteFiles"


@lru_cache(maxsize=1)
def _ut_headers() -> dict[str, str] | None:
    token = settings.uploadthing_token or settings.uploadthing_secret
    if not token or not settings.uploadthing_app_id:
        return None
    return {
        "x-uploadthing-api-key": token,
        "x-uploadthing-app-id": settings.uploadthing_app_id,
        "Content-Type": "application/json",
    }


async def _ut_upload(file_path: str, data: bytes, content_type: str = "image/jpeg") -> str | None:
    headers = _ut_headers()
    if not headers:
        return None

    import base64
    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    filename = f"{file_path}.{extension}" if "." not in file_path else file_path
    file_data = base64.b64encode(data).decode()

    payload = {
        "files": [{
            "name": filename,
            "type": content_type,
            "data": f"data:{content_type};base64,{file_data}",
        }],
        "appId": settings.uploadthing_app_id,
    }

    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                "https://api.uploadthing.com/v6/uploadFiles",
                json={"files": [{"name": filename, "type": content_type, "data": f"data:{content_type};base64,{file_data}"}], "appId": settings.uploadthing_app_id},
                headers=headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            result = resp.json()
        except Exception as exc:
            raise ServiceUnavailableError(f"UploadThing upload failed: {exc}") from exc

    if not result.get("data") or not result["data"][0].get("url"):
        raise ServiceUnavailableError(f"UploadThing returned no URL: {result}")

    return result["data"][0]["url"]


async def _ut_delete(file_url: str) -> None:
    headers = _ut_headers()
    if not headers:
        return
    try:
        parsed = urlparse(file_url)
        if "utfs.io" in parsed.netloc:
            file_key = parsed.path.lstrip("/f/")
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    "https://api.uploadthing.com/v6/deleteFiles",
                    json={"fileKeys": [file_key], "appId": settings.uploadthing_app_id},
                    headers=headers,
                )
    except Exception:
        logger.warning("UploadThing delete failed for %s", file_url, exc_info=True)


def _is_ut_url(url: str) -> bool:
    return "utfs.io" in url


# ---------------------------------------------------------------------------
# Neon S3 backend
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _s3_client():
    if not settings.aws_endpoint_url_s3 or not settings.aws_access_key_id:
        return None
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=settings.aws_endpoint_url_s3,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region or None,
        config=Config(s3={"addressing_style": "path"}),
    )


def _ensure_bucket(bucket: str = BUCKET_NAME) -> None:
    client = _s3_client()
    if not client:
        return
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        try:
            client.create_bucket(Bucket=bucket)
            logger.info("Created S3 bucket: %s", bucket)
        except Exception:
            logger.warning("Could not ensure bucket exists", exc_info=True)


def _public_url(key: str, bucket: str = BUCKET_NAME) -> str:
    base = (settings.s3_public_base_url or "").rstrip("/")
    if base:
        return f"{base}/{key}"
    endpoint = (settings.aws_endpoint_url_s3 or "").rstrip("/")
    return f"{endpoint}/{bucket}/{key}"


def _s3_upload(file_path: str, data: bytes, content_type: str = "image/jpeg", bucket: str = BUCKET_NAME) -> str | None:
    client = _s3_client()
    if not client:
        return None
    _ensure_bucket(bucket)
    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    storage_path = f"{file_path}.{extension}" if "." not in file_path else file_path
    try:
        client.put_object(
            Bucket=bucket,
            Key=storage_path,
            Body=data,
            ContentType=content_type,
        )
    except Exception as exc:
        raise ServiceUnavailableError(f"Photo upload failed: {exc}") from exc
    return _public_url(storage_path, bucket)


def _s3_delete(file_path: str, bucket: str = BUCKET_NAME) -> None:
    client = _s3_client()
    if not client:
        return
    try:
        client.delete_object(Bucket=bucket, Key=file_path)
    except Exception:
        logger.warning("Photo delete failed for %s", file_path, exc_info=True)


def _s3_bucket_and_path(url: str):
    base = (settings.s3_public_base_url or "").rstrip("/")
    if base and url.startswith(base + "/"):
        return BUCKET_NAME, url[len(base) + 1:]
    parsed = urlparse(url)
    parts = parsed.path.lstrip("/").split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


# Backward compatibility
def bucket_and_path_from_url(url: str) -> tuple[str, str] | None:
    return _s3_bucket_and_path(url)


# ---------------------------------------------------------------------------
# Public API (prefers UploadThing, falls back to S3)
# ---------------------------------------------------------------------------
async def upload(file_path: str, data: bytes, content_type: str = "image/jpeg", bucket: str = BUCKET_NAME) -> str:
    """Upload data to preferred storage and return public URL."""
    # Try UploadThing first
    ut_url = await _ut_upload(file_path, data, content_type)
    if ut_url:
        return ut_url
    # Fall back to S3
    s3_url = _s3_upload(file_path, data, content_type, bucket)
    if s3_url:
        return s3_url
    raise ServiceUnavailableError("No storage backend configured (need UploadThing or S3 env vars)")


async def delete(file_url: str) -> None:
    """Delete from whichever backend the URL belongs to."""
    if _is_ut_url(file_url):
        await _ut_delete(file_url)
    else:
        parsed = _s3_bucket_and_path(file_url)
        if parsed:
            bucket, key = parsed
            _s3_delete(key, bucket)


def is_uploadthing_url(url: str) -> bool:
    return "utfs.io" in url
