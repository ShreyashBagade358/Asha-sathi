from datetime import date, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.beneficiary import Household, HouseholdSurvey
from app.models.task import ASHATask
from app.models.user import User
from app.services.task_plan import DAILY_TASK_QUOTA, generate_daily_plan, plan_today

TODAY = plan_today()


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
    return {"phc": phc, "sub_center": sub_center, "village": village}


async def _add_village(db_session, sub_center, code, name):
    village = Village(sub_center_id=sub_center.id, code=code, name=name)
    db_session.add(village)
    await db_session.flush()
    return village


async def _asha(db_session, village, phone, name):
    asha = User(role="asha", phone=phone, full_name=name, village_id=village.id, is_active=True)
    db_session.add(asha)
    await db_session.flush()
    return asha


async def _households(db_session, asha, village, count, prefix="HH"):
    households = []
    for index in range(count):
        household = Household(hhid=f"{prefix}-{index:03d}", village_id=village.id, asha_id=asha.id)
        db_session.add(household)
        households.append(household)
    await db_session.flush()
    return households


async def _run_plan(db_session, asha, day=TODAY):
    await db_session.commit()
    return await generate_daily_plan(db_session, asha.id, day)


async def _asha_tasks(db_session, asha):
    rows = await db_session.execute(select(ASHATask).where(ASHATask.asha_id == asha.id))
    return list(rows.scalars().all())


async def _signed_in_asha(db_session, auth_headers, village, phone):
    headers = await auth_headers(phone=phone, role="asha", village_id=village.id)
    user = (await db_session.execute(select(User).where(User.phone == phone))).scalar_one()
    return headers, user


@pytest.mark.asyncio
async def test_plan_fills_quota_from_households(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 7)

    summary = await _run_plan(db_session, asha)

    assert summary["planned"] == DAILY_TASK_QUOTA
    assert summary["assigned_total"] == DAILY_TASK_QUOTA
    assert summary["carried_over"] == 0

    tasks = await _asha_tasks(db_session, asha)
    assert len(tasks) == DAILY_TASK_QUOTA
    assert {task.task_date for task in tasks} == {TODAY}
    assert {task.status for task in tasks} == {"pending"}


@pytest.mark.asyncio
async def test_plan_never_exceeds_available_households(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 3)

    summary = await _run_plan(db_session, asha)

    assert summary["planned"] == 3
    assert summary["assigned_total"] == 3


@pytest.mark.asyncio
async def test_plan_is_idempotent(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 7)

    first = await _run_plan(db_session, asha)
    second = await generate_daily_plan(db_session, asha.id, TODAY)

    assert first["planned"] == DAILY_TASK_QUOTA
    assert second["planned"] == 0
    assert second["assigned_total"] == DAILY_TASK_QUOTA
    assert len(await _asha_tasks(db_session, asha)) == DAILY_TASK_QUOTA


@pytest.mark.asyncio
async def test_pending_work_carries_over_and_counts_toward_quota(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    yesterday = TODAY - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)
    stale = [
        ASHATask(
            asha_id=asha.id,
            task_date=yesterday,
            task_type="household_visit",
            household_id=households[0].id,
            village_id=org["village"].id,
            status="pending",
        ),
        ASHATask(
            asha_id=asha.id,
            task_date=day_before,
            task_type="anc_visit",
            household_id=households[1].id,
            village_id=org["village"].id,
            status="pending",
        ),
    ]
    db_session.add_all(stale)
    await db_session.flush()
    stale_ids = {task.id for task in stale}

    summary = await _run_plan(db_session, asha)

    assert summary["carried_over"] == 2
    assert summary["planned"] == 3
    assert summary["assigned_total"] == DAILY_TASK_QUOTA

    rows = await _asha_tasks(db_session, asha)
    assert len(rows) == DAILY_TASK_QUOTA
    assert {task.task_date for task in rows} == {TODAY}
    assert stale_ids <= {task.id for task in rows}
    assert {task.metadata_json["carried_from"] for task in rows if task.metadata_json} == {
        yesterday.isoformat(),
        day_before.isoformat(),
    }
    household_ids = [task.household_id for task in rows]
    assert len(household_ids) == len(set(household_ids))


