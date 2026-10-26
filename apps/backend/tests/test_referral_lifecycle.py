"""Full referral lifecycle: patient requests → ASHA sees → admin accepts → notifications fire → admin completes → notifications fire."""
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.security import create_access_token
from app.models.beneficiary import Beneficiary, Household
from app.models.notification import Notification
from app.models.referral import Referral
from app.models.user import User


@pytest_asyncio.fixture
async def setup(test_engine, user_factory):
    """ASHA + patient + beneficiary + household, all linked."""
    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    asha = await user_factory(phone="9000000001", role="asha", full_name="Test ASHA")
    patient = await user_factory(phone="9000000002", role="patient", full_name="Test Patient")
    admin = await user_factory(phone="9000000003", role="admin", full_name="Test Admin")

    async with maker() as session:
        household = Household(
            hhid="HH-TEST-001",
            village_id="V-TEST-001",
            asha_id=asha.id,
        )
        session.add(household)
        await session.flush()

        beneficiary = Beneficiary(
            beneficiary_id="BEN-TEST-001",
            household_id=household.id,
            full_name="Test Patient",
            gender="female",
            phone="9000000002",
            registered_by=asha.id,
            status="active",
        )
        session.add(beneficiary)
        await session.flush()

        patient_row = await session.get(User, patient.id)
        patient_row.beneficiary_id = beneficiary.id
        await session.commit()

    return {
        "asha_id": asha.id,
        "patient_id": patient.id,
        "admin_id": admin.id,
        "beneficiary_id": beneficiary.id,
    }


def _h(user_id):
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


async def _get_notifications(test_engine, user_id):
    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        result = await session.execute(
            select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at)
        )
        return list(result.scalars().all())


