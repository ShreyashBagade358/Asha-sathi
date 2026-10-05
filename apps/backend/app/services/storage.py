"""Supabase Storage helpers for the ASHA Sathi backend.

Wraps the Supabase client singleton with upload / delete operations used by
the photo-upload endpoints.  Every bucket is created lazily with public-read
access on the first upload; ``baby-growth`` (the growth-photo bucket) is the
default so existing callers are unchanged.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

BUCKET_NAME = "baby-growth"


def _get_admin_client():
    """Return a Supabase client authenticated with the service-role key."""
    from supabase import create_client

    if not settings.supabase_url or not settings.supabase_service_key:
        raise ServiceUnavailableError(
            "Supabase storage is not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _ensure_bucket(client, bucket: str = BUCKET_NAME) -> None:
    """Create the storage bucket if it does not already exist."""
    try:
        buckets = client.storage.list_buckets()
        existing = {b.name for b in buckets}
        if bucket not in existing:
            client.storage.create_bucket(
                bucket,
                options={"public": True, "file_size_limit": 5_242_880},  # 5 MB
            )
            logger.info("Created Supabase storage bucket: %s", bucket)
    except Exception:
        logger.warning("Could not ensure bucket exists", exc_info=True)


def _public_url(path: str, bucket: str = BUCKET_NAME) -> str:
    """Build a public-read URL for a file in the storage bucket."""
    base = (settings.supabase_url or "").rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


def upload(file_path: str, data: bytes, content_type: str = "image/jpeg", bucket: str = BUCKET_NAME) -> str:
    """Upload *data* to Supabase Storage and return the public URL.

    The storage path convention is ``growth/{child_id}/{record_id}.{ext}``
    (or ``avatars/{user_id}.{ext}`` / ``beneficiaries/{id}.{ext}`` for the
    profile-photo endpoints, which pass their own ``bucket``).  If the bucket
    does not exist it will be created with public-read access.
    """
    client = _get_admin_client()
    _ensure_bucket(client, bucket)
    extension = Path(file_path).suffix.lstrip(".") or "jpg"
    storage_path = f"{file_path}.{extension}" if "." not in file_path else file_path
    try:
        client.storage.from_(bucket).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        raise ServiceUnavailableError(f"Photo upload failed: {exc}") from exc
    return _public_url(storage_path, bucket)


def delete(file_path: str, bucket: str = BUCKET_NAME) -> None:
    """Remove a file from Supabase Storage (best-effort)."""
    try:
        client = _get_admin_client()
        client.storage.from_(bucket).remove([file_path])
    except Exception:
        logger.warning("Photo delete failed for %s", file_path, exc_info=True)


def bucket_and_path_from_url(url: str) -> tuple[str, str] | None:
    """Split a public URL back into ``(bucket, path)`` for deletion."""
    match = re.search(r"public/([^/]+)/(.+?)(?:\?|$)", url)
    if not match:
        return None
    return match.group(1), match.group(2)