@pytest.mark.asyncio
async def test_backlog_larger_than_quota_is_never_dropped(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    yesterday = TODAY - timedelta(days=1)
    for household in households:
        db_session.add(
            ASHATask(
                asha_id=asha.id,
                task_date=yesterday,
                task_type="household_visit",
                household_id=household.id,
                village_id=org["village"].id,
                status="pending",
            )
        )
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    assert summary["carried_over"] == 7
    assert summary["planned"] == 0
    assert summary["assigned_total"] == 7

    rows = await _asha_tasks(db_session, asha)
    assert len(rows) == 7
    assert {task.task_date for task in rows} == {TODAY}


@pytest.mark.asyncio
async def test_workers_never_receive_the_same_household(db_session):
    org = await _org(db_session)
    other_village = await _add_village(db_session, org["sub_center"], "VLG02", "Khurrampur")
    first = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    second = await _asha(db_session, other_village, "9876543211", "Rekha Devi")
    await _households(db_session, first, org["village"], 6, prefix="A")
    await _households(db_session, second, other_village, 6, prefix="B")

    await _run_plan(db_session, first)
    await generate_daily_plan(db_session, second.id, TODAY)

    rows = await db_session.execute(select(ASHATask))
    by_asha: dict[str, list[ASHATask]] = {}
    for row in rows.scalars().all():
        by_asha.setdefault(row.asha_id, []).append(row)

    assert len(by_asha[first.id]) == DAILY_TASK_QUOTA
    assert len(by_asha[second.id]) == DAILY_TASK_QUOTA
    first_households = {task.household_id for task in by_asha[first.id]}
    second_households = {task.household_id for task in by_asha[second.id]}
    assert first_households.isdisjoint(second_households)


@pytest.mark.asyncio
async def test_completed_visit_is_not_planned_again_same_day(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 5)
    await _run_plan(db_session, asha)

    completed = (await _asha_tasks(db_session, asha))[0]
    completed.status = "completed"
    await db_session.commit()

    await generate_daily_plan(db_session, asha.id, TODAY)

    rows = await _asha_tasks(db_session, asha)
    assert len(rows) == 5
    assert sum(1 for task in rows if task.status == "completed") == 1
    assert sum(1 for task in rows if task.status == "pending") == 4


@pytest.mark.asyncio
async def test_visit_order_prefers_never_visited_households(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 6)
    recently_visited = households[0]
    db_session.add(
        HouseholdSurvey(
            household_id=recently_visited.id,
            answers={"clean_water": "yes"},
            consent_obtained=True,
            visited_at=TODAY - timedelta(days=1),
            created_by=asha.id,
        )
    )
    await db_session.flush()

    await _run_plan(db_session, asha)

    planned = {task.household_id for task in await _asha_tasks(db_session, asha)}
    assert len(planned) == DAILY_TASK_QUOTA
    assert recently_visited.id not in planned


@pytest.mark.asyncio
async def test_duplicate_task_row_is_rejected_by_the_database(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 1)
    db_session.add(
        ASHATask(
            asha_id=asha.id,
            task_date=TODAY,
            task_type="household_visit",
            household_id=households[0].id,
            village_id=org["village"].id,
            status="pending",
        )
    )
    await db_session.commit()

    db_session.add(
        ASHATask(
            asha_id=asha.id,
            task_date=TODAY,
            task_type="household_visit",
            household_id=households[0].id,
            village_id=org["village"].id,
            status="pending",
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_me_tasks_date_builds_today_plan_and_enriches_rows(client, db_session, auth_headers):
    org = await _org(db_session)
    headers, asha = await _signed_in_asha(db_session, auth_headers, org["village"], "9876543210")
    await _households(db_session, asha, org["village"], 7)
    await db_session.commit()

    resp = await client.get(
        "/api/v1/ashas/me/tasks",
        params={"date": TODAY.isoformat()},
        headers=headers,
    )

    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == DAILY_TASK_QUOTA
    assert {item["task_date"] for item in items} == {TODAY.isoformat()}
    assert all(item["household_hhid"] for item in items)
    assert all(item["village_name"] == "Rampur" for item in items)

    again = await client.get(
        "/api/v1/ashas/me/tasks",
        params={"date": TODAY.isoformat()},
        headers=headers,
    )
    assert [item["id"] for item in again.json()] == [item["id"] for item in items]


@pytest.mark.asyncio
async def test_me_tasks_without_date_keeps_history(client, db_session, auth_headers):
    org = await _org(db_session)
    headers, asha = await _signed_in_asha(db_session, auth_headers, org["village"], "9876543210")
    households = await _households(db_session, asha, org["village"], 2)
    db_session.add(
        ASHATask(
            asha_id=asha.id,
            task_date=date(2024, 1, 5),
            task_type="household_visit",
            household_id=households[0].id,
            village_id=org["village"].id,
            status="completed",
        )
    )
    await db_session.commit()

    resp = await client.get("/api/v1/ashas/me/tasks", headers=headers)

    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["task_date"] == "2024-01-05"


@pytest.mark.asyncio
async def test_visit_survey_completes_open_task(client, db_session, auth_headers):
    org = await _org(db_session)
    headers, asha = await _signed_in_asha(db_session, auth_headers, org["village"], "9876543210")
    await _households(db_session, asha, org["village"], 7)
    await db_session.commit()

    resp = await client.get(
        "/api/v1/ashas/me/tasks",
        params={"date": TODAY.isoformat()},
        headers=headers,
    )
    task = resp.json()[0]

    survey = await client.post(
        f"/api/v1/households/{task['household_id']}/survey",
        json={
            "answers": {"clean_water": "yes"},
            "consent_obtained": True,
            "visited_at": TODAY.isoformat(),
        },
        headers=headers,
    )
    assert survey.status_code == 201

    tasks = await client.get(
        "/api/v1/ashas/me/tasks",
        params={"date": TODAY.isoformat()},
        headers=headers,
    )
    refreshed = {item["id"]: item for item in tasks.json()}
    assert refreshed[task["id"]]["status"] == "completed"
    assert refreshed[task["id"]]["completed_time"] is not None
    assert len(tasks.json()) == DAILY_TASK_QUOTA
    assert task["household_id"] not in {
        item["household_id"] for item in tasks.json() if item["status"] == "pending"
    }
