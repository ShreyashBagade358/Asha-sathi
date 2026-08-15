import pytest


@pytest.mark.asyncio
async def test_create_beneficiary(client, auth_headers):
    headers = await auth_headers()
    resp = await client.post(
        "/api/v1/beneficiaries",
        json={
            "beneficiary_id": "B10001",
            "full_name": "Sunita Devi",
            "gender": "female",
            "age_years": 28,
            "phone": "9876543210",
            "status": "active",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["full_name"] == "Sunita Devi"
    assert body["beneficiary_id"] == "B10001"
    assert body["id"]


@pytest.mark.asyncio
async def test_create_duplicate_beneficiary(client, auth_headers):
    headers = await auth_headers()
    payload = {"beneficiary_id": "B20001", "full_name": "Duplicate", "gender": "female", "status": "active"}
    first = await client.post("/api/v1/beneficiaries", json=payload, headers=headers)
    assert first.status_code == 201
    second = await client.post("/api/v1/beneficiaries", json=payload, headers=headers)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_list_beneficiaries(client, auth_headers):
    headers = await auth_headers()
    await client.post(
        "/api/v1/beneficiaries",
        json={"beneficiary_id": "B30001", "full_name": "Rekha", "gender": "female", "status": "active"},
        headers=headers,
    )
    resp = await client.get("/api/v1/beneficiaries", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert resp.json()["items"][0]["full_name"] == "Rekha"


@pytest.mark.asyncio
async def test_search_beneficiaries_by_query(client, auth_headers):
    headers = await auth_headers()
    await client.post(
        "/api/v1/beneficiaries",
        json={"beneficiary_id": "B40001", "full_name": "Geeta Sharma", "gender": "female", "status": "active"},
        headers=headers,
    )
    resp = await client.get("/api/v1/beneficiaries?q=Geeta", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_get_beneficiary(client, auth_headers):
    headers = await auth_headers()
    created = await client.post(
        "/api/v1/beneficiaries",
        json={"beneficiary_id": "B50001", "full_name": "Asha Kumari", "gender": "female", "status": "active"},
        headers=headers,
    )
    beneficiary_id = created.json()["id"]
    resp = await client.get(f"/api/v1/beneficiaries/{beneficiary_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == beneficiary_id


@pytest.mark.asyncio
async def test_get_missing_beneficiary(client, auth_headers):
    headers = await auth_headers()
    resp = await client.get("/api/v1/beneficiaries/does-not-exist", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_beneficiary_has_abha_and_village_filters(client, db_session, auth_headers):
    from app.models.admin import Block, District, PHC, State, SubCenter, Village
    from app.models.beneficiary import Beneficiary, Household

    headers = await auth_headers()

    state = State(code="UP", name="Uttar Pradesh")
    db_session.add(state)
    await db_session.flush()
    district = District(state_id=state.id, code="LKO", name="Lucknow")
    db_session.add(district)
    await db_session.flush()
    block = Block(district_id=district.id, code="SRJ", name="Sarojini Nagar")
    db_session.add(block)
    await db_session.flush()
    phc = PHC(block_id=block.id, code="SRJ01", name="PHC Sarojini Nagar")
    db_session.add(phc)
    await db_session.flush()
    sub_center = SubCenter(phc_id=phc.id, code="SRJ0101", name="Sub Center 1")
    db_session.add(sub_center)
    await db_session.flush()
    village = Village(sub_center_id=sub_center.id, code="VLG01", name="Khasra")
    db_session.add(village)
    await db_session.flush()

    hh = Household(hhid="HH-100", village_id=village.id, asha_id="no-asha")
    db_session.add(hh)
    await db_session.flush()

    db_session.add(
        Beneficiary(beneficiary_id="B50001", full_name="With ABHA", gender="female", household_id=hh.id, abha_id="91-1000-1234")
    )
    db_session.add(
        Beneficiary(beneficiary_id="B50002", full_name="No ABHA", gender="female", household_id=hh.id)
    )
    await db_session.commit()

    resp = await client.get("/api/v1/beneficiaries?has_abha=true", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["full_name"] == "With ABHA"

    resp = await client.get("/api/v1/beneficiaries?has_abha=false", headers=headers)
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["full_name"] == "No ABHA"

    resp = await client.get("/api/v1/beneficiaries?village=Khasra", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    item = resp.json()["items"][0]
    assert item["village"] == "Khasra"
    assert item["village_id"] == village.id