async def test_full_referral_lifecycle(client, test_engine, setup):
    pid = setup["patient_id"]
    aid = setup["asha_id"]
    admid = setup["admin_id"]

    # ── 1. Patient requests a referral ──
    resp = await client.post(
        "/api/v1/patients/me/referral-requests",
        headers=_h(pid),
        json={"referral_type": "specialist_review", "urgency": "urgent", "reason": "Persistent abdominal pain"},
    )
    assert resp.status_code == 201, resp.text
    referral_id = resp.json()["id"]
    assert resp.json()["status"] == "pending"

    # ── 2. ASHA got a notification ──
    asha_notifs = await _get_notifications(test_engine, aid)
    assert any(n.type == "referral_requested" for n in asha_notifs), \
        f"ASHA has no referral_requested notification. Got: {[n.type for n in asha_notifs]}"

    # ── 3. Patient did NOT get a self-notification ──
    patient_notifs = await _get_notifications(test_engine, pid)
    assert not any(n.type == "referral_requested" for n in patient_notifs)

    # ── 4. ASHA sees the referral as pending ──
    resp = await client.get("/api/v1/referrals", headers=_h(aid))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(r["id"] == referral_id for r in items), "ASHA cannot see the referral"

    # ── 5. Admin accepts the referral ──
    resp = await client.post(f"/api/v1/referrals/{referral_id}/accept", headers=_h(admid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"

    # ── 6. Patient got an acceptance notification ──
    patient_notifs = await _get_notifications(test_engine, pid)
    assert any(n.type == "referral_accepted" for n in patient_notifs), \
        f"Patient has no referral_accepted notification. Got: {[n.type for n in patient_notifs]}"

    # ── 7. ASHA got an acceptance notification ──
    asha_notifs = await _get_notifications(test_engine, aid)
    assert any(n.type == "referral_accepted" for n in asha_notifs), \
        f"ASHA has no referral_accepted notification. Got: {[n.type for n in asha_notifs]}"

    # ── 8. Patient's referral list shows accepted ──
    resp = await client.get("/api/v1/patients/me/referral-requests", headers=_h(pid))
    assert resp.status_code == 200
    my_referrals = resp.json()
    matching = [r for r in my_referrals if r["id"] == referral_id]
    assert matching, "Patient cannot see their own referral"
    assert matching[0]["status"] == "accepted", f"Expected accepted, got {matching[0]['status']}"

    # ── 9. Admin completes the referral ──
    resp = await client.post(
        f"/api/v1/referrals/{referral_id}/complete",
        headers=_h(admid),
        params={"outcome": "Patient seen at district hospital"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "completed"

    # ── 10. Patient got a completion notification ──
    patient_notifs = await _get_notifications(test_engine, pid)
    assert any(n.type == "referral_completed" for n in patient_notifs), \
        f"Patient has no referral_completed notification. Got: {[n.type for n in patient_notifs]}"

    # ── 11. ASHA got a completion notification ──
    asha_notifs = await _get_notifications(test_engine, aid)
    assert any(n.type == "referral_completed" for n in asha_notifs), \
        f"ASHA has no referral_completed notification. Got: {[n.type for n in asha_notifs]}"

    # ── 12. Patient's referral list shows completed ──
    resp = await client.get("/api/v1/patients/me/referral-requests", headers=_h(pid))
    matching = [r for r in resp.json() if r["id"] == referral_id]
    assert matching[0]["status"] == "completed"

    # ── 13. Cannot accept again (already completed) ──
    resp = await client.post(f"/api/v1/referrals/{referral_id}/accept", headers=_h(admid))
    assert resp.status_code == 409


async def test_accept_sends_notification_to_patient_and_asha_only(client, test_engine, setup):
    """Admin does NOT get a notification when they themselves accept."""
    admid = setup["admin_id"]
    pid = setup["patient_id"]

    resp = await client.post(
        "/api/v1/patients/me/referral-requests",
        headers=_h(pid),
        json={"referral_type": "general", "urgency": "routine", "reason": "checkup"},
    )
    referral_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/referrals/{referral_id}/accept", headers=_h(admid))
    assert resp.status_code == 200

    admin_notifs = await _get_notifications(test_engine, admid)
    assert not any(n.type == "referral_accepted" for n in admin_notifs), \
        "Admin should not get a notification for their own action"


async def test_pending_status_filter_returns_initiated(client, test_engine, setup):
    """GET /referrals?status=pending should return initiated referrals."""
    pid = setup["patient_id"]
    aid = setup["asha_id"]
    admid = setup["admin_id"]

    await client.post(
        "/api/v1/patients/me/referral-requests",
        headers=_h(pid),
        json={"referral_type": "general", "urgency": "routine", "reason": "filter test"},
    )

    # Filter by "pending" should match the initiated referral
    resp = await client.get("/api/v1/referrals", headers=_h(admid), params={"status": "pending"})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1, "status=pending should return the initiated referral"

    # Filter by "initiated" should also work
    resp = await client.get("/api/v1/referrals", headers=_h(admid), params={"status": "initiated"})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1


async def test_urgency_filter(client, test_engine, setup):
    """GET /referrals?urgency=urgent filters correctly."""
    pid = setup["patient_id"]
    admid = setup["admin_id"]

    await client.post(
        "/api/v1/patients/me/referral-requests",
        headers=_h(pid),
        json={"referral_type": "general", "urgency": "urgent", "reason": "urgency filter test"},
    )

    resp = await client.get("/api/v1/referrals", headers=_h(admid), params={"urgency": "urgent"})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1, "urgency=urgent should return the referral"

    resp = await client.get("/api/v1/referrals", headers=_h(admid), params={"urgency": "emergency"})
    assert resp.status_code == 200
    urgent_only = [r for r in resp.json()["items"] if r["urgency"] == "emergency"]
    assert len(urgent_only) == len(resp.json()["items"]), "All results should be emergency"


# ── Pregnancy self-report ──

async def test_pregnancy_self_report(client, test_engine, setup):
    """Female patient reports pregnancy → profile updates, ASHA notified."""
    from datetime import date, timedelta

    pid = setup["patient_id"]
    aid = setup["asha_id"]

    lmp = (date.today() - timedelta(weeks=12)).isoformat()
    resp = await client.post(
        "/api/v1/patients/me/pregnancy",
        headers=_h(pid),
        json={"lmp": lmp, "gravida": 2, "parity": 1},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "ongoing"
    # EDD = LMP + 280 days
    from datetime import date as _date
    lmp_date = _date.fromisoformat(lmp)
    expected_edd = lmp_date + timedelta(days=280)
    assert data["edd"] == expected_edd.isoformat(), f"EDD mismatch: {data['edd']} != {expected_edd}"

    # ASHA got a notification
    asha_notifs = await _get_notifications(test_engine, aid)
    assert any(n.type == "pregnancy_reported" for n in asha_notifs), \
        f"ASHA has no pregnancy_reported notification. Got: {[n.type for n in asha_notifs]}"

    # Duplicate ongoing pregnancy rejected
    resp = await client.post(
        "/api/v1/patients/me/pregnancy",
        headers=_h(pid),
        json={"lmp": lmp},
    )
    assert resp.status_code in (400, 409, 422), f"Expected conflict, got {resp.status_code}: {resp.text}"


async def test_pregnancy_rejected_for_male(client, test_engine, user_factory):
    """Male patient cannot report pregnancy."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    male_patient = await user_factory(phone="9000000099", role="patient", full_name="Male Patient")
    async with maker() as session:
        ben = Beneficiary(
            beneficiary_id="BEN-TEST-MALE",
            full_name="Male Patient",
            gender="male",
            phone="9000000099",
            status="active",
        )
        session.add(ben)
        await session.flush()
        row = await session.get(User, male_patient.id)
        row.beneficiary_id = ben.id
        await session.commit()

    resp = await client.post(
        "/api/v1/patients/me/pregnancy",
        headers=_h(male_patient.id),
        json={"lmp": "2026-09-01"},
    )
    assert resp.status_code in (400, 403, 422), f"Expected rejection for male, got {resp.status_code}"


async def test_patient_cannot_use_worker_pregnancy_endpoint(client, test_engine, setup):
    """POST /pregnancies (worker endpoint) rejects patients — security fix."""
    pid = setup["patient_id"]
    resp = await client.post(
        "/api/v1/pregnancies",
        headers=_h(pid),
        json={"beneficiary_id": setup["beneficiary_id"], "lmp": "2026-09-01"},
    )
    assert resp.status_code == 403, f"Patient should get 403, got {resp.status_code}"
