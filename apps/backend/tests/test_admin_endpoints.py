import pytest

from app.models.admin import PHC, Block, District, State


async def _seed_org(db_session):
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
    await db_session.commit()
    return district, phc


@pytest.mark.asyncio
async def test_config_put_creates_then_updates_bumping_version(client, auth_headers):
    headers = await auth_headers(phone="9876543299", role="admin")
    body = {
        "configs": [
            {
                "config_key": "feature.dark_mode",
                "config_value": {"enabled": True},
                "description": "dark mode flag",
                "is_public": True,
            }
        ]
    }

    resp = await client.put("/api/v1/config/app", json=body, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] == 1
    assert data["items"][0]["config_key"] == "feature.dark_mode"
    assert data["items"][0]["scope"] == "app"
    assert data["items"][0]["version"] == 1

    body["configs"][0]["config_value"] = {"enabled": False}
    resp = await client.put("/api/v1/config/app", json=body, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] == 1
    assert data["items"][0]["version"] == 2
    assert data["items"][0]["config_value"] == {"enabled": False}

    full = await client.get("/api/v1/config/app/full", headers=headers)
    assert full.status_code == 200
    stored = [i for i in full.json()["items"] if i["config_key"] == "feature.dark_mode"]
    assert len(stored) == 1
    assert stored[0]["version"] == 2
    assert stored[0]["config_value"] == {"enabled": False}


@pytest.mark.asyncio
async def test_config_put_requires_admin(client, auth_headers):
    headers = await auth_headers(phone="9876543298", role="asha")
    resp = await client.put(
        "/api/v1/config/app",
        json={"configs": [{"config_key": "k", "config_value": {}, "is_public": True}]},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_system_status_requires_auth(client):
    resp = await client.get("/api/v1/system/status")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_system_status_shape(client, auth_headers):
    headers = await auth_headers(phone="9876543297", role="asha")
    resp = await client.get("/api/v1/system/status", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert set(data) >= {"api", "database", "models", "counts"}

    api = data["api"]
    assert api["status"] == "ok"
    assert api["version"] == "1.0.0"
    assert isinstance(api["started_at"], str)
    assert isinstance(api["uptime_seconds"], int)

    database = data["database"]
    assert database["status"] in {"ok", "error"}
    assert isinstance(database["latency_ms"], int)

    models = data["models"]
    assert isinstance(models["available"], int)
    assert isinstance(models["total"], int)
    assert models["available"] <= models["total"]

    counts = data["counts"]
    for key in ("users", "asha_workers", "beneficiaries", "pregnancies"):
        assert isinstance(counts[key], int)


@pytest.mark.asyncio
async def test_allocation_post_and_get_round_trip(client, db_session, auth_headers):
    district, phc = await _seed_org(db_session)
    headers = await auth_headers(phone="9876543296", role="admin")

    resp = await client.post(
        "/api/v1/resources/allocations",
        json={"phc_id": phc.id, "resource_type": "vaccines", "quantity": 25, "notes": "Covaxin stock"},
        headers=headers,
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["phc_id"] == phc.id
    assert created["phc_name"] == "PHC Sarojini Nagar"
    assert created["resource_type"] == "vaccines"
    assert created["quantity"] == 25
    assert created["notes"] == "Covaxin stock"
    assert created["district_id"] == district.id
    assert created["created_at"]

    resp = await client.get("/api/v1/resources/allocations", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == created["id"]
    assert items[0]["phc_name"] == "PHC Sarojini Nagar"

    resp = await client.get(
        f"/api/v1/resources/allocations?district_id={district.id}", headers=headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.get("/api/v1/resources/allocations?district_id=missing", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_allocation_rejects_unknown_phc_and_non_admin(client, db_session, auth_headers):
    _district, phc = await _seed_org(db_session)
    admin = await auth_headers(phone="9876543295", role="admin")

    resp = await client.post(
        "/api/v1/resources/allocations",
        json={"phc_id": "does-not-exist", "resource_type": "staff", "quantity": 2},
        headers=admin,
    )
    assert resp.status_code == 404

    asha = await auth_headers(phone="9876543294", role="asha")
    resp = await client.post(
        "/api/v1/resources/allocations",
        json={"phc_id": phc.id, "resource_type": "staff", "quantity": 2},
        headers=asha,
    )
    assert resp.status_code == 403

    resp = await client.get("/api/v1/resources/allocations", headers=asha)
    assert resp.status_code == 403

    resp = await client.post(
        "/api/v1/resources/allocations",
        json={"phc_id": phc.id, "resource_type": "staff", "quantity": 0},
        headers=admin,
    )
    assert resp.status_code == 422
