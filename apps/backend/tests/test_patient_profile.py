from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models.beneficiary import Beneficiary
from app.models.disease import DiseaseCase

REGISTER = "/api/v1/patients/register"
ME = "/api/v1/patients/me"


def _payload(**overrides) -> dict:
    payload = {
        "full_name": "Rahul Kakad",
        "phone": "9876543401",
        "date_of_birth": "2005-02-24",
        "gender": "male",
        "abha_id": "29-7239-0558-6400",
        "village": "Sitapur",
        "household_id": "1234321",
        "blood_group": "O+",
    }
    payload.update(overrides)
    return payload


_registrar_seq = 0


async def _register_and_login(client, auth_headers, **overrides) -> tuple[dict, dict]:
    """Register a patient through the ASHA flow, then sign in as them.

    Each call uses a fresh registrar phone — `auth_headers` creates a User
    row, and phone is unique, so reusing one would collide across tests.
    """
    global _registrar_seq
    _registrar_seq += 1
    asha_headers = await auth_headers(
        phone=f"900000{_registrar_seq:04d}", role="asha", full_name="Meena Sharma"
    )
    resp = await client.post(REGISTER, json=_payload(**overrides), headers=asha_headers)
    assert resp.status_code == 201, resp.text
    registered = resp.json()

    login = await client.post(
        "/api/v1/auth/login",
        json={"phone": registered["phone"], "password": registered["password"]},
    )
    assert login.status_code == 200, login.text
    token = login.json()["tokens"]["access_token"]
    return registered, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_my_profile_returns_the_callers_own_record(client, auth_headers):
    registered, headers = await _register_and_login(client, auth_headers)

    resp = await client.get(ME, headers=headers)
    assert resp.status_code == 200, resp.text
    profile = resp.json()

    assert profile["user_id"] == registered["user_id"]
    assert profile["beneficiary_id"] == registered["beneficiary_id"]
    assert profile["full_name"] == "Rahul Kakad"
    assert profile["phone"] == "9876543401"
    assert profile["abha_id"] == "29-7239-0558-6400"
    assert profile["gender"] == "male"
    assert profile["age_years"] == 21
    assert profile["village"] == "Sitapur"
    assert profile["household_id"] == "1234321"
    assert profile["address"] == "Household 1234321, Sitapur"
    assert profile["blood_group"] == "O+"


@pytest.mark.asyncio
async def test_my_profile_resolves_the_asha_worker_who_registered_them(
    client, auth_headers
):
    _, headers = await _register_and_login(client, auth_headers)

    resp = await client.get(ME, headers=headers)
    assert resp.status_code == 200, resp.text

    # The only durable User -> Beneficiary link is registered_by; there is no
    # household row to fall back to for a self-registered patient.
    assert resp.json()["asha_worker_name"] == "Meena Sharma"


@pytest.mark.asyncio
async def test_my_profile_leaves_unset_fields_null_not_fabricated(client, auth_headers):
    _, headers = await _register_and_login(client, auth_headers, blood_group=None)

    profile = (await client.get(ME, headers=headers)).json()

    # Absent clinical data must come back absent — the portal used to render
    # demo vitals here as though they were the patient's own.
    assert profile["blood_group"] is None
    assert profile["phc_name"] is None
    assert profile["vitals"] is None
    assert profile["active_conditions"] == []
    assert profile["is_pregnant"] is False
    assert profile["pregnancy"] is None


@pytest.mark.asyncio
async def test_pregnancy_summary_is_derived_from_lmp(
    client, auth_headers, db_session
):
    registered, headers = await _register_and_login(
        client, auth_headers, gender="female"
    )
    lmp = date.today() - timedelta(days=100)

    # The registration response hands out `beneficiaries.beneficiary_id`
    # (BHF-...), but the pregnancies API looks beneficiaries up by primary key.
    beneficiary_pk = (
        await db_session.execute(
            select(Beneficiary).where(Beneficiary.phone == registered["phone"])
        )
    ).scalar_one().id

    # Create through the ASHA-facing API so the test exercises the same path
    # an ASHA worker would use, rather than poking the database directly.
    asha_headers = await auth_headers(phone="9876543210", role="asha")
    create = await client.post(
        "/api/v1/pregnancies",
        json={"beneficiary_id": beneficiary_pk, "lmp": lmp.isoformat()},
        headers=asha_headers,
    )
    assert create.status_code in (200, 201), create.text

    profile = (await client.get(ME, headers=headers)).json()
    assert profile["is_pregnant"] is True
    assert profile["pregnancy"] is not None
    # 100 days after LMP is 14 weeks → second trimester.
    assert profile["pregnancy"]["week"] == 14
    assert profile["pregnancy"]["trimester"] == 2


@pytest.mark.asyncio
async def test_active_conditions_come_from_disease_cases(
    client, auth_headers, db_session
):
    registered, headers = await _register_and_login(client, auth_headers)
    beneficiary_pk = (
        await db_session.execute(
            select(Beneficiary).where(Beneficiary.phone == registered["phone"])
        )
    ).scalar_one().id

    db_session.add(
        DiseaseCase(
            disease_type="malaria",
            beneficiary_id=beneficiary_pk,
            status="confirmed",
        )
    )
    db_session.add(
        DiseaseCase(
            disease_type="tb",
            beneficiary_id=beneficiary_pk,
            status="resolved",
        )
    )
    await db_session.commit()

    profile = (await client.get(ME, headers=headers)).json()
    # Resolved cases are not active conditions.
    assert profile["active_conditions"] == ["malaria"]


@pytest.mark.asyncio
async def test_my_profile_only_ever_returns_the_callers_data(client, auth_headers):
    _, first_headers = await _register_and_login(
        client, auth_headers, full_name="Rahul Kakad", abha_id="29-7239-0558-6400"
    )
    _, second_headers = await _register_and_login(
        client,
        auth_headers,
        full_name="Sunita Devi",
        phone="9876543402",
        abha_id="11-1111-2222-3333",
    )

    first = (await client.get(ME, headers=first_headers)).json()
    second = (await client.get(ME, headers=second_headers)).json()

    assert first["phone"] != second["phone"]
    assert first["beneficiary_id"] != second["beneficiary_id"]
    assert first["full_name"] == "Rahul Kakad"
    assert second["full_name"] == "Sunita Devi"


@pytest.mark.asyncio
async def test_my_profile_requires_authentication(client):
    resp = await client.get(ME)
    assert resp.status_code == 401
