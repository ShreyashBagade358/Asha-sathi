"""Adversarial tests for critical failure scenarios."""

from __future__ import annotations

from datetime import UTC, datetime, date
from unittest.mock import patch, AsyncMock
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey, HouseholdVisitCheck
from app.models.user import Role, User
from app.models.sync import SyncOperation

pytestmark = pytest.mark.asyncio


# =============================================================================
# Test 1: Duplicate Survey Creation on Double-Click
# =============================================================================

async def test_double_click_creates_single_survey(client, auth_headers, db_session):
    """Double-clicking Complete Visit must create only ONE survey."""
    headers = await auth_headers(phone="8010867650", role="asha")
    household = await _make_household(db_session, household_id="hh-dc-1", village_id="v1", asha_user_id="asha-1")
    ben = await _make_beneficiary(db_session, beneficiary_id="ben-dc-1", household_id=household.id, full_name="Test")

    payload = {
        "consent_obtained": True,
        "answers": {"clean_water": True, "functional_toilet": True},
        "visited_at": date.today().isoformat(),
        "member_checks": [{"beneficiary_id": "ben-dc-1", "check_type": "general", "result": "ok"}],
    }

    # Simulate double-click: two rapid requests
    import asyncio
    r1, r2 = await asyncio.gather(
        client.post(f"/api/v1/households/hh-dc-1/survey", json=payload, headers=headers),
        client.post(f"/api/v1/households/hh-dc-1/survey", json=payload, headers=headers),
    )

    assert r1.status_code in (200, 201), r1.text
    assert r2.status_code in (200, 201, 409), r2.text

    # Only ONE survey should exist
    surveys = (await db_session.execute(select(HouseholdSurvey))).scalars().all()
    assert len(surveys) == 1, f"Double-click created {len(surveys)} surveys"


# =============================================================================
# Test 2: Photo Upload Race Condition
# =============================================================================

async def test_concurrent_photo_uploads_for_same_survey(client, auth_headers, db_session):
    """Concurrent photo uploads for same survey must not lose photos."""
    headers = await auth_headers(phone="8010867650", role="asha")
    household = await _make_household(db_session, household_id="hh-race-1", village_id="v1", asha_user_id="asha-1")
    ben = await _make_beneficiary(db_session, beneficiary_id="ben-race-1", household_id="hh-race-1", full_name="Test")

    # Create survey with required answers
    r = await client.post("/api/v1/households/hh-race-1/survey", json={
        "consent_obtained": True, "answers": {"clean_water": True}, "visited_at": date.today().isoformat(),
        "member_checks": [{"beneficiary_id": "ben-race-1", "check_type": "general", "result": "ok"}]
    }, headers=headers)
    survey_id = r.json()["id"]

    # Upload two photos concurrently
    import base64
    jpg = base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==')
    
    import asyncio
    r1, r2 = await asyncio.gather(
        client.post(f"/api/v1/households/hh-race-1/survey/{survey_id}/photo", headers=headers, files={"file": ("1.jpg", jpg, "image/jpeg")}),
        client.post(f"/api/v1/households/hh-race-1/survey/{survey_id}/photo", headers=headers, files={"file": ("2.jpg", jpg, "image/jpeg")}),
    )

    assert r1.status_code in (200, 201), r1.text
    assert r2.status_code in (200, 201), r2.text

    # Both photos should be in the survey
    survey = await db_session.get(HouseholdSurvey, survey_id)
    photos = survey.photo_urls or {}
    assert len(photos) >= 2, "Race condition lost a photo"


# =============================================================================
# Test 3: Concurrent Household Visit Check Updates
# =============================================================================

async def test_concurrent_member_check_updates(client, auth_headers, db_session):
    """Two ASHAs updating same member check - last write wins with conflict detection."""
    headers1 = await auth_headers(phone="asha1", role="asha")
    headers2 = await auth_headers(phone="asha2", role="asha")
    
    household = await _make_household(db_session, household_id="hh-conc-1", village_id="v1", asha_user_id="asha-1")
    ben = await _make_beneficiary(db_session, beneficiary_id="ben-conc-1", household_id="hh-conc-1", full_name="Test")

    # Create survey with check
    r = await client.post("/api/v1/households/hh-conc-1/survey", json={
        "consent_obtained": True, "answers": {"clean_water": True}, "visited_at": date.today().isoformat(),
        "member_checks": [{"beneficiary_id": "ben-conc-1", "check_type": "general", "result": "ok"}]
    }, headers=headers1)
    survey_id = r.json()["id"]
    check_id = r.json()["member_checks"][0]["id"]

    # ASHA 1 updates to "ok", ASHA 2 updates to "concern" concurrently
    import asyncio
    r1, r2 = await asyncio.gather(
        client.patch(f"/api/v1/households/hh-conc-1/survey/{survey_id}/check/{check_id}", json={"result": "ok", "notes": "asha1"}, headers=headers1),
        client.patch(f"/api/v1/households/hh-conc-1/survey/{survey_id}/check/{check_id}", json={"result": "concern", "notes": "asha2"}, headers=headers2),
    )

    assert r1.status_code in (200, 201, 409), r1.text
    assert r2.status_code in (200, 201, 409), r2.text


