import re

import pytest

REGISTER = "/api/v1/patients/register"


def _payload(**overrides) -> dict:
    payload = {
        "full_name": "Sunita Devi",
        "phone": "9876543301",
        "date_of_birth": "1998-03-14",
        "gender": "female",
        "abha_id": "12-3456-7890-1234",
        "village": "Rampur",
        "household_id": "HH-42",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_asha_registers_patient_and_patient_can_log_in(client, auth_headers):
    headers = await auth_headers(role="asha")

    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["phone"] == "9876543301"
    assert body["full_name"] == "Sunita Devi"
    assert body["user_id"]
    assert body["beneficiary_id"].startswith("BHF-")
    assert len(body["password"]) >= 8

    # The whole point: the patient can use the returned password to log in.
    login = await client.post(
        "/api/v1/auth/login",
        json={"phone": body["phone"], "password": body["password"]},
    )
    assert login.status_code == 200, login.text
    logged_in = login.json()
    assert logged_in["user"]["id"] == body["user_id"]
    assert logged_in["user"]["role"] == "patient"


@pytest.mark.asyncio
async def test_register_creates_both_records(client, auth_headers, db_session):
    from sqlalchemy import select

    from app.models.beneficiary import Beneficiary
    from app.models.user import User

    headers = await auth_headers(role="asha")
    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 201, resp.text

    user = (
        await db_session.execute(select(User).where(User.phone == "9876543301"))
    ).scalar_one()
    assert user.role == "patient"
    assert user.hashed_password  # stored as a hash, never plaintext

    beneficiary = (
        await db_session.execute(select(Beneficiary).where(Beneficiary.abha_id == "12-3456-7890-1234"))
    ).scalar_one()
    assert beneficiary.full_name == "Sunita Devi"
    assert beneficiary.phone == "9876543301"
    assert beneficiary.date_of_birth.isoformat() == "1998-03-14"
    assert beneficiary.metadata_json["village"] == "Rampur"


@pytest.mark.asyncio
async def test_admin_can_also_register(client, auth_headers):
    headers = await auth_headers(phone="9876543215", role="admin")
    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_patient_cannot_register(client, auth_headers):
    headers = await auth_headers(phone="9876543216", role="patient")
    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_rejected(client):
    resp = await client.post(REGISTER, json=_payload())
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_duplicate_phone_rejected(client, auth_headers, user_factory):
    headers = await auth_headers(role="asha")
    await user_factory(phone="9876543301")

    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 409
    assert "phone" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_abha_rejected(client, auth_headers):
    headers = await auth_headers(role="asha")
    first = await client.post(REGISTER, json=_payload(), headers=headers)
    assert first.status_code == 201, first.text

    second = await client.post(
        REGISTER, json=_payload(phone="9876543302"), headers=headers
    )
    assert second.status_code == 409
    assert "abha" in second.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field",
    ["full_name", "phone", "date_of_birth", "gender", "abha_id"],
)
async def test_required_fields_enforced(client, auth_headers, field):
    headers = await auth_headers(role="asha")
    payload = _payload()
    payload.pop(field)

    resp = await client.post(REGISTER, json=payload, headers=headers)
    assert resp.status_code == 422, f"{field} should be mandatory"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("phone", "12345"),
        ("phone", "12345678901"),
        ("full_name", "A"),
        ("abha_id", "1"),
        ("gender", "malee"),
    ],
)
async def test_invalid_values_rejected(client, auth_headers, field, bad_value):
    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER, json=_payload(**{field: bad_value}), headers=headers
    )
    assert resp.status_code == 422, f"{field}={bad_value!r} should be rejected"


@pytest.mark.asyncio
async def test_caller_supplied_password_is_honoured(client, auth_headers):
    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER, json=_payload(password="Chosen@123"), headers=headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["password"] == "Chosen@123"


@pytest.mark.asyncio
async def test_generated_password_is_usable_and_well_formed(client, auth_headers):
    headers = await auth_headers(role="asha")
    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    password = resp.json()["password"]

    # Pat@<last4 of phone><4 random>, long enough for the 8-char login minimum.
    assert re.fullmatch(r"Pat@\d{4}[A-Za-z0-9]{4}", password), password
    assert password.startswith("Pat@3301")
    assert len(password) >= 8


@pytest.mark.asyncio
async def test_any_ten_digit_number_is_accepted(client, auth_headers):
    """Exactly 10 digits, digits only — no leading-digit restriction."""
    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER,
        json=_payload(phone="1234567890", abha_id="55-5555-6666-7777"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["phone"] == "1234567890"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "phone",
    ["123456789", "12345678901", "12345abcde", "987654321a"],
)
async def test_phone_must_be_exactly_ten_digits(client, auth_headers, phone):
    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER, json=_payload(phone=phone), headers=headers
    )
    assert resp.status_code == 422, f"{phone!r} should be rejected"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("submitted", "stored"),
    [
        ("o+", "O+"),
        ("ab-", "AB-"),
        ("B+", "B+"),
        ("  o-  ", "O-"),
    ],
)
async def test_blood_group_is_normalised_and_stored(
    client, auth_headers, db_session, submitted, stored
):
    from sqlalchemy import select

    from app.models.beneficiary import Beneficiary

    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER,
        json=_payload(blood_group=submitted, abha_id=f"BG-{stored}-ID"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text

    beneficiary = (
        await db_session.execute(
            select(Beneficiary).where(Beneficiary.phone == "9876543301")
        )
    ).scalar_one()
    assert beneficiary.blood_group == stored


@pytest.mark.asyncio
async def test_blood_group_is_optional(client, auth_headers, db_session):
    from sqlalchemy import select

    from app.models.beneficiary import Beneficiary

    headers = await auth_headers(role="asha")
    resp = await client.post(REGISTER, json=_payload(), headers=headers)
    assert resp.status_code == 201, resp.text

    beneficiary = (
        await db_session.execute(
            select(Beneficiary).where(Beneficiary.phone == "9876543301")
        )
    ).scalar_one()
    assert beneficiary.blood_group is None


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_value", ["X+", "1+", "O", "AB", "O++"])
async def test_invalid_blood_group_rejected(client, auth_headers, bad_value):
    headers = await auth_headers(role="asha")
    resp = await client.post(
        REGISTER, json=_payload(blood_group=bad_value), headers=headers
    )
    assert resp.status_code == 422, f"blood_group={bad_value!r} should be rejected"
