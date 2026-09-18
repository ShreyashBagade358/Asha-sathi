"""Full-system CRUD + permission-boundary tests.

Exercises create -> read -> update -> delete for every core entity through the
public HTTP API, plus role-gating ("who can and who cannot"). Uses disposable
TEST- prefixed records; the conftest truncates all tables before each test.
"""

import uuid
from datetime import date, timedelta

import pytest

from app.models.admin import PHC, Block, District, State, SubCenter

pytestmark = pytest.mark.asyncio

TODAY = date.today()


def _uid() -> str:
    return uuid.uuid4().hex[:12]


def _phone() -> str:
    return "6" + "".join(str(int(uuid.uuid4().hex[i], 16) % 10) for i in range(9))


async def _seed_beneficiary(
    client, headers, household_id: str | None = None
) -> dict:
    resp = await client.post(
        "/api/v1/beneficiaries",
        headers=headers,
        json={
            "beneficiary_id": f"TEST-{_uid().upper()}",
            "household_id": household_id,
            "full_name": "CRUD Test Patient",
            "gender": "female",
            "phone": _phone(),
            "status": "active",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Household + Beneficiary CRUD
# ---------------------------------------------------------------------------


async def test_household_and_beneficiary_crud(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")

    # CREATE household
    r = await client.post(
        "/api/v1/households",
        headers=headers,
        json={"hhid": f"TEST-HH-{_uid().upper()}", "village_id": _uid(), "address": "1 Main Rd"},
    )
    assert r.status_code == 201, r.text
    hh = r.json()

    # READ
    r = await client.get(f"/api/v1/households/{hh['id']}", headers=headers)
    assert r.status_code == 200 and r.json()["asha_id"] == hh["asha_id"]

    # UPDATE
    r = await client.put(
        f"/api/v1/households/{hh['id']}", headers=headers, json={"address": "2 Main Rd"}
    )
    assert r.status_code == 200 and r.json()["address"] == "2 Main Rd"

    # CREATE beneficiary linked to household
    b = await _seed_beneficiary(client, headers, household_id=hh["id"])
    assert b["household_id"] == hh["id"]

    # beneficiary read by id and by beneficiary_id
    r = await client.get(f"/api/v1/beneficiaries/{b['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/beneficiaries/{b['beneficiary_id']}", headers=headers)
    assert r.status_code == 200

    # household members list includes the beneficiary
    r = await client.get(f"/api/v1/households/{hh['id']}/members", headers=headers)
    assert r.status_code == 200
    assert any(m["id"] == b["id"] for m in r.json()["items"])

    # UPDATE beneficiary
    r = await client.put(
        f"/api/v1/beneficiaries/{b['id']}", headers=headers, json={"full_name": "CRUD Test Updated"}
    )
    assert r.status_code == 200 and r.json()["full_name"] == "CRUD Test Updated"

    # SOFT DELETE beneficiary -> status inactive (still readable)
    r = await client.delete(f"/api/v1/beneficiaries/{b['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/beneficiaries/{b['id']}", headers=headers)
    assert r.status_code == 200 and r.json()["status"] == "inactive"

    # HARD DELETE household
    r = await client.delete(f"/api/v1/households/{hh['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/households/{hh['id']}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Pregnancy + ANC/PNC/Delivery/Birth plan
# ---------------------------------------------------------------------------


async def test_pregnancy_lifecycle_crud(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    b = await _seed_beneficiary(client, headers)

    lmp = TODAY - timedelta(days=120)
    edd = TODAY + timedelta(days=160)
    r = await client.post(
        "/api/v1/pregnancies",
        headers=headers,
        json={"beneficiary_id": b["id"], "lmp": lmp.isoformat(), "edd": edd.isoformat(), "risk_level": "high"},
    )
    assert r.status_code == 201, r.text
    preg = r.json()

    r = await client.get(f"/api/v1/pregnancies/{preg['id']}", headers=headers)
    assert r.status_code == 200 and r.json()["risk_level"] == "high"

    r = await client.put(
        f"/api/v1/pregnancies/{preg['id']}", headers=headers, json={"risk_level": "medium"}
    )
    assert r.status_code == 200 and r.json()["risk_level"] == "medium"

    # ANC visit increments anc_count and sets last_anc_date
    r = await client.post(
        f"/api/v1/pregnancies/{preg['id']}/anc",
        headers=headers,
        json={"visit_number": 1, "visit_date": TODAY.isoformat(), "bp_systolic": 120},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/pregnancies/{preg['id']}", headers=headers)
    assert r.json()["anc_count"] == 1 and r.json()["last_anc_date"] == TODAY.isoformat()

    r = await client.get(f"/api/v1/pregnancies/{preg['id']}/anc", headers=headers)
    assert r.status_code == 200 and len(r.json()) == 1

    # PNC visit
    r = await client.post(
        f"/api/v1/pregnancies/{preg['id']}/pnc",
        headers=headers,
        json={"visit_number": 1, "visit_date": TODAY.isoformat()},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/pregnancies/{preg['id']}/pnc", headers=headers)
    assert r.status_code == 200 and len(r.json()) == 1

    # Birth plan create + update
    r = await client.post(
        f"/api/v1/pregnancies/{preg['id']}/birth-plan",
        headers=headers,
        json={"transport_arranged": True, "companion_name": "Ramesh"},
    )
    assert r.status_code == 201, r.text
    r = await client.put(
        f"/api/v1/pregnancies/{preg['id']}/birth-plan",
        headers=headers,
        json={"companion_name": "Suresh", "transport_arranged": False},
    )
    assert r.status_code == 200 and r.json()["companion_name"] == "Suresh"

    # Delivery -> pregnancy marked delivered
    r = await client.post(
        f"/api/v1/pregnancies/{preg['id']}/delivery",
        headers=headers,
        json={"place_of_delivery": "phc", "outcome": "live", "birth_weight_grams": 2900},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/pregnancies/{preg['id']}", headers=headers)
    assert r.json()["status"] == "delivered"
    r = await client.get(f"/api/v1/pregnancies/{preg['id']}/delivery", headers=headers)
    assert r.status_code == 200 and r.json()["birth_weight_grams"] == 2900

    # Hard delete pregnancy
    r = await client.delete(f"/api/v1/pregnancies/{preg['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/pregnancies/{preg['id']}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Child + Immunization/HBNC/HBYC/Growth
# ---------------------------------------------------------------------------


async def test_child_health_crud(client, auth_headers, db_session):
    headers = await auth_headers(phone="9876543210", role="asha")
    b = await _seed_beneficiary(client, headers)

    r = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"beneficiary_id": b["id"], "birth_weight_grams": 2750, "gestation_weeks": 38},
    )
    assert r.status_code == 201, r.text
    child = r.json()

    r = await client.get(f"/api/v1/children/{child['id']}", headers=headers)
    assert r.status_code == 200

    # Immunization create + status update
    r = await client.post(
        f"/api/v1/children/{child['id']}/immunizations",
        headers=headers,
        json={"child_id": child["id"], "vaccine_code": "BCG", "dose_number": 1, "status": "given"},
    )
    assert r.status_code == 201, r.text
    imm = r.json()
    r = await client.put(
        f"/api/v1/children/immunizations/{imm['id']}",
        headers=headers,
        json={"status": "overdue", "given_date": None},
    )
    assert r.status_code == 200 and r.json()["status"] == "overdue"

    # Growth record
    r = await client.post(
        f"/api/v1/children/{child['id']}/growth",
        headers=headers,
        json={"record_date": TODAY.isoformat(), "weight_kg": 3.2, "muac_mm": 125},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/children/{child['id']}/growth", headers=headers)
    assert r.status_code == 200 and len(r.json()) == 1

    # HBNC + HBYC
    r = await client.post(
        f"/api/v1/children/{child['id']}/hbnc",
        headers=headers,
        json={"visit_number": 1, "visit_date": TODAY.isoformat(), "weight_grams": 2900},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        f"/api/v1/children/{child['id']}/hbyc",
        headers=headers,
        json={"visit_number": 1, "visit_date": TODAY.isoformat(), "age_months": 6, "weight_kg": 6.8},
    )
    assert r.status_code == 201, r.text

    # Hard delete child
    r = await client.delete(f"/api/v1/children/{child['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/children/{child['id']}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Eligible Couple
# ---------------------------------------------------------------------------


async def test_eligible_couple_crud(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    husband = await _seed_beneficiary(client, headers)
    wife = await _seed_beneficiary(client, headers)

    r = await client.post(
        "/api/v1/eligible-couples",
        headers=headers,
        json={"husband_id": husband["id"], "wife_id": wife["id"], "status": "active"},
    )
    assert r.status_code == 201, r.text
    ec = r.json()

    r = await client.put(
        f"/api/v1/eligible-couples/{ec['id']}", headers=headers, json={"current_method": "condom"}
    )
    assert r.status_code == 200 and r.json()["current_method"] == "condom"

    r = await client.post(
        f"/api/v1/eligible-couples/{ec['id']}/followups",
        headers=headers,
        json={"followup_date": TODAY.isoformat(), "method_used": "condom"},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/eligible-couples/{ec['id']}/followups", headers=headers)
    assert r.status_code == 200 and len(r.json()) == 1

    r = await client.delete(f"/api/v1/eligible-couples/{ec['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/eligible-couples/{ec['id']}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Referral lifecycle (state machine + 409)
# ---------------------------------------------------------------------------


async def test_referral_lifecycle(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    b = await _seed_beneficiary(client, headers)

    r = await client.post(
        "/api/v1/referrals",
        headers=headers,
        json={
            "beneficiary_id": b["id"],
            "referral_type": "specialist",
            "urgency": "urgent",
            "reason": "Fever > 5 days",
        },
    )
    assert r.status_code == 201, r.text
    ref = r.json()
    assert ref["status"] == "initiated"

    r = await client.post(f"/api/v1/referrals/{ref['id']}/accept", headers=headers)
    assert r.status_code == 200 and r.json()["status"] == "accepted"

    # Re-accept must 409
    r = await client.post(f"/api/v1/referrals/{ref['id']}/accept", headers=headers)
    assert r.status_code == 409

    r = await client.post(f"/api/v1/referrals/{ref['id']}/complete", headers=headers)
    assert r.status_code == 200 and r.json()["status"] == "completed"

    # Followup
    r = await client.post(
        f"/api/v1/referrals/{ref['id']}/followups",
        headers=headers,
        json={"followup_date": TODAY.isoformat(), "beneficiary_status": "stable"},
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/referrals/{ref['id']}/followups", headers=headers)
    assert r.status_code == 200 and len(r.json()) == 1

    # Update outcome
    r = await client.put(
        f"/api/v1/referrals/{ref['id']}", headers=headers, json={"outcome": "recovered"}
    )
    assert r.status_code == 200 and r.json()["outcome"] == "recovered"

    # Hard delete
    r = await client.delete(f"/api/v1/referrals/{ref['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/referrals/{ref['id']}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# NCD, Death, Disease
# ---------------------------------------------------------------------------


async def test_ncd_and_death_and_disease_crud(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    b = await _seed_beneficiary(client, headers)

    # NCD
    r = await client.post(
        "/api/v1/ncd",
        headers=headers,
        json={
            "beneficiary_id": b["id"],
            "screening_date": TODAY.isoformat(),
            "bp_systolic": 150,
            "referral_made": True,
        },
    )
    assert r.status_code == 201, r.text
    ncd = r.json()
    r = await client.get(f"/api/v1/ncd/{ncd['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get("/api/v1/ncd/due", headers=headers, params={"from_date": "2026-01-01"})
    assert r.status_code == 200
    r = await client.delete(f"/api/v1/ncd/{ncd['id']}", headers=headers)
    assert r.status_code == 200
    assert (await client.get(f"/api/v1/ncd/{ncd['id']}", headers=headers)).status_code == 404

    # Death report
    r = await client.post(
        "/api/v1/deaths",
        headers=headers,
        json={
            "beneficiary_id": b["id"],
            "death_date": TODAY.isoformat(),
            "cause_of_death": "Cardiac arrest",
            "icd10_code": "I46",
        },
    )
    assert r.status_code == 201, r.text
    death = r.json()
    r = await client.put(
        f"/api/v1/deaths/{death['id']}", headers=headers, json={"cause_of_death": "Myocardial infarction"}
    )
    assert r.status_code == 200 and r.json()["cause_of_death"] == "Myocardial infarction"
    r = await client.delete(f"/api/v1/deaths/{death['id']}", headers=headers)
    assert r.status_code == 200
    assert (await client.get(f"/api/v1/deaths/{death['id']}", headers=headers)).status_code == 404

    # Disease case
    r = await client.post(
        "/api/v1/diseases",
        headers=headers,
        json={"disease_type": "malaria", "beneficiary_id": b["id"], "status": "suspected"},
    )
    assert r.status_code == 201, r.text
    disease = r.json()
    r = await client.put(
        f"/api/v1/diseases/{disease['id']}",
        headers=headers,
        json={"disease_type": disease["disease_type"], "status": "confirmed", "lab_confirmed": True},
    )
    assert r.status_code == 200 and r.json()["status"] == "confirmed"
    r = await client.delete(f"/api/v1/diseases/{disease['id']}", headers=headers)
    assert r.status_code == 200
    assert (await client.get(f"/api/v1/diseases/{disease['id']}", headers=headers)).status_code == 404


# ---------------------------------------------------------------------------
# ASHA admin directory (admin roles only)
# ---------------------------------------------------------------------------


async def test_asha_directory_crud_admin_only(client, auth_headers):
    admin = await auth_headers(phone="9876543212", role="moic")
    asha = await auth_headers(phone="9876543210", role="asha")

    r = await client.post(
        "/api/v1/ashas",
        headers=admin,
        json={"name": "CRUD New ASHA", "phone": _phone(), "status": "active"},
    )
    assert r.status_code == 201, r.text
    new_asha = r.json()

    r = await client.get(f"/api/v1/ashas/{new_asha['asha_id']}", headers=admin)
    assert r.status_code == 200

    r = await client.patch(
        f"/api/v1/ashas/{new_asha['asha_id']}", headers=admin, json={"name": "CRUD ASHA Renamed"}
    )
    assert r.status_code == 200

    # asha must NOT see admin directory
    r = await client.get("/api/v1/ashas", headers=asha)
    assert r.status_code == 403
    r = await client.get("/api/v1/ashas", headers=admin)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# User management (super_admin / state_admin only)
# ---------------------------------------------------------------------------


async def test_user_management_crud_super_admin_only(client, auth_headers):
    super_admin = await auth_headers(phone="9876543215", role="super_admin")
    asha = await auth_headers(phone="9876543210", role="asha")
    moic = await auth_headers(phone="9876543212", role="moic")

    r = await client.post(
        "/api/v1/users",
        headers=super_admin,
        json={"role": "anm", "phone": _phone(), "full_name": "CRUD New ANM"},
    )
    assert r.status_code == 201, r.text
    u = r.json()

    r = await client.get(f"/api/v1/users/{u['id']}", headers=super_admin)
    assert r.status_code == 200

    r = await client.put(
        f"/api/v1/users/{u['id']}", headers=super_admin, json={"full_name": "CRUD ANM Updated"}
    )
    assert r.status_code == 200 and r.json()["full_name"] == "CRUD ANM Updated"

    r = await client.delete(f"/api/v1/users/{u['id']}", headers=super_admin)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/users/{u['id']}", headers=super_admin)
    assert r.status_code == 200 and r.json()["is_active"] is False

    # asha and moic must be refused
    assert (await client.get("/api/v1/users", headers=asha)).status_code == 403
    assert (await client.get("/api/v1/users", headers=moic)).status_code == 403


# ---------------------------------------------------------------------------
# Notifications (broadcast gated to moic+; reminders, mark-read)
# ---------------------------------------------------------------------------


async def test_notifications_crud_and_broadcast_guard(client, auth_headers):
    moic = await auth_headers(phone="9876543212", role="moic")
    asha_headers = await auth_headers(phone="9876543210", role="asha")

    me = await client.get("/api/v1/auth/me", headers=moic)
    assert me.status_code == 200, me.text
    moic_id = me.json()["id"]

    r = await client.post(
        "/api/v1/notifications",
        headers=moic,
        json={"user_id": moic_id, "type": "alert", "title": "Test Notice", "message": "Hello"},
    )
    assert r.status_code == 201, r.text
    note = r.json()

    r = await client.put(f"/api/v1/notifications/{note['id']}/read", headers=moic)
    assert r.status_code == 200 and r.json()["read_at"] is not None

    r = await client.get("/api/v1/notifications", headers=moic)
    assert r.status_code == 200

    # broadcast: moic ok, asha refused
    r = await client.post(
        "/api/v1/notifications/broadcast", headers=moic, json={"title": "PHC Bulletin", "message": "Meeting at 10am"}
    )
    assert r.status_code == 200, r.text
    r = await client.post(
        "/api/v1/notifications/broadcast", headers=asha_headers, json={"title": "x", "message": "y"}
    )
    assert r.status_code == 403

    # reminder schedule
    r = await client.post(
        "/api/v1/notifications/reminders/schedules",
        headers=asha_headers,
        json={"beneficiary_id": _uid(), "reminder_type": "anc", "due_date": TODAY.isoformat()},
    )
    assert r.status_code == 201, r.text
    r = await client.get("/api/v1/notifications/reminders/schedules", headers=asha_headers)
    assert r.status_code == 200 and len(r.json()["items"]) == 1


# ---------------------------------------------------------------------------
# Config village creation (any authenticated user; PHC must exist)
# ---------------------------------------------------------------------------


async def test_create_village_admin_chain(db_session, client, auth_headers):
    async def _mk(model, **kw):
        obj = model(**kw)
        db_session.add(obj)
        await db_session.flush()
        return obj

    state = await _mk(State, code="ST", name=f"TEST State {_uid()}")
    district = await _mk(District, code="DT", name=f"TEST Dist {_uid()}", state_id=state.id)
    block = await _mk(Block, code="BL", name=f"TEST Block {_uid()}", district_id=district.id)
    phc = await _mk(PHC, code="PH", name=f"TEST PHC {_uid()}", block_id=block.id)
    await _mk(SubCenter, code="SC", name=f"TEST SC {_uid()}", phc_id=phc.id)
    await db_session.commit()

    headers = await auth_headers(phone="9876543210", role="asha")
    r = await client.post(
        f"/api/v1/config/phc/{phc.id}/villages",
        headers=headers,
        json={"name": f"TEST Village {_uid()}", "total_population": 1200},
    )
    assert r.status_code == 201, r.text
    village_id = r.json()["id"]

    r = await client.get(f"/api/v1/config/phc/{phc.id}/villages", headers=headers)
    assert r.status_code == 200 and any(v["id"] == village_id for v in r.json())


# ---------------------------------------------------------------------------
# Verification flow (admin verifier)
# ---------------------------------------------------------------------------


async def test_verification_approve_reject(client, auth_headers):
    asha = await auth_headers(phone="9876543210", role="asha")
    moic = await auth_headers(phone="9876543212", role="moic")
    b = await _seed_beneficiary(client, asha)

    r = await client.post(
        "/api/v1/deaths",
        headers=asha,
        json={"beneficiary_id": b["id"], "death_date": TODAY.isoformat(), "cause_of_death": "Sepsis"},
    )
    assert r.status_code == 201, r.text
    death = r.json()

    r = await client.get("/api/v1/verification/pending", headers=moic)
    assert r.status_code == 200
    assert any(item["id"] == death["id"] for item in r.json().get("items", []))

    r = await client.post(f"/api/v1/verification/death_report/{death['id']}/approve", headers=moic)
    assert r.status_code == 200, r.text
    assert "verified" in r.json()["message"]

    # asha is not a verifier
    r = await client.get("/api/v1/verification/pending", headers=asha)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Sanitize + Audit (admin only)
# ---------------------------------------------------------------------------


async def test_sanitize_and_audit_admin_gated(client, auth_headers):
    moic = await auth_headers(phone="9876543212", role="moic")
    asha = await auth_headers(phone="9876543210", role="asha")

    r = await client.get("/api/v1/sanitize/summary", headers=moic)
    assert r.status_code == 200
    assert r.json()["beneficiaries_total"] >= 0

    r = await client.post(
        "/api/v1/sanitize/fix", headers=moic, json={"actions": ["fix_beneficiary_phones"]}
    )
    assert r.status_code == 200 and r.json()["success"] is True

    r = await client.get("/api/v1/audit/logs", headers=moic)
    assert r.status_code == 200
    assert r.json()["items"] == [] or isinstance(r.json()["items"], list)

    assert (await client.get("/api/v1/sanitize/summary", headers=asha)).status_code == 403
    assert (await client.get("/api/v1/audit/logs", headers=asha)).status_code == 403


# ---------------------------------------------------------------------------
# Dashboard + Reports (read-only, any role)
# ---------------------------------------------------------------------------


async def test_dashboard_and_reports_readonly(db_session, client, auth_headers):
    state = State(code="ST", name=f"TEST State {_uid()}")
    db_session.add(state)
    await db_session.flush()
    district = District(code="DT", name=f"TEST Dist {_uid()}", state_id=state.id)
    db_session.add(district)
    await db_session.flush()
    block = Block(code="BL", name=f"TEST Block {_uid()}", district_id=district.id)
    db_session.add(block)
    await db_session.flush()
    phc = PHC(code="PH", name=f"TEST PHC {_uid()}", block_id=block.id)
    db_session.add(phc)
    await db_session.commit()

    headers = await auth_headers(
        phone="9876543210", role="asha", state_id=state.id, district_id=district.id, phc_id=phc.id
    )

    for ep in ("/api/v1/dashboard/kpis", "/api/v1/dashboard/phc", "/api/v1/dashboard/state"):
        r = await client.get(ep, headers=headers)
        assert r.status_code == 200, f"{ep}: {r.status_code} {r.text}"

    for kind in ("asha-performance", "maternal-health", "child-health", "immunization", "ncd", "incentives"):
        r = await client.get(
            f"/api/v1/reports/{kind}",
            headers=headers,
            params={"period_start": "2026-01-01", "period_end": "2026-12-31"},
        )
        assert r.status_code == 200, f"reports/{kind}: {r.status_code} {r.text}"

    assert (await client.get("/api/v1/vaccination/coverage", headers=headers)).status_code == 200


# ---------------------------------------------------------------------------
# Sync device + status
# ---------------------------------------------------------------------------


async def test_sync_device_register_and_status(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")

    r = await client.post(
        "/api/v1/sync/devices/register",
        headers=headers,
        json={"device_id": f"TEST-DEV-{_uid()}", "app_version": "1.0", "platform": "android", "fcm_token": "tok"},
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/sync/status", headers=headers)
    assert r.status_code == 200
    assert r.json()["online"] is True

    r = await client.post(
        "/api/v1/sync/pull",
        headers=headers,
        json={"last_pull_at": "2020-01-01T00:00:00Z", "tables": ["beneficiaries"]},
    )
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# Permission boundary sweep (negative tests)
# ---------------------------------------------------------------------------


async def test_permission_boundary_sweep(client, auth_headers):
    asha = await auth_headers(phone="9876543210", role="asha")
    anm = await auth_headers(phone="9876543211", role="anm")
    state_admin = await auth_headers(phone="9876543214", role="state_admin")

    assert (await client.get("/api/v1/users", headers=anm)).status_code == 403
    assert (await client.get("/api/v1/ashas", headers=asha)).status_code == 403
    assert (await client.get("/api/v1/audit/logs", headers=asha)).status_code == 403
    assert (await client.get("/api/v1/sanitize/summary", headers=asha)).status_code == 403
    assert (await client.get("/api/v1/verification/pending", headers=asha)).status_code == 403
    assert (
        await client.post("/api/v1/notifications/broadcast", headers=anm, json={"title": "x", "message": "y"})
    ).status_code == 403
    # state_admin can create users (allowed) but not the asha-only self scopes improperly
    assert (await client.get("/api/v1/users", headers=state_admin)).status_code == 200


async def test_inactive_user_rejected(db_session, client, auth_headers):
    from sqlalchemy import select

    from app.models.user import User

    headers = await auth_headers(phone="9876543299", role="asha")
    r = await client.get("/api/v1/dashboard/kpis", headers=headers)
    assert r.status_code == 200  # active user OK

    # deactivate -> must now be 401
    user = (await db_session.execute(select(User).where(User.phone == "9876543299"))).scalar_one()
    user.is_active = False
    await db_session.commit()
    r = await client.get("/api/v1/dashboard/kpis", headers=headers)
    assert r.status_code == 401


async def test_child_requires_existing_beneficiary(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    r = await client.post(
        "/api/v1/children", headers=headers, json={"beneficiary_id": _uid(), "birth_weight_grams": 2500}
    )
    assert r.status_code == 404