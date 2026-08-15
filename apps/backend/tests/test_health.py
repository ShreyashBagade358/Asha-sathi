import pytest


async def _create_beneficiary(client, headers, bid="B90001"):
    resp = await client.post(
        "/api/v1/beneficiaries",
        json={
            "beneficiary_id": bid,
            "full_name": "Maternal Care",
            "gender": "female",
            "age_years": 24,
            "status": "active",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_pregnancy(client, auth_headers):
    headers = await auth_headers()
    beneficiary_id = await _create_beneficiary(client, headers)
    resp = await client.post(
        "/api/v1/pregnancies",
        json={
            "beneficiary_id": beneficiary_id,
            "lmp": "2025-06-01",
            "gravida": 2,
            "parity": 1,
            "risk_level": "medium",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["beneficiary_id"] == beneficiary_id
    assert body["status"] == "ongoing"
    assert body["risk_level"] == "medium"
    assert body["id"]


@pytest.mark.asyncio
async def test_create_anc_visit(client, auth_headers):
    headers = await auth_headers()
    beneficiary_id = await _create_beneficiary(client, headers)
    pregnancy = await client.post(
        "/api/v1/pregnancies",
        json={"beneficiary_id": beneficiary_id, "risk_level": "low"},
        headers=headers,
    )
    pregnancy_id = pregnancy.json()["id"]

    anc = await client.post(
        f"/api/v1/pregnancies/{pregnancy_id}/anc",
        json={
            "visit_number": 1,
            "visit_date": "2025-07-15",
            "bp_systolic": 118,
            "bp_diastolic": 76,
            "weight_kg": 52.5,
            "hemoglobin": 11.2,
        },
        headers=headers,
    )
    assert anc.status_code == 201
    body = anc.json()
    assert body["pregnancy_id"] == pregnancy_id
    assert body["bp_systolic"] == 118

    pregnancy_check = await client.get(f"/api/v1/pregnancies/{pregnancy_id}", headers=headers)
    assert pregnancy_check.json()["anc_count"] == 1


@pytest.mark.asyncio
async def test_list_anc_visits(client, auth_headers):
    headers = await auth_headers()
    beneficiary_id = await _create_beneficiary(client, headers)
    pregnancy = await client.post(
        "/api/v1/pregnancies",
        json={"beneficiary_id": beneficiary_id, "risk_level": "low"},
        headers=headers,
    )
    pregnancy_id = pregnancy.json()["id"]
    await client.post(
        f"/api/v1/pregnancies/{pregnancy_id}/anc",
        json={"visit_number": 1, "visit_date": "2025-07-15"},
        headers=headers,
    )
    resp = await client.get(f"/api/v1/pregnancies/{pregnancy_id}/anc", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_create_pregnancy_missing_beneficiary(client, auth_headers):
    headers = await auth_headers()
    resp = await client.post(
        "/api/v1/pregnancies",
        json={"beneficiary_id": "no-such-beneficiary", "risk_level": "low"},
        headers=headers,
    )
    assert resp.status_code == 404
