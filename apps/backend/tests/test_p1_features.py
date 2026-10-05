"""Tests for the P1 feature batch.

Covers one-time credentials (ASHA + user creation), avatar / beneficiary photo
uploads, `PUT /patients/me` profile writes and their ML readback, the AI
prediction history endpoint, household surveys and the ASHA task REST API.
"""

import uuid
from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.admin import SubCenter
from app.models.user import User

pytestmark = pytest.mark.asyncio

FAKE_AVATAR_URL = "https://supabase.test/storage/v1/object/public/avatars/u1.png"
FAKE_PHOTO_URL = "https://supabase.test/storage/v1/object/public/baby-growth/beneficiaries/b1.png"
FAKE_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

REGISTER = "/api/v1/patients/register"
ME = "/api/v1/patients/me"

_registrar_seq = 0
_phone_seq = 0


def _uid() -> str:
    return uuid.uuid4().hex[:8]


def _phone() -> str:
    """Digits-only, unique within a test run (tables are wiped between tests)."""
    global _phone_seq
    _phone_seq += 1
    return f"9876{400000 + _phone_seq}"


async def _token_headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def _register_and_login(client, auth_headers, **overrides) -> tuple[dict, dict]:
    """Register a patient through the ASHA flow, then sign in as them."""
    global _registrar_seq
    _registrar_seq += 1
    asha_headers = await auth_headers(phone=f"910000{_registrar_seq:04d}", role="asha", full_name="Meena Sharma")
    payload = {
        "full_name": "Rahul Kakad",
        "phone": _phone(),
        "date_of_birth": "2005-02-24",
        "gender": "male",
        "abha_id": f"29-7239-0558-{6400 + _registrar_seq}",
        "village": "Sitapur",
        "household_id": "1234321",
        "blood_group": "O+",
        "asha_worker": "Meena Sharma",
        "risk": "medium",
        "notes": "Registered at camp",
    }
    payload.update(overrides)
    resp = await client.post(REGISTER, json=payload, headers=asha_headers)
    assert resp.status_code == 201, resp.text
    registered = resp.json()

    login = await client.post(
        "/api/v1/auth/login",
        json={"phone": registered["phone"], "password": registered["password"]},
    )
    assert login.status_code == 200, login.text
    token = login.json()["tokens"]["access_token"]
    return registered, {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Group 0 — P0 fixes
# ---------------------------------------------------------------------------
async def test_asha_create_persists_sub_center(client, auth_headers, db_session):
    admin = await auth_headers(phone="9876543212", role="admin")
    sub_center = SubCenter(phc_id="phc-test", code="SCT1", name="Newa Sub Centre")
    db_session.add(sub_center)
    await db_session.commit()

    phone = _phone()
    r = await client.post(
        "/api/v1/ashas",
        headers=admin,
        json={"name": "Sub Centre ASHA", "phone": phone, "sub_center": "Newa Sub Centre"},
    )
    assert r.status_code == 201, r.text

    created = (await db_session.execute(select(User).where(User.phone == phone))).scalar_one()
    assert created.sub_center_id == sub_center.id

    # An unknown label falls back to the admin's own sub-centre (here: none).
    phone2 = _phone()
    r = await client.post(
        "/api/v1/ashas",
        headers=admin,
        json={"name": "Fallback ASHA", "phone": phone2, "sub_center": "No Such Place"},
    )
    assert r.status_code == 201, r.text
    created2 = (await db_session.execute(select(User).where(User.phone == phone2))).scalar_one()
    assert created2.sub_center_id is None


async def test_beneficiary_create_stores_risk_notes_village(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.post(
        "/api/v1/beneficiaries",
        headers=headers,
        json={
            "beneficiary_id": f"BEN-{_uid().upper()}",
            "full_name": "Risk Case",
            "gender": "female",
            "status": "active",
            "risk": "high",
            "notes": "Needs follow up",
            "village": "Rampur",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["risk"] == "high"
    assert body["notes"] == "Needs follow up"
    # No household, so the metadata village is what reads back.
    assert body["village"] == "Rampur"

    fetched = await client.get(f"/api/v1/beneficiaries/{body['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["risk"] == "high"
    assert fetched.json()["notes"] == "Needs follow up"

    updated = await client.put(
        f"/api/v1/beneficiaries/{body['id']}",
        headers=headers,
        json={"risk": "low", "village": "Sitapur"},
    )
    assert updated.status_code == 200
    assert updated.json()["risk"] == "low"
    assert updated.json()["village"] == "Sitapur"
    # Untouched keys survive the update.
    assert updated.json()["notes"] == "Needs follow up"


async def test_patient_registration_stores_asha_worker_risk_notes(client, auth_headers):
    registered, headers = await _register_and_login(client, auth_headers)

    profile = (await client.get(ME, headers=headers)).json()
    assert profile["asha_worker"] == "Meena Sharma"
    assert profile["risk"] == "medium"
    assert profile["notes"] == "Registered at camp"
    # Existing fields are untouched by the new metadata keys.
    assert profile["village"] == "Sitapur"
    assert profile["asha_worker_name"] == "Meena Sharma"


# ---------------------------------------------------------------------------
# Group A — photos
# ---------------------------------------------------------------------------
@patch("app.services.storage.upload", return_value=FAKE_AVATAR_URL)
@patch("app.services.storage.delete")
async def test_avatar_upload_and_delete(mock_delete, mock_upload, client, user_factory):
    user = await user_factory(phone="9876543210", role="asha")
    headers = await _token_headers(user)

    r = await client.post(
        f"/api/v1/users/{user.id}/avatar",
        headers=headers,
        files={"file": ("me.png", FAKE_PNG_BYTES, "image/png")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["avatar_url"] == FAKE_AVATAR_URL
    assert mock_upload.call_count == 1

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["avatar_url"] == FAKE_AVATAR_URL

    r = await client.delete(f"/api/v1/users/{user.id}/avatar", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {"message": "Avatar removed"}
    assert mock_delete.call_count == 1

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["avatar_url"] is None


async def test_avatar_requires_self_or_admin(client, user_factory):
    owner = await user_factory(phone="9876543210", role="asha")
    other = await user_factory(phone="9876543211", role="asha")
    admin = await user_factory(phone="9876543212", role="admin")

    r = await client.post(
        f"/api/v1/users/{other.id}/avatar",
        headers=await _token_headers(owner),
        files={"file": ("me.png", FAKE_PNG_BYTES, "image/png")},
    )
    assert r.status_code == 403, r.text

    # The admin may set anyone's avatar, but a missing user is still a 404.
    r = await client.post(
        "/api/v1/users/no-such-user/avatar",
        headers=await _token_headers(admin),
        files={"file": ("me.png", FAKE_PNG_BYTES, "image/png")},
    )
    assert r.status_code == 404, r.text


async def test_avatar_rejects_bad_content_type_and_oversize(client, user_factory):
    user = await user_factory(phone="9876543210", role="asha")
    headers = await _token_headers(user)

    r = await client.post(
        f"/api/v1/users/{user.id}/avatar",
        headers=headers,
        files={"file": ("doc.gif", FAKE_PNG_BYTES, "image/gif")},
    )
    assert r.status_code == 400, r.text

    r = await client.post(
        f"/api/v1/users/{user.id}/avatar",
        headers=headers,
        files={"file": ("big.png", b"\x00" * 5_242_881, "image/png")},
    )
    assert r.status_code == 413, r.text


@patch("app.services.storage.upload", return_value=FAKE_PHOTO_URL)
@patch("app.services.storage.delete")
async def test_beneficiary_photo_upload_and_delete(mock_delete, mock_upload, client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    created = await client.post(
        "/api/v1/beneficiaries",
        headers=headers,
        json={"beneficiary_id": f"BEN-{_uid().upper()}", "full_name": "Photo Me", "status": "active"},
    )
    assert created.status_code == 201, created.text
    beneficiary = created.json()
    assert beneficiary["photo_url"] is None

    r = await client.post(
        f"/api/v1/beneficiaries/{beneficiary['id']}/photo",
        headers=headers,
        files={"file": ("b.png", FAKE_PNG_BYTES, "image/png")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["photo_url"] == FAKE_PHOTO_URL
    assert mock_upload.call_count == 1

    fetched = await client.get(f"/api/v1/beneficiaries/{beneficiary['id']}", headers=headers)
    assert fetched.json()["photo_url"] == FAKE_PHOTO_URL

    r = await client.delete(f"/api/v1/beneficiaries/{beneficiary['id']}/photo", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {"message": "Photo removed"}
    assert mock_delete.call_count == 1

    fetched = await client.get(f"/api/v1/beneficiaries/{beneficiary['id']}", headers=headers)
    assert fetched.json()["photo_url"] is None

    r = await client.post(
        "/api/v1/beneficiaries/does-not-exist/photo",
        headers=headers,
        files={"file": ("b.png", FAKE_PNG_BYTES, "image/png")},
    )
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Group B — one-time credentials
# ---------------------------------------------------------------------------
async def test_asha_create_returns_password_and_can_login(client, auth_headers):
    admin = await auth_headers(phone="9876543212", role="admin")
    phone = _phone()

    r = await client.post(
        "/api/v1/ashas",
        headers=admin,
        json={"name": "Generated PW ASHA", "phone": phone},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    # New field, but every pre-existing field is still there for old clients.
    assert body["password"].startswith("Ash@")
    assert len(body["password"]) >= 12
    for key in ("id", "asha_id", "name", "phone", "assigned_households", "status"):
        assert key in body

    login = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": body["password"]}
    )
    assert login.status_code == 200, login.text

    # A caller-supplied password wins over the generated one.
    phone2 = _phone()
    r = await client.post(
        "/api/v1/ashas",
        headers=admin,
        json={"name": "Explicit PW ASHA", "phone": phone2, "password": "Sup3rSecret!"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["password"] == "Sup3rSecret!"
    login = await client.post(
        "/api/v1/auth/login", json={"phone": phone2, "password": "Sup3rSecret!"}
    )
    assert login.status_code == 200, login.text


async def test_user_create_returns_password_and_can_login(client, auth_headers):
    admin = await auth_headers(phone="9876543212", role="admin")
    phone = _phone()

    r = await client.post(
        "/api/v1/users",
        headers=admin,
        json={"role": "asha", "phone": phone, "full_name": "Created User"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["password"].startswith("Ash@")
    assert body["phone"] == phone
    # The rest of UserResponse is unchanged.
    for key in ("id", "role", "full_name", "is_active", "created_at"):
        assert key in body

    login = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": body["password"]}
    )
    assert login.status_code == 200, login.text

    # Reads still speak plain UserResponse — no password leaks back out.
    got = await client.get(f"/api/v1/users/{body['id']}", headers=admin)
    assert got.status_code == 200
    assert "password" not in got.json()


# ---------------------------------------------------------------------------
# Group C — patient profile + ML readback
# ---------------------------------------------------------------------------
async def test_put_patients_me_merges_profile_inputs(client, auth_headers):
    _, headers = await _register_and_login(client, auth_headers)

    r = await client.put(
        ME,
        headers=headers,
        json={"height_cm": 170, "weight_kg": 62, "bp_systolic": 118, "bp_diastolic": 76},
    )
    assert r.status_code == 200, r.text
    profile = r.json()
    assert profile["profile_inputs"] == {
        "height_cm": 170,
        "weight_kg": 62,
        "bp_systolic": 118,
        "bp_diastolic": 76,
    }
    # Vitals fall back to the profile inputs when there is no ANC visit.
    assert profile["vitals"] == {
        "height_cm": 170,
        "weight_kg": 62,
        "bp_systolic": 118,
        "bp_diastolic": 76,
        "hemoglobin": None,
    }
    # Pre-existing metadata keys survive the merge.
    assert profile["village"] == "Sitapur"
    assert profile["risk"] == "medium"

    r = await client.put(ME, headers=headers, json={"hemoglobin": 12.5, "tobacco_use": True})
    assert r.status_code == 200, r.text
    inputs = r.json()["profile_inputs"]
    assert inputs["height_cm"] == 170  # merged, not replaced
    assert inputs["hemoglobin"] == 12.5
    assert inputs["tobacco_use"] is True
    assert r.json()["vitals"]["hemoglobin"] == 12.5

    # GET returns exactly what PUT returned.
    got = await client.get(ME, headers=headers)
    assert got.status_code == 200
    assert got.json()["profile_inputs"] == inputs
    assert got.json()["vitals"] == r.json()["vitals"]


async def test_put_patients_me_validation_and_missing_profile(client, auth_headers, user_factory):
    _, headers = await _register_and_login(client, auth_headers)

    r = await client.put(ME, headers=headers, json={"height_cm": 10})
    assert r.status_code == 422, r.text

    r = await client.put(ME, headers=headers, json={"physical_activity": "extreme"})
    assert r.status_code == 422, r.text

    # A signed-in user with no beneficiary row gets a 404, not a fake profile.
    no_beneficiary = await user_factory(phone="9876543215", role="patient")
    r = await client.put(
        ME, headers=await _token_headers(no_beneficiary), json={"height_cm": 170}
    )
    assert r.status_code == 404, r.text
    assert r.json()["detail"] == "No beneficiary profile"


async def test_get_ai_predictions_round_trip(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    beneficiary_id = f"TEST-{uuid.uuid4().hex[:12]}"

    first = await client.post(
        "/api/v1/ai/ncd-risk/predict",
        headers=headers,
        json={"beneficiary_id": beneficiary_id, "age": 52, "sex": "M", "weight_kg": 90},
    )
    assert first.status_code == 200, first.text
    second = await client.post(
        "/api/v1/ai/maternal-risk/predict",
        headers=headers,
        json={"beneficiary_id": beneficiary_id, "age": 30, "gravida": 2, "hemoglobin": 9.5},
    )
    assert second.status_code == 200, second.text
    # A different beneficiary's prediction must not leak into the list.
    await client.post(
        "/api/v1/ai/ncd-risk/predict",
        headers=headers,
        json={"beneficiary_id": f"TEST-{uuid.uuid4().hex[:12]}", "age": 40},
    )

    r = await client.get(
        "/api/v1/ai/predictions", headers=headers, params={"beneficiary_id": beneficiary_id}
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert {i["id"] for i in items} == {first.json()["id"], second.json()["id"]}
    assert all(i["beneficiary_id"] == beneficiary_id for i in items)
    assert all("model_name" in i and "created_at" in i for i in items)
    assert items == sorted(items, key=lambda i: i["created_at"], reverse=True)

    r = await client.get(
        "/api/v1/ai/predictions",
        headers=headers,
        params={"beneficiary_id": beneficiary_id, "limit": 1},
    )
    assert len(r.json()) == 1

    assert (await client.get("/api/v1/ai/predictions", headers=headers)).status_code == 422
    assert (await client.get("/api/v1/ai/predictions")).status_code == 401


# ---------------------------------------------------------------------------
# Group P2 — household surveys + ASHA tasks
# ---------------------------------------------------------------------------
async def _create_household(client, headers) -> dict:
    r = await client.post(
        "/api/v1/households",
        headers=headers,
        json={"hhid": f"HH-SURV-{_uid()}", "village_id": _uid(), "head_name": "Ramesh Yadav"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_household_survey_post_and_get(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    household = await _create_household(client, headers)
    other = await _create_household(client, headers)

    r = await client.post(
        f"/api/v1/households/{household['id']}/survey",
        headers=headers,
        json={
            "answers": {"drinking_water": "piped", "toilet": "flush"},
            "consent_obtained": True,
            "visited_at": date.today().isoformat(),
        },
    )
    assert r.status_code == 201, r.text
    survey = r.json()
    assert survey["household_id"] == household["id"]
    assert survey["answers"] == {"drinking_water": "piped", "toilet": "flush"}
    assert survey["consent_obtained"] is True
    assert survey["visited_at"] == date.today().isoformat()
    assert survey["id"] and survey["created_at"]

    # A second survey on the same household.
    r = await client.post(
        f"/api/v1/households/{household['id']}/survey",
        headers=headers,
        json={"answers": {"q1": "no"}},
    )
    assert r.status_code == 201, r.text
    second_survey_id = r.json()["id"]

    r = await client.get(f"/api/v1/households/{household['id']}/surveys", headers=headers)
    assert r.status_code == 200, r.text
    surveys = r.json()
    assert len(surveys) == 2
    assert {s["id"] for s in surveys} == {survey["id"], second_survey_id}
    # Newest first (ties on the second-granular timestamp are tolerated).
    assert surveys == sorted(surveys, key=lambda s: s["created_at"], reverse=True)

    # Surveys are scoped to their own household.
    r = await client.get(f"/api/v1/households/{other['id']}/surveys", headers=headers)
    assert r.json() == []

    # Validation: at least one answer is required; household must exist.
    r = await client.post(
        f"/api/v1/households/{household['id']}/survey",
        headers=headers,
        json={"answers": {}},
    )
    assert r.status_code == 422, r.text
    assert (
        await client.post(
            "/api/v1/households/no-such-household/survey",
            headers=headers,
            json={"answers": {"q1": "yes"}},
        )
    ).status_code == 404
    assert (
        await client.get("/api/v1/households/no-such-household/surveys", headers=headers)
    ).status_code == 404


async def test_asha_tasks_crud(client, user_factory):
    asha = await user_factory(phone="9876543210", role="asha")
    other_asha = await user_factory(phone="9876543211", role="asha")
    headers = await _token_headers(asha)
    other_headers = await _token_headers(other_asha)

    r = await client.post(
        "/api/v1/ashas/me/tasks",
        headers=headers,
        json={
            "task_type": "home_visit",
            "task_date": "2026-10-05",
            "priority": "high",
            "notes": "Check BP of Ramesh",
            "metadata": {"source": "form"},
        },
    )
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["asha_id"] == asha.id
    assert task["status"] == "pending"
    assert task["task_type"] == "home_visit"
    assert task["metadata_json"] == {"source": "form"}
    # Response covers the whole model, not just the old subset.
    for key in ("gps_latitude", "gps_longitude", "created_at", "updated_at", "version"):
        assert key in task

    r = await client.get("/api/v1/ashas/me/tasks", headers=headers)
    assert r.status_code == 200, r.text
    assert [t["id"] for t in r.json()] == [task["id"]]

    assert (
        await client.get(
            "/api/v1/ashas/me/tasks", headers=headers, params={"status": "completed"}
        )
    ).json() == []

    r = await client.patch(
        f"/api/v1/ashas/me/tasks/{task['id']}",
        headers=headers,
        json={"status": "completed", "gps_latitude": 26.85, "gps_longitude": 80.94},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed"
    assert r.json()["gps_latitude"] == 26.85
    assert r.json()["notes"] == "Check BP of Ramesh"

    r = await client.get(
        "/api/v1/ashas/me/tasks", headers=headers, params={"status": "completed"}
    )
    assert len(r.json()) == 1

    # Somebody else's task is indistinguishable from a missing one.
    r = await client.patch(
        f"/api/v1/ashas/me/tasks/{task['id']}",
        headers=other_headers,
        json={"status": "pending"},
    )
    assert r.status_code == 404, r.text
    r = await client.patch(
        "/api/v1/ashas/me/tasks/no-such-task",
        headers=headers,
        json={"status": "pending"},
    )
    assert r.status_code == 404

    # And the other worker sees an empty list of their own tasks.
    assert (await client.get("/api/v1/ashas/me/tasks", headers=other_headers)).json() == []
    assert (await client.get("/api/v1/ashas/me/tasks")).status_code == 401
