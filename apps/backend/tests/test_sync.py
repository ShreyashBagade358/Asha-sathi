"""Tests for the offline sync contract.

Covers the guarantees the mobile client depends on:

* push is idempotent per ``client_request_id`` (a retry after a dropped
  connection must not create a duplicate),
* a stale ``version`` is reported as a conflict rather than overwriting, and
  the conflict is recorded in the ledger so ``/sync/status`` counts it,
* pull is tenant-scoped: an ASHA only ever receives rows inside their own
  catchment, and a patient only their own,
* pull uses ``updated_at`` so a server-side edit propagates,
* a scoped role cannot push population-level tables.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import Base
from app.models.beneficiary import Beneficiary, Household
from app.models.sync import SyncOperation
from app.models.user import ASHAProfile

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def session(test_engine):
    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s


EPOCH = datetime(2024, 1, 1, tzinfo=UTC)


async def _make_household(
    session: AsyncSession,
    *,
    household_id: str,
    village_id: str,
    asha_user_id: str,
) -> Household:
    hh = Household(
        id=household_id,
        hhid=f"HH-{household_id}",
        village_id=village_id,
        asha_id=asha_user_id,
        address=f"{village_id} address",
        consent_given=True,
    )
    session.add(hh)
    await session.commit()
    return hh


async def _make_beneficiary(
    session: AsyncSession,
    *,
    beneficiary_id: str,
    household_id: str,
    full_name: str,
    phone: str | None = None,
) -> Beneficiary:
    ben = Beneficiary(
        id=beneficiary_id,
        beneficiary_id=f"BEN-{beneficiary_id}",
        household_id=household_id,
        full_name=full_name,
        gender="female",
        date_of_birth=date(1995, 5, 4),
        phone=phone,
    )
    session.add(ben)
    await session.commit()
    return ben


# ---------------------------------------------------------------------------
# Push: idempotency
# ---------------------------------------------------------------------------


async def test_push_is_idempotent_on_replay(client, auth_headers, session):
    """Replaying the same client_request_id must not create a second record."""
    headers = await auth_headers(phone="9000000001", role="super_admin")
    op = {
        "entity": "households",
        "operation": "create",
        "id": "hh-replay-1",
        "version": 1,
        "client_request_id": "req-abc-123",
        "data": {"hhid": "HH-REPLAY", "village_id": "v1", "asha_id": "u1"},
    }

    first = await client.post("/api/v1/sync/push", json={"device_id": "d1", "operations": [op]}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["summary"] == {"pushed": 1, "conflicts": 0, "failed": 0, "total": 1}

    second = await client.post("/api/v1/sync/push", json={"device_id": "d1", "operations": [op]}, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["summary"]["pushed"] == 1

    count = len((await session.execute(select(Household))).scalars().all())
    assert count == 1, "replay must not duplicate the household"

    ledger = (
        await session.execute(select(SyncOperation).where(SyncOperation.client_request_id == "req-abc-123"))
    ).scalars().all()
    assert len(ledger) == 1


# ---------------------------------------------------------------------------
# Push: conflict detection + ledger
# ---------------------------------------------------------------------------


async def test_stale_version_returns_conflict_and_is_ledgered(client, auth_headers, session):
    """An update based on an old version must conflict, not overwrite.

    The conflict must also be written to SyncOperation so /sync/status and the
    client's conflict list can see it.
    """
    headers = await auth_headers(phone="9000000002", role="super_admin")

    await _make_household(session, household_id="hh-conf-1", village_id="v1", asha_user_id="u1")

    # Server is at version 1; client claims version 0 (stale).
    res = await client.post(
        "/api/v1/sync/push",
        json={
            "device_id": "d1",
            "operations": [
                {
                    "entity": "households",
                    "operation": "update",
                    "id": "hh-conf-1",
                    "version": 0,
                    "client_request_id": "req-conf-1",
                    "data": {"address": "should not be applied"},
                }
            ],
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["summary"]["conflicts"] == 1
    item = body["results"][0]
    assert item["status"] == "conflict"
    assert "stale_version" in item["conflict_reason"]
    # The server row is returned so the client can show a side-by-side.
    assert item["record"]["address"] != "should not be applied"

    ledger = (
        await session.execute(
            select(SyncOperation).where(
                SyncOperation.client_request_id == "req-conf-1",
                SyncOperation.status == "conflict",
            )
        )
    ).scalars().all()
    assert len(ledger) == 1, "conflict must be recorded in the idempotency ledger"


async def test_status_counts_conflicts(client, auth_headers, session):
    headers = await auth_headers(phone="9000000003", role="super_admin")
    await _make_household(session, household_id="hh-conf-2", village_id="v1", asha_user_id="u1")

    await client.post(
        "/api/v1/sync/push",
        json={
            "device_id": "d1",
            "operations": [
                {
                    "entity": "households",
                    "operation": "update",
                    "id": "hh-conf-2",
                    "version": 0,
                    "client_request_id": "req-conf-2",
                    "data": {"address": "nope"},
                }
            ],
        },
        headers=headers,
    )

    status = await client.get("/api/v1/sync/status", headers=headers)
    assert status.status_code == 200, status.text
    assert status.json()["conflicts"] == 1


# ---------------------------------------------------------------------------
# Pull: tenant scoping (the PHI leak)
# ---------------------------------------------------------------------------


async def test_asha_pull_is_scoped_to_own_catchment(client, user_factory, session):
    """An ASHA must not receive another worker's or another village's rows."""
    asha_a = await user_factory(phone="9100000001", role="asha")
    asha_b = await user_factory(phone="9100000002", role="asha")

    session.add(
        ASHAProfile(
            user_id=asha_a.id,
            asha_id="ASHA-A",
            catchment_villages=["village-a"],
            emergency_contact_name="x",
        )
    )
    session.add(
        ASHAProfile(
            user_id=asha_b.id,
            asha_id="ASHA-B",
            catchment_villages=["village-b"],
            emergency_contact_name="x",
        )
    )
    await session.commit()

    await _make_household(session, household_id="hh-a", village_id="village-a", asha_user_id=asha_a.id)
    await _make_household(session, household_id="hh-b", village_id="village-b", asha_user_id=asha_b.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-a", household_id="hh-a", full_name="Patient A"
    )
    await _make_beneficiary(
        session, beneficiary_id="ben-b", household_id="hh-b", full_name="Patient B"
    )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(asha_a.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"device_id": "d1", "last_pull_at": (EPOCH - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    records = res.json()["records"]

    households = {h["id"] for h in records.get("households", [])}
    beneficiaries = {b["id"] for b in records.get("beneficiaries", [])}

    assert "hh-a" in households
    assert "hh-b" not in households, "ASHA A must not pull ASHA B's household"
    assert "ben-a" in beneficiaries
    assert "ben-b" not in beneficiaries, "cross-tenant PHI leak"

    # Nothing anywhere in the payload may reference the other tenant.
    raw = res.text
    assert "Patient B" not in raw


async def test_asha_pull_includes_own_children_records(client, user_factory, session):
    """Clinical rows reached through a scoped household are included."""
    asha = await user_factory(phone="9100000010", role="asha")
    session.add(
        ASHAProfile(
            user_id=asha.id, asha_id="ASHA-C", catchment_villages=["village-c"], emergency_contact_name="x"
        )
    )
    await session.commit()
    await _make_household(session, household_id="hh-c", village_id="village-c", asha_user_id=asha.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-c", household_id="hh-c", full_name="Patient C", phone="9200000003"
    )

    from app.models.maternal import Pregnancy

    preg = Pregnancy(
        id="preg-c",
        beneficiary_id="ben-c",
        lmp=date(2024, 2, 1),
        edd=date(2024, 11, 8),
        status="active",
    )
    session.add(preg)
    await session.commit()

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(asha.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (EPOCH - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    pregnancies = res.json()["records"].get("pregnancies", [])
    assert [p["id"] for p in pregnancies] == ["preg-c"]


async def test_patient_pull_only_sees_own_record(client, user_factory, session):
    """A patient token must not pull the whole deployment."""
    patient = await user_factory(phone="9300000001", role="patient")
    asha = await user_factory(phone="9300000002", role="asha")

    await _make_household(session, household_id="hh-p", village_id="village-p", asha_user_id=asha.id)
    await _make_household(session, household_id="hh-q", village_id="village-q", asha_user_id=asha.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-p", household_id="hh-p", full_name="Mine", phone="9300000001"
    )
    await _make_beneficiary(
        session, beneficiary_id="ben-q", household_id="hh-q", full_name="Someone Else", phone="9300000002"
    )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(patient.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (EPOCH - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    records = res.json()["records"]

    assert "Mine" in res.text
    assert "Someone Else" not in res.text
    beneficiaries = {b["id"] for b in records.get("beneficiaries", [])}
    assert beneficiaries == {"ben-p"}


async def test_asha_with_no_catchment_sees_nothing(client, user_factory, session):
    """Fail closed: an unconfigured ASHA must not fall back to full access."""
    asha = await user_factory(phone="9400000001", role="asha")
    asha_other = await user_factory(phone="9400000002", role="asha")
    await _make_household(
        session, household_id="hh-z", village_id="village-z", asha_user_id=asha_other.id
    )
    await _make_beneficiary(
        session, beneficiary_id="ben-z", household_id="hh-z", full_name="Hidden"
    )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(asha.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (EPOCH - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert "Hidden" not in res.text


async def test_admin_pull_is_unrestricted(client, user_factory, session):
    """Supervisors keep full visibility."""
    admin = await user_factory(phone="9500000001", role="super_admin")
    asha = await user_factory(phone="9500000002", role="asha")
    await _make_household(session, household_id="hh-adm", village_id="village-adm", asha_user_id=asha.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-adm", household_id="hh-adm", full_name="Visible To Admin"
    )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (EPOCH - timedelta(days=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert "Visible To Admin" in res.text


# ---------------------------------------------------------------------------
# Pull: updated_at watermark
# ---------------------------------------------------------------------------


async def test_pull_uses_updated_at_not_created_at(client, user_factory, session):
    """A record created long ago but edited now must still be pulled.

    With a created_at watermark the client would never learn about the edit.
    """
    asha = await user_factory(phone="9600000001", role="asha")
    session.add(
        ASHAProfile(
            user_id=asha.id, asha_id="ASHA-U", catchment_villages=["village-u"], emergency_contact_name="x"
        )
    )
    await session.commit()
    await _make_household(session, household_id="hh-u", village_id="village-u", asha_user_id=asha.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-u", household_id="hh-u", full_name="Edited Later"
    )

    # Simulate "an edit happened after the client's last pull".
    from sqlalchemy import update

    await session.execute(
        update(Household)
        .where(Household.id == "hh-u")
        .values(updated_at=datetime.now(UTC), address="new address")
    )
    await session.commit()

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(asha.id)}"}
    # Watermark is well after creation but before the edit.
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    households = {h["id"] for h in res.json()["records"].get("households", [])}
    assert "hh-u" in households, "server-side edit must propagate to the device"


async def test_pull_respects_watermark(client, user_factory, session):
    """Rows older than the watermark are not re-sent."""
    admin = await user_factory(phone="9700000001", role="super_admin")
    asha = await user_factory(phone="9700000002", role="asha")
    await _make_household(session, household_id="hh-old", village_id="village-old", asha_user_id=asha.id)

    from sqlalchemy import update

    await session.execute(
        update(Household)
        .where(Household.id == "hh-old")
        .values(updated_at=datetime(2020, 1, 1, tzinfo=UTC))
    )
    await session.commit()

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": EPOCH.isoformat()},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    households = {h["id"] for h in res.json()["records"].get("households", [])}
    assert "hh-old" not in households


# ---------------------------------------------------------------------------
# Pull: pagination
# ---------------------------------------------------------------------------


async def test_pull_reports_has_more_when_truncated(client, user_factory, session):
    admin = await user_factory(phone="9800000001", role="super_admin")
    asha = await user_factory(phone="9800000002", role="asha")
    for i in range(5):
        await _make_household(
            session, household_id=f"hh-page-{i}", village_id="village-page", asha_user_id=asha.id
        )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
    res = await client.post(
        "/api/v1/sync/pull",
        json={"last_pull_at": (EPOCH - timedelta(days=1)).isoformat(), "limit": 2},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["has_more"] is True
    assert body["next_cursor"] is not None
    # The limit is respected across the whole response.
    assert sum(len(v) for v in body["records"].values()) <= 2


# ---------------------------------------------------------------------------
# Push: write authorization
# ---------------------------------------------------------------------------


async def test_patient_cannot_push_households(client, user_factory):
    patient = await user_factory(phone="9900000001", role="patient")

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(patient.id)}"}
    res = await client.post(
        "/api/v1/sync/push",
        json={
            "device_id": "d1",
            "operations": [
                {
                    "entity": "households",
                    "operation": "create",
                    "id": "hh-evil",
                    "version": 1,
                    "client_request_id": "req-evil",
                    "data": {"hhid": "EVIL", "village_id": "v1", "asha_id": "u1"},
                }
            ],
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["summary"]["failed"] == 1
    assert body["results"][0]["error"] == "forbidden"


async def test_patient_may_push_own_clinical_record(client, user_factory):
    """A patient is allowed to write rows hanging off their own record."""
    patient = await user_factory(phone="9900000002", role="patient")

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(patient.id)}"}
    res = await client.post(
        "/api/v1/sync/push",
        json={
            "device_id": "d1",
            "operations": [
                {
                    "entity": "immunizations",
                    "operation": "create",
                    "id": "imm-p1",
                    "version": 1,
                    "client_request_id": "req-imm-p1",
                    "data": {
                        "child_id": "child-p1",
                        "vaccine_code": "BCG",
                        "vaccine_name": "BCG",
                        "dose_number": 1,
                    },
                }
            ],
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["summary"]["pushed"] == 1


# ---------------------------------------------------------------------------
# Conflict resolution scoping
# ---------------------------------------------------------------------------


async def test_patient_cannot_resolve_another_users_conflict(client, user_factory, session):
    patient = await user_factory(phone="9910000001", role="patient")
    asha = await user_factory(phone="9910000002", role="asha")
    await _make_household(session, household_id="hh-r1", village_id="village-r", asha_user_id=asha.id)
    await _make_beneficiary(
        session, beneficiary_id="ben-r1", household_id="hh-r1", full_name="Not Mine", phone="9910000009"
    )

    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(patient.id)}"}
    res = await client.post(
        "/api/v1/sync/conflicts/resolve",
        json={
            "table": "households",
            "record_id": "hh-r1",
            "resolution": "client_wins",
            "client_values": {"address": "hijacked"},
        },
        headers=headers,
    )
    # The app maps ValidationError -> 422 with a generic message, so a patient
    # gets the same response for "not yours" as for "does not exist".
    assert res.status_code == 422
    assert "hijacked" not in res.text

    # And the row is untouched.
    hh = await session.get(Household, "hh-r1")
    assert hh.address != "hijacked"


# ---------------------------------------------------------------------------
# Guard against schema drift
# ---------------------------------------------------------------------------


@pytest.mark.asyncio(loop_scope="function")
async def test_every_sync_table_has_a_scope_link():
    """A sync table without a declared link would fail open or closed silently.

    ``register_links`` maps every model in SYNC_TABLES to a scoping strategy.
    An unmapped table must be a loud failure, not a silent leak.
    """
    from app.api.v1.sync import SYNC_TABLES
    from app.services.sync_scope import _TABLE_LINKS

    for name, model in SYNC_TABLES.items():
        assert model in _TABLE_LINKS, f"sync table '{name}' has no tenant-scoping link"


@pytest.mark.asyncio(loop_scope="function")
async def test_scope_link_column_exists():
    """Every declared link must name a real column on its model.

    Catches the case where a model is renamed or a table is mapped to the
    wrong link kind, which would otherwise raise only at query time.
    """
    from app.api.v1.sync import SYNC_TABLES
    from app.services.sync_scope import _TABLE_LINKS

    expected_columns = {
        "village": "village_id",
        "household": "household_id",
        "asha": "asha_id",
        "beneficiary": "beneficiary_id",
        "via_pregnancy": "pregnancy_id",
        "via_child": "child_id",
        "ec_followup": "ec_id",
        "eligible_couple": "wife_id",
        "beneficiary_self": "id",
    }

    for name, model in SYNC_TABLES.items():
        link = _TABLE_LINKS.get(model)
        if link in ("asha_or_household",):
            cols = {c.name for c in model.__table__.columns}
            assert cols & {"asha_id", "household_id", "village_id"}, f"'{name}' has no scope column"
            continue
        column = expected_columns.get(link)
        assert column, f"sync table '{name}' has unknown link kind '{link}'"
        cols = {c.name for c in model.__table__.columns}
        assert column in cols, f"sync table '{name}' is missing column '{column}'"


@pytest.mark.asyncio(loop_scope="function")
async def test_base_metadata_covers_sync_tables():
    """All sync tables are part of the ORM metadata used by tests/migrations."""
    from app.api.v1.sync import SYNC_TABLES

    for name, model in SYNC_TABLES.items():
        assert hasattr(model, "__tablename__"), name
        assert model.__tablename__ in Base.metadata.tables, name


# ---------------------------------------------------------------------------
# Push: temporal coercion from client ISO strings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio(loop_scope="function")
async def test_push_coerces_iso_date_string_for_create(client, auth_headers, session):
    """Clients send date_of_birth as an ISO string; asyncpg needs a real date."""
    headers = await auth_headers(phone="9000000001", role="super_admin")
    household = await _make_household(
        session, household_id="hh-iso-1", village_id="v1", asha_user_id="u1"
    )
    op = {
        "entity": "beneficiaries",
        "operation": "create",
        "id": "ben-iso-1",
        "version": 1,
        "client_request_id": "req-iso-1",
        "data": {
            "beneficiary_id": "BEN-ISO-1",
            "household_id": household.id,
            "full_name": "Iso Date Patient",
            "gender": "female",
            "date_of_birth": "1997-03-14",
        },
    }

    response = await client.post(
        "/api/v1/sync/push", json={"device_id": "d1", "operations": [op]}, headers=headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["summary"] == {"pushed": 1, "conflicts": 0, "failed": 0, "total": 1}

    stored = (await session.execute(select(Beneficiary).where(Beneficiary.id == "ben-iso-1"))).scalar_one()
    assert stored.date_of_birth == date(1997, 3, 14)
    assert isinstance(stored.date_of_birth, date)


@pytest.mark.asyncio(loop_scope="function")
async def test_push_coerces_iso_date_string_for_update(client, auth_headers, session):
    """The same coercion must apply to updates, not just creates."""
    headers = await auth_headers(phone="9000000001", role="super_admin")
    household = await _make_household(
        session, household_id="hh-iso-2", village_id="v1", asha_user_id="u1"
    )
    record = await _make_beneficiary(
        session, beneficiary_id="ben-iso-2", household_id=household.id, full_name="Before"
    )

    op = {
        "entity": "beneficiaries",
        "operation": "update",
        "id": record.id,
        "version": 1,
        "client_request_id": "req-iso-2",
        "data": {"full_name": "After", "date_of_birth": "2001-12-25"},
    }

    response = await client.post(
        "/api/v1/sync/push", json={"device_id": "d1", "operations": [op]}, headers=headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["summary"]["pushed"] == 1

    await session.refresh(record)
    assert record.full_name == "After"
    assert record.date_of_birth == date(2001, 12, 25)


@pytest.mark.asyncio(loop_scope="function")
async def test_push_replay_returns_record_not_envelope(client, auth_headers):
    """A retry must return the record itself, not the stored response envelope.

    Clients that lost the response mid-flight retry the same client_request_id.
    If the replay handed back the whole envelope as ``record``, the device would
    write envelope keys into its local row.
    """
    headers = await auth_headers(phone="9000000001", role="super_admin")
    op = {
        "entity": "households",
        "operation": "create",
        "id": "hh-replay-shape",
        "version": 1,
        "client_request_id": "req-replay-shape",
        "data": {"hhid": "HH-REPLAY-SHAPE", "village_id": "v1", "asha_id": "u1"},
    }

    payload = {"device_id": "d1", "operations": [op]}
    first_res = await client.post("/api/v1/sync/push", json=payload, headers=headers)
    replay_res = await client.post("/api/v1/sync/push", json=payload, headers=headers)
    first, replay = first_res.json(), replay_res.json()

    original, replayed = first["results"][0]["record"], replay["results"][0]["record"]
    assert original == replayed
    assert "hhid" in replayed, "replayed record must be the record itself"
    for envelope_key in ("client_request_id", "status", "entity", "operation"):
        assert envelope_key not in replayed, f"replay leaked envelope key '{envelope_key}'"