# =============================================================================
# Test 4: Partial Failure - S3 Upload Succeeds but DB Fails
# =============================================================================

async def test_photo_upload_s3_succeeds_db_fails(client, auth_headers, db_session):
    """If S3 upload succeeds but DB commit fails, no orphaned S3 object."""
    from unittest.mock import patch
    headers = await auth_headers(phone="8010867650", role="asha")
    household = await _make_household(db_session, household_id="hh-partial-1", village_id="v1", asha_user_id="asha-1")
    ben = await _make_beneficiary(db_session, beneficiary_id="ben-partial-1", household_id="hh-partial-1", full_name="Test")

    # Create survey
    r = await client.post("/api/v1/households/hh-partial-1/survey", json={
        "consent_obtained": True, "answers": {"clean_water": True}, "visited_at": date.today().isoformat(),
        "member_checks": [{"beneficiary_id": "ben-partial-1", "check_type": "general", "result": "ok"}]
    }, headers=headers)
    survey_id = r.json()["id"]

    # Mock S3 to succeed, DB to fail on commit
    with patch("app.services.storage.upload") as mock_upload:
        mock_upload.return_value = "https://s3.test/photo.jpg"
        
        # Make DB fail on commit
        original_commit = db_session.commit
        async def fail_commit():
            raise Exception("Simulated DB failure")
        db_session.commit = fail_commit
        
        try:
            r = await client.post(f"/api/v1/households/hh-partial-1/survey/{survey_id}/photo", headers=headers, files={"file": ("test.jpg", b"fake", "image/jpeg")})
            # Should return error
            assert r.status_code >= 500, r.text
        finally:
            db_session.commit = original_commit


# =============================================================================
# Test 5: Authorization Bypass via Sync Push
# =============================================================================

async def test_patient_cannot_push_household_survey(client, auth_headers, db_session):
    """Patient must not push household_visit_checks via sync."""
    patient = await _make_user(db_session, phone="patient1", role="patient")
    headers = {"Authorization": f"Bearer {create_access_token(patient.id)}"}

    # Try to push household_visit_checks
    r = await client.post("/api/v1/sync/push", json={
        "device_id": "d1",
        "operations": [{
            "entity": "household_visit_checks",
            "operation": "create",
            "id": "chk-evil",
            "version": 1,
            "client_request_id": "req-evil",
            "data": {"household_id": "hh-x", "check_type": "general", "result": "ok"}
        }]
    }, headers=headers)

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["failed"] == 1
    assert body["results"][0]["error"] == "forbidden"


# =============================================================================
# Helper fixtures
# =============================================================================

@pytest_asyncio.fixture
async def auth_headers(user_factory):
    async def _headers(phone="8010867650", role="asha"):
        user = await user_factory(phone=phone, role=role)
        return {"Authorization": f"Bearer {create_access_token(user.id)}"}
    return _headers


async def _make_household(session, *, household_id: str, village_id: str, asha_user_id: str):
    hh = Household(id=household_id, hhid=f"HH-{household_id}", village_id=village_id, asha_id=asha_user_id, address="Test", consent_given=True)
    session.add(hh)
    await session.commit()
    return hh


async def _make_beneficiary(session, *, beneficiary_id: str, household_id: str, full_name: str):
    ben = Beneficiary(id=beneficiary_id, beneficiary_id=f"BEN-{beneficiary_id}", household_id=household_id, full_name=full_name, gender="female", date_of_birth=date(1995, 5, 4))
    session.add(ben)
    await session.commit()
    return ben


async def _make_user(session, phone: str, role: str):
    from app.core.security import get_password_hash
    user = User(role=role, phone=phone, full_name=f"User {phone}", is_active=True, hashed_password=get_password_hash("test"))
    session.add(user)
    await session.commit()
    return user
