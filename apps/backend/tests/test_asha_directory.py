from datetime import date

import pytest

from app.models.admin import Block, District, PHC, State, SubCenter, Village
from app.models.beneficiary import Household
from app.models.task import ASHAKPI
from app.models.user import ASHAProfile, User


async def _org(db_session):
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
    village = Village(sub_center_id=sub_center.id, code="VLG01", name="Rampur")
    db_session.add(village)
    await db_session.flush()
    return state, district, block, phc, sub_center, village


async def _seed_asha(db_session, phc, village):
    asha = User(
        role="asha",
        phone="9876543210",
        full_name="Sunita Devi",
        phc_id=phc.id,
        village_id=village.id,
        is_active=True,
    )
    db_session.add(asha)
    await db_session.flush()
    profile = ASHAProfile(user_id=asha.id, asha_id="ASHA-UP-LKO-0001", catchment_villages=[village.id], performance_score=87.5)
    db_session.add(profile)
    db_session.add(Household(hhid="HH-001", village_id=village.id, asha_id=asha.id))
    db_session.add(Household(hhid="HH-002", village_id=village.id, asha_id=asha.id))
    await db_session.flush()
    return asha, profile


@pytest.mark.asyncio
async def test_list_ashas_requires_auth(client, db_session):
    resp = await client.get("/api/v1/ashas")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_ashas_forbidden_for_asha_role(client, auth_headers):
    headers = await auth_headers(phone="9876543213", role="asha")
    resp = await client.get("/api/v1/ashas", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_ashas_scoped_to_user_phc(client, db_session, auth_headers):
    state, district, block, phc, sub_center, village = await _org(db_session)
    asha, profile = await _seed_asha(db_session, phc, village)

    other = User(role="asha", phone="9876543214", full_name="Other Devi", district_id=district.id, is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(ASHAProfile(user_id=other.id, asha_id="ASHA-OTHER-0001"))
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="anm", phc_id=phc.id)
    resp = await client.get("/api/v1/ashas", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == asha.id
    assert item["asha_id"] == "ASHA-UP-LKO-0001"
    assert item["name"] == "Sunita Devi"
    assert item["village"] == "Rampur"
    assert item["phone"] == "9876543210"
    assert item["assigned_households"] == 2
    assert item["performance_score"] == 87.5
    assert item["status"] == "active"


@pytest.mark.asyncio
async def test_list_ashas_search_and_status_filter(client, db_session, auth_headers):
    state, district, block, phc, sub_center, village = await _org(db_session)
    await _seed_asha(db_session, phc, village)
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="anm", phc_id=phc.id)

    resp = await client.get("/api/v1/ashas", params={"q": "Sunita"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get("/api/v1/ashas", params={"q": "ASHA-UP-LKO"}, headers=headers)
    assert resp.json()["total"] == 1

    resp = await client.get("/api/v1/ashas", params={"q": "nomatch"}, headers=headers)
    assert resp.json()["total"] == 0

    resp = await client.get("/api/v1/ashas", params={"status": "inactive"}, headers=headers)
    assert resp.json()["total"] == 0

    resp = await client.get("/api/v1/ashas", params={"village": "Rampur"}, headers=headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_asha_detail_kpis_update_assign(client, db_session, auth_headers):
    state, district, block, phc, sub_center, village = await _org(db_session)
    asha, profile = await _seed_asha(db_session, phc, village)
    db_session.add(
        ASHAKPI(asha_id=asha.id, period_start=date(2024, 12, 1), period_type="monthly", pregnancy_registered=8)
    )
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="anm", phc_id=phc.id)

    detail = await client.get(f"/api/v1/ashas/{profile.asha_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["asha"]["name"] == "Sunita Devi"
    assert body["villages"] == ["Rampur"]
    assert body["assigned_beneficiaries"] == 2
    assert len(body["kpis"]) == 1

    kpis = await client.get(f"/api/v1/ashas/{profile.asha_id}/kpis", headers=headers)
    assert kpis.status_code == 200
    assert kpis.json()[0]["pregnancy_registered"] == 8

    updated = await client.patch(
        f"/api/v1/ashas/{profile.asha_id}",
        json={"name": "Sunita Rani", "status": "inactive"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Sunita Rani"
    assert updated.json()["status"] == "inactive"

    assigned = await client.post(
        f"/api/v1/ashas/{profile.asha_id}/villages",
        json={"villages": ["Rampur"]},
        headers=headers,
    )
    assert assigned.status_code == 200
    await db_session.refresh(profile)
    assert profile.catchment_villages == [village.id]


@pytest.mark.asyncio
async def test_create_asha(client, db_session, auth_headers):
    state, district, block, phc, sub_center, village = await _org(db_session)
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="anm", phc_id=phc.id)
    resp = await client.post(
        "/api/v1/ashas",
        json={"name": "Kavita Kumari", "phone": "9876543215", "village": "Rampur", "status": "active"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Kavita Kumari"
    assert body["status"] == "active"
    assert body["asha_id"].startswith("ASH-")

    dup = await client.post(
        "/api/v1/ashas",
        json={"name": "Dup", "phone": "9876543215", "village": "Rampur"},
        headers=headers,
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_dashboard_phc_resolves_from_user(client, db_session, auth_headers):
    state, district, block, phc, sub_center, village = await _org(db_session)
    asha, profile = await _seed_asha(db_session, phc, village)
    db_session.add(
        ASHAKPI(
            asha_id=asha.id,
            period_start=date(2024, 12, 1),
            period_type="monthly",
            pregnancy_registered=5,
            ncd_screenings=20,
        )
    )
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="anm", phc_id=phc.id)
    resp = await client.get("/api/v1/dashboard/phc", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["entity"] == "phc"
    assert body["name"] == "PHC Sarojini Nagar"
    assert body["kpis"]["pregnancies"] == 5
    assert body["kpis"]["ncd_screenings"] == 20
    assert body["kpis"]["ashas"] == 1
