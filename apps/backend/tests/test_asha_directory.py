from datetime import date

import pytest

from app.models.admin import PHC, Block, District, State, SubCenter, Village
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
    profile = ASHAProfile(
        user_id=asha.id, asha_id="ASHA-UP-LKO-0001", catchment_villages=[village.id], performance_score=87.5
    )
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
async def test_list_ashas_scoped_for_asha_role(client, db_session, auth_headers):
    """An ASHA caller may list the directory, but only within their own PHC.

    The registration form needs this to offer assignable workers. `_scope_filter`
    keeps the response inside the caller's district/block/PHC, so an ASHA never
    sees workers from another facility.
    """
    _, district, block, phc, sub_center, village = await _org(db_session)
    _asha, _profile = await _seed_asha(db_session, phc, village)

    # a worker belonging to a different PHC must stay invisible
    other_phc = PHC(block_id=block.id, code="SRJ02", name="Other PHC")
    db_session.add(other_phc)
    await db_session.flush()
    outsider = User(
        role="asha",
        phone="9876543214",
        full_name="Outsider Devi",
        phc_id=other_phc.id,
        district_id=district.id,
        is_active=True,
    )
    db_session.add(outsider)
    await db_session.flush()
    db_session.add(ASHAProfile(user_id=outsider.id, asha_id="ASHA-OTHER-0001"))
    await db_session.commit()

    # the caller is an ASHA anchored to `phc` (and, more broadly, to the
    # district/block above it — PHC must still win)
    headers = await auth_headers(
        phone="9876543213",
        role="asha",
        phc_id=phc.id,
        district_id=district.id,
        block_id=block.id,
    )

    resp = await client.get("/api/v1/ashas", headers=headers)
    assert resp.status_code == 200, resp.text
    names = {item["name"] for item in resp.json()["items"]}
    assert "Sunita Devi" in names
    assert "Outsider Devi" not in names, "worker from another PHC leaked into the ASHA's scope"


@pytest.mark.asyncio
async def test_asha_detail_still_admin_only(client, db_session, auth_headers):
    """Relaxing the list endpoint must not open per-worker detail to ASHAs."""
    _, _, _, phc, _, village = await _org(db_session)
    _, _profile = await _seed_asha(db_session, phc, village)
    await db_session.commit()

    headers = await auth_headers(phone="9876543213", role="asha")
    resp = await client.get("/api/v1/ashas/ASHA-UP-LKO-0001", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_ashas_forbidden_for_patient_role(client, auth_headers):
    """A patient is still refused the ASHA directory."""
    headers = await auth_headers(phone="9876543213", role="patient")
    resp = await client.get("/api/v1/ashas", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_ashas_sees_whole_deployment_for_admin(client, db_session, auth_headers):
    """The single ``admin`` role is unrestricted across the deployment.

    Before the supervisor tiers were merged, mid-tier roles (anm/moic/bpm/dpm)
    were scoped to their own district/block/phc and only state/super admin saw
    everything. With one role that is now ``admin``, so the directory is
    deployment-wide.
    """
    state, district, block, phc, sub_center, village = await _org(db_session)
    asha, profile = await _seed_asha(db_session, phc, village)

    other = User(role="asha", phone="9876543214", full_name="Other Devi", district_id=district.id, is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(ASHAProfile(user_id=other.id, asha_id="ASHA-OTHER-0001"))
    await db_session.commit()

    headers = await auth_headers(phone="9876543211", role="admin", phc_id=phc.id)
    resp = await client.get("/api/v1/ashas", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    # admin is unscoped, so the ASHA from another district is visible too
    assert body["total"] == 2
    items = {i["id"]: i for i in body["items"]}
    item = items[asha.id]
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

    headers = await auth_headers(phone="9876543211", role="admin", phc_id=phc.id)

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

    headers = await auth_headers(phone="9876543211", role="admin", phc_id=phc.id)

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

    headers = await auth_headers(phone="9876543211", role="admin", phc_id=phc.id)
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

    headers = await auth_headers(phone="9876543211", role="admin", phc_id=phc.id)
    resp = await client.get("/api/v1/dashboard/phc", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["entity"] == "phc"
    assert body["name"] == "PHC Sarojini Nagar"
    assert body["kpis"]["pregnancies"] == 5
    assert body["kpis"]["ncd_screenings"] == 20
    assert body["kpis"]["ashas"] == 1
