"""Neon S3-compatible object storage helpers for the ASHA Sathi backend.

Uploads go to Neon's S3-compatible object storage (``AWS_ENDPOINT_URL_S3`` +
``AWS_ACCESS_KEY_ID``/``AWS_SECRET_ACCESS_KEY`` in the environment). The bucket
(``AWS_S3_BUCKET``, default ``asha-sathi``) is created on first upload when it
does not exist; make it public-read in the Neon console (or set
``S3_PUBLIC_BASE_URL``) so returned photo URLs are viewable by the dashboard
and the app.
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


@lru_cache(maxsize=1)
def _s3_client():
    """Return a singleton boto3 S3 client bound to the Neon endpoint."""
    if not settings.aws_endpoint_url_s3 or not settings.aws_access_key_id:
        raise ServiceUnavailableError(
            "S3 storage is not configured. "
            "Set AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
        )
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
    """Create the bucket if it does not already exist (best-effort)."""
    try:
        _s3_client().head_bucket(Bucket=bucket)
    except Exception:
        try:
            _s3_client().create_bucket(Bucket=bucket)
            logger.info("Created S3 bucket: %s", bucket)
        except Exception:
            logger.warning("Could not ensure bucket exists", exc_info=True)


def _public_url(key: str, bucket: str = BUCKET_NAME) -> str:
    """Public-read URL for an object (path-style against the Neon endpoint)."""
    base = (settings.s3_public_base_url or "").rstrip("/")
    if base:
        return f"{base}/{key}"
    endpoint = (settings.aws_endpoint_url_s3 or "").rstrip("/")
    return f"{endpoint}/{bucket}/{key}"


async def upload(file_path: str, data: bytes, content_type: str = "image/jpeg", bucket: str = BUCKET_NAME) -> str:
    """Upload data to S3 and return the public URL."""
    _ensure_bucket(bucket)
    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    storage_path = f"{file_path}.{extension}" if "." not in file_path else file_path
    try:
        _s3_client().put_object(
            Bucket=bucket,
            Key=storage_path,
            Body=data,
            ContentType=content_type,
        )
    except Exception as exc:
        raise ServiceUnavailableError(f"Photo upload failed: {exc}") from exc
    return _public_url(storage_path, bucket)


async def delete(file_url: str) -> None:
    """Remove an object from the bucket (best-effort)."""
    try:
        parsed = urlparse(file_url)
        parts = parsed.path.lstrip("/").split("/", 1)
        if len(parts) != 2 or not parts[0] or not parts[1]:
            return
        bucket, key = parts[0], parts[1]
        _s3_client().delete_object(Bucket=bucket, Key=key)
    except Exception:
        logger.warning("Photo delete failed for %s", file_url, exc_info=True)


def bucket_and_path_from_url(url: str):
    """Split a public URL back into ``(bucket, key)`` for deletion."""
    parsed = urlparse(url)
    parts = parsed.path.lstrip("/").split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]