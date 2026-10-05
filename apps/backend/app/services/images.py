"""Shared validation for the profile-photo upload endpoints.

Kept out of the routers so the avatar and beneficiary photo endpoints apply
exactly the same size cap and content-type allow-list.
"""

from fastapi import UploadFile

from app.core.exceptions import BadRequestError

MAX_IMAGE_BYTES = 5_242_880  # 5 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


async def read_image(file: UploadFile) -> tuple[bytes, str]:
    """Read the upload, rejecting anything that is not an allowed image type.

    Returns ``(payload, extension)``. Raises ``BadRequestError`` (413 for an
    oversized body) when the file is not acceptable.
    """
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise BadRequestError("Unsupported image type. Allowed types: image/jpeg, image/png, image/webp")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise BadRequestError("File too large. Maximum size is 5 MB.", status=413)
    return data, ext
