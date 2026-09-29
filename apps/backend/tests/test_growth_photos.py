"""Tests for baby growth progress photo upload / delete endpoints."""

from unittest.mock import patch

import pytest

pytestmark = pytest.mark.asyncio

FAKE_PHOTO_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 100
FAKE_URL = "https://supabase.test/storage/v1/object/public/baby-growth/growth/c1/r1.jpg"


async def _create_child_and_growth(client, headers):
    """Helper: create a beneficiary + child + growth record, return (child, record)."""
    import uuid

    b_resp = await client.post(
        "/api/v1/beneficiaries",
        headers=headers,
        json={
            "beneficiary_id": f"BEN-{uuid.uuid4().hex[:8].upper()}",
            "full_name": "Photo Test Beneficiary",
            "gender": "female",
            "phone": f"6{uuid.uuid4().hex[:9].translate(str.maketrans('abcdef','123456'))}",
            "status": "active",
        },
    )
    assert b_resp.status_code == 201, b_resp.text
    beneficiary = b_resp.json()

    c_resp = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"beneficiary_id": beneficiary["id"], "birth_weight_grams": 2800, "gestation_weeks": 39},
    )
    assert c_resp.status_code == 201, c_resp.text
    child = c_resp.json()

    g_resp = await client.post(
        f"/api/v1/children/{child['id']}/growth",
        headers=headers,
        json={"record_date": "2026-09-25", "weight_kg": 3.5, "height_cm": 52.0, "muac_mm": 130},
    )
    assert g_resp.status_code == 201, g_resp.text
    record = g_resp.json()
    return child, record


async def test_growth_record_includes_photo_url_null(client, auth_headers):
    """Growth records default to photo_url: null."""
    headers = await auth_headers()
    child, record = await _create_child_and_growth(client, headers)
    assert record["photo_url"] is None

    r = await client.get(f"/api/v1/children/{child['id']}/growth", headers=headers)
    assert r.status_code == 200
    assert all(g["photo_url"] is None for g in r.json())


@patch("app.services.storage.upload", return_value=FAKE_URL)
async def test_upload_growth_photo(mock_upload, client, auth_headers):
    """Upload a photo to a growth record."""
    headers = await auth_headers()
    child, record = await _create_child_and_growth(client, headers)

    r = await client.post(
        f"/api/v1/children/{child['id']}/growth/{record['id']}/photo",
        headers=headers,
        files={"file": ("baby.jpg", FAKE_PHOTO_BYTES, "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["photo_url"] == FAKE_URL
    mock_upload.assert_called_once()


async def test_upload_photo_too_large(client, auth_headers):
    """Reject files over 5 MB."""
    headers = await auth_headers()
    child, record = await _create_child_and_growth(client, headers)

    big = b"\x00" * (5_242_881)
    r = await client.post(
        f"/api/v1/children/{child['id']}/growth/{record['id']}/photo",
        headers=headers,
        files={"file": ("big.jpg", big, "image/jpeg")},
    )
    assert r.status_code == 400, r.text


async def test_upload_photo_wrong_child(client, auth_headers):
    """Photo upload fails if growth_record belongs to a different child."""
    headers = await auth_headers()
    child1, record1 = await _create_child_and_growth(client, headers)
    child2, record2 = await _create_child_and_growth(client, headers)

    r = await client.post(
        f"/api/v1/children/{child1['id']}/growth/{record2['id']}/photo",
        headers=headers,
        files={"file": ("f.jpg", FAKE_PHOTO_BYTES, "image/jpeg")},
    )
    assert r.status_code == 404


async def test_upload_photo_nonexistent_record(client, auth_headers):
    """404 for a nonexistent growth record."""
    headers = await auth_headers()
    child, _ = await _create_child_and_growth(client, headers)

    r = await client.post(
        f"/api/v1/children/{child['id']}/growth/does-not-exist/photo",
        headers=headers,
        files={"file": ("f.jpg", FAKE_PHOTO_BYTES, "image/jpeg")},
    )
    assert r.status_code == 404


@patch("app.services.storage.upload", return_value=FAKE_URL)
@patch("app.services.storage.delete")
async def test_delete_growth_photo(mock_delete, mock_upload, client, auth_headers):
    """Delete clears the photo_url."""
    headers = await auth_headers()
    child, record = await _create_child_and_growth(client, headers)

    # upload first
    await client.post(
        f"/api/v1/children/{child['id']}/growth/{record['id']}/photo",
        headers=headers,
        files={"file": ("baby.jpg", FAKE_PHOTO_BYTES, "image/jpeg")},
    )

    # delete
    r = await client.delete(
        f"/api/v1/children/{child['id']}/growth/{record['id']}/photo",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["photo_url"] is None
    mock_delete.assert_called_once()
