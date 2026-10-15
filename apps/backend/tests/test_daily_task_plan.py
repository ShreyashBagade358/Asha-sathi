from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey
from app.models.child import Child, HBYCVisit, Immunization
from app.models.config import AppConfig
from app.models.eligible_couple import EligibleCouple
from app.models.maternal import DeliveryOutcome, PNCVisit, Pregnancy
from app.models.ncd import NCDScreening
from app.models.notification import Notification
from app.models.referral import Referral
from app.models.task import ASHATask
from app.models.user import User
from app.services.task_plan import (
    CARRY_OVER_CAP,
    DAILY_TASK_QUOTA,
    WEEKLY_COOLDOWN_DAYS,
    generate_daily_plan,
    plan_today,
)

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
    assert {
        task.metadata_json["carried_from"]
        for task in rows
        if task.metadata_json and "carried_from" in task.metadata_json
    } == {
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

    # Only the two oldest move onto today — a backlog can never eat the whole
    # day — and the rest stays open on its original date: never dropped.
    assert summary["carried_over"] == 2
    assert summary["backlog"] == 5
    assert summary["planned"] == 0
    assert summary["assigned_total"] == 2

    rows = await _asha_tasks(db_session, asha)
    assert len(rows) == 7
    assert sum(1 for task in rows if task.task_date == TODAY) == 2
    carried_ids = {task.id for task in rows if task.task_date == TODAY}
    assert {task.task_date for task in rows if task.id not in carried_ids} == {yesterday}
    assert all(task.status == "pending" for task in rows)


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
    assert task["household_id"] not in {item["household_id"] for item in tasks.json() if item["status"] == "pending"}


# ---------------------------------------------------------------------------
# Auto-plan: weekly uniqueness, scoring, and the clinical candidate sources
# ---------------------------------------------------------------------------
async def _member(db_session, household, name, dob=None, gender="female"):
    member = Beneficiary(
        beneficiary_id=f"B{uuid4().hex[:10].upper()}",
        household_id=household.id,
        full_name=name,
        date_of_birth=dob,
        gender=gender,
    )
    db_session.add(member)
    await db_session.flush()
    return member


async def _pregnancy_for(db_session, member, **fields):
    pregnancy = Pregnancy(beneficiary_id=member.id, **fields)
    db_session.add(pregnancy)
    await db_session.flush()
    return pregnancy


async def _old_task(db_session, asha, household, days_ago, task_type="household_visit", **fields):
    task = ASHATask(
        asha_id=asha.id,
        task_date=TODAY - timedelta(days=days_ago),
        task_type=task_type,
        household_id=household.id,
        village_id=household.village_id,
        status="completed",
        **fields,
    )
    db_session.add(task)
    await db_session.flush()
    return task


async def _immunization_due(db_session, member, days_overdue=0, code="OPV1"):
    child = Child(beneficiary_id=member.id)
    db_session.add(child)
    await db_session.flush()
    shot = Immunization(
        child_id=child.id,
        vaccine_code=code,
        vaccine_name="OPV",
        dose_number=1,
        due_date=TODAY - timedelta(days=days_overdue),
        status="due",
    )
    db_session.add(shot)
    await db_session.flush()
    return shot


@pytest.mark.asyncio
async def test_routine_visit_never_repeats_within_the_week(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 4)
    # Served 3 days ago by a task and 2 days ago by a survey: both off-limits.
    await _old_task(db_session, asha, households[0], 3)
    db_session.add(
        HouseholdSurvey(
            household_id=households[1].id,
            answers={"clean_water": "yes"},
            consent_obtained=True,
            visited_at=TODAY - timedelta(days=2),
            created_by=asha.id,
        )
    )
    # Served 8 days ago — outside the cooldown, back in rotation.
    await _old_task(db_session, asha, households[2], WEEKLY_COOLDOWN_DAYS + 1)
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    planned = {task.household_id for task in await _asha_tasks(db_session, asha) if task.task_date == TODAY}
    assert households[0].id not in planned
    assert households[1].id not in planned
    assert households[2].id in planned
    assert households[3].id in planned
    assert summary["planned"] == 2


@pytest.mark.asyncio
async def test_completed_anc_visit_does_not_repeat_within_the_week(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 2)
    first = await _member(db_session, households[0], "Sunita")
    second = await _member(db_session, households[1], "Rekha")
    await _pregnancy_for(db_session, first, next_anc_due=TODAY)
    await _pregnancy_for(db_session, second, next_anc_due=TODAY)
    # First mother's ANC is already done this week; second's was last week.
    await _old_task(db_session, asha, households[0], 3, task_type="anc_visit", beneficiary_id=first.id)
    await _old_task(
        db_session,
        asha,
        households[1],
        WEEKLY_COOLDOWN_DAYS + 1,
        task_type="anc_visit",
        beneficiary_id=second.id,
    )

    summary = await _run_plan(db_session, asha)

    anc_tasks = [
        task
        for task in await _asha_tasks(db_session, asha)
        if task.task_type == "anc_visit" and task.task_date == TODAY
    ]
    assert [task.beneficiary_id for task in anc_tasks] == [second.id]
    assert summary["planned"] == 1


@pytest.mark.asyncio
async def test_all_due_reasons_at_one_household_become_one_visit(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 1)
    mother = await _member(db_session, households[0], "Sunita")
    newborn = await _member(db_session, households[0], "Golu", dob=TODAY - timedelta(days=20), gender="male")
    await _pregnancy_for(db_session, mother, next_anc_due=TODAY)
    # The shot is 10 days overdue, so it outranks today's ANC.
    await _immunization_due(db_session, newborn, days_overdue=10)

    summary = await _run_plan(db_session, asha)

    rows = await _asha_tasks(db_session, asha)
    assert summary["planned"] == 1
    assert len(rows) == 1
    assert rows[0].task_type == "immunization"
    reasons = rows[0].metadata_json["reasons"]
    # The routine rotation reason travels along too — one stop closes all three.
    assert {"immunization", "anc_visit"} <= {reason["task_type"] for reason in reasons}
    # One stop, both reasons — the visit closes the ANC as well.
    assert rows[0].metadata_json["score"] >= 60


@pytest.mark.asyncio
async def test_due_immunization_enters_despite_backlog(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 4)
    # Three stale visits, all older than the carry-over cap.
    for household, days in zip(households[:3], (12, 11, 10), strict=True):
        task = await _old_task(db_session, asha, household, days)
        task.status = "pending"
    newborn = await _member(db_session, households[3], "Golu", gender="male")
    await _immunization_due(db_session, newborn, days_overdue=1)
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    assert summary["carried_over"] == CARRY_OVER_CAP
    assert summary["backlog"] == 1
    assert summary["escalated"] == 1
    today_rows = [task for task in await _asha_tasks(db_session, asha) if task.task_date == TODAY]
    assert len(today_rows) == CARRY_OVER_CAP + 1
    assert any(task.task_type == "immunization" and task.household_id == households[3].id for task in today_rows)
    # The uncarried backlog stays open on its original date — never dropped.
    stale = [task for task in await _asha_tasks(db_session, asha) if task.task_date < TODAY]
    assert len(stale) == 1
    assert stale[0].status == "pending"


@pytest.mark.asyncio
async def test_pnc_visit_is_planned_after_delivery(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 1)
    mother = await _member(db_session, households[0], "Sunita")
    pregnancy = await _pregnancy_for(db_session, mother, status="delivered")
    db_session.add(DeliveryOutcome(pregnancy_id=pregnancy.id, delivery_date=TODAY - timedelta(days=3)))
    await db_session.flush()

    await _run_plan(db_session, asha)

    rows = await _asha_tasks(db_session, asha)
    assert [task.task_type for task in rows] == ["pnc_visit"]
    assert rows[0].priority == "high"


@pytest.mark.asyncio
async def test_pnc_visit_stops_once_the_first_visit_is_recorded(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 1)
    mother = await _member(db_session, households[0], "Sunita")
    pregnancy = await _pregnancy_for(db_session, mother, status="delivered")
    db_session.add(DeliveryOutcome(pregnancy_id=pregnancy.id, delivery_date=TODAY - timedelta(days=3)))
    db_session.add(PNCVisit(pregnancy_id=pregnancy.id, visit_date=TODAY - timedelta(days=2)))
    await db_session.flush()

    await _run_plan(db_session, asha)

    rows = await _asha_tasks(db_session, asha)
    assert [task.task_type for task in rows] == ["household_visit"]


@pytest.mark.asyncio
async def test_ec_ncd_and_referral_followups_are_planned_when_overdue(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 3)

    wife = await _member(db_session, households[0], "Guddi")
    db_session.add(EligibleCouple(wife_id=wife.id, next_followup_date=TODAY - timedelta(days=2)))

    patient = await _member(db_session, households[1], "Ram", gender="male")
    db_session.add(
        NCDScreening(
            beneficiary_id=patient.id,
            screening_date=TODAY - timedelta(days=100),
            known_hypertension=True,
        )
    )

    referred = await _member(db_session, households[2], "Shyam", gender="male")
    db_session.add(
        Referral(
            beneficiary_id=referred.id,
            referral_type="medical",
            followup_required=True,
            followup_date=TODAY - timedelta(days=2),
            status="initiated",
        )
    )
    await db_session.flush()

    await _run_plan(db_session, asha)

    types = {task.task_type for task in await _asha_tasks(db_session, asha)}
    assert {"ec_followup", "ncd_followup", "referral_followup"} <= types


@pytest.mark.asyncio
async def test_child_checkup_follows_the_monthly_growth_cadence(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 2)

    # Never measured, born 40 days ago → first growth check-up was due 10 days ago.
    newborn = await _member(db_session, households[0], "Golu", dob=TODAY - timedelta(days=40), gender="male")
    db_session.add(Child(beneficiary_id=newborn.id))

    # Measured 5 days ago → not due again for another three weeks.
    toddler = await _member(db_session, households[1], "Bitto", dob=TODAY - timedelta(days=400), gender="male")
    child = Child(beneficiary_id=toddler.id)
    db_session.add(child)
    await db_session.flush()
    db_session.add(HBYCVisit(child_id=child.id, visit_date=TODAY - timedelta(days=5)))
    await db_session.flush()

    await _run_plan(db_session, asha)

    checkups = [task for task in await _asha_tasks(db_session, asha) if task.task_type == "child_checkup"]
    assert [task.beneficiary_id for task in checkups] == [newborn.id]


@pytest.mark.asyncio
async def test_high_risk_pregnancy_is_seen_every_week(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 2)
    at_risk = await _member(db_session, households[0], "Sunita")
    comfortable = await _member(db_session, households[1], "Rekha")
    await _pregnancy_for(
        db_session,
        at_risk,
        risk_level="high",
        last_anc_date=TODAY - timedelta(days=8),
        next_anc_due=TODAY + timedelta(days=20),
    )
    await _pregnancy_for(
        db_session,
        comfortable,
        risk_level="low",
        last_anc_date=TODAY - timedelta(days=8),
        next_anc_due=TODAY + timedelta(days=20),
    )

    await _run_plan(db_session, asha)

    anc_tasks = [task for task in await _asha_tasks(db_session, asha) if task.task_type == "anc_visit"]
    assert [task.beneficiary_id for task in anc_tasks] == [at_risk.id]


@pytest.mark.asyncio
async def test_new_reasons_merge_into_a_visit_already_scheduled_today(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 1)
    # An open household visit carries over onto today...
    stale = ASHATask(
        asha_id=asha.id,
        task_date=TODAY - timedelta(days=1),
        task_type="household_visit",
        household_id=households[0].id,
        village_id=org["village"].id,
        status="pending",
    )
    db_session.add(stale)
    # ...and a shot is due at the same stop.
    newborn = await _member(db_session, households[0], "Golu", gender="male")
    await _immunization_due(db_session, newborn, days_overdue=2)
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    rows = await _asha_tasks(db_session, asha)
    assert summary["planned"] == 0
    assert summary["merged_reasons"] == 1
    assert len(rows) == 1
    assert rows[0].id == stale.id
    assert rows[0].task_date == TODAY
    reasons = rows[0].metadata_json["reasons"]
    assert [reason["task_type"] for reason in reasons] == ["immunization"]


@pytest.mark.asyncio
async def test_quota_can_be_overridden_per_deployment(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 7)
    db_session.add(AppConfig(config_key="asha_daily_task_quota", config_value={"value": 2}))
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    assert summary["quota"] == 2
    assert summary["planned"] == 2


@pytest.mark.asyncio
async def test_overdue_backlog_escalates_and_notifies_phc_admin_once(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    asha.sub_center_id = org["sub_center"].id
    admin = User(
        role="admin",
        phone="9876543215",
        full_name="PHC Admin",
        sub_center_id=org["sub_center"].id,
        is_active=True,
    )
    db_session.add(admin)
    households = await _households(db_session, asha, org["village"], 3)
    for household in households:
        task = await _old_task(db_session, asha, household, 9)
        task.status = "pending"
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    assert summary["escalated"] == 1
    notifications = (
        (await db_session.execute(select(Notification).where(Notification.type == "asha_task_overdue"))).scalars().all()
    )
    assert len(notifications) == 1
    assert notifications[0].user_id == admin.id

    # Regenerating must not spam the admin with the same alert.
    await generate_daily_plan(db_session, asha.id, TODAY)
    notifications = (
        (await db_session.execute(select(Notification).where(Notification.type == "asha_task_overdue"))).scalars().all()
    )
    assert len(notifications) == 1


@pytest.mark.asyncio
async def test_rotation_spreads_across_villages(db_session):
    org = await _org(db_session)
    other_village = await _add_village(db_session, org["sub_center"], "VLG02", "Khurrampur")
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    await _households(db_session, asha, org["village"], 4, prefix="A")
    await _households(db_session, asha, other_village, 4, prefix="B")

    summary = await _run_plan(db_session, asha)

    tasks = await _asha_tasks(db_session, asha)
    assert summary["planned"] == DAILY_TASK_QUOTA
    by_village: dict[str, int] = {}
    for task in tasks:
        by_village[task.village_id] = by_village.get(task.village_id, 0) + 1
    assert set(by_village) == {org["village"].id, other_village.id}
    assert max(by_village.values()) - min(by_village.values()) <= 1


# ---------------------------------------------------------------------------
# Self-healing: per-day carry budget and duplicate collapse
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_repeat_generation_never_exceeds_daily_carry_cap(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    yesterday = TODAY - timedelta(days=1)
    for household in households[:6]:
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

    first = await _run_plan(db_session, asha)
    second = await generate_daily_plan(db_session, asha.id, TODAY)

    # The cap is per day: a second generation pass may not pull more backlog
    # onto the plan date than the first one already did.
    assert first["carried_over"] == CARRY_OVER_CAP
    assert second["carried_over"] == 0
    assert second["backlog"] == 4
    today_count = sum(1 for task in await _asha_tasks(db_session, asha) if task.task_date == TODAY)
    assert today_count == first["assigned_total"]
    assert today_count <= DAILY_TASK_QUOTA


@pytest.mark.asyncio
async def test_duplicate_stale_rows_for_same_work_collapse_into_one(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    member = await _member(db_session, households[0], "Rekha")
    db_session.add_all(
        [
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY - timedelta(days=30),
                task_type="anc_visit",
                household_id=None,
                beneficiary_id=member.id,
                village_id=org["village"].id,
                status="pending",
            ),
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY - timedelta(days=10),
                task_type="anc_visit",
                household_id=households[0].id,
                beneficiary_id=member.id,
                village_id=org["village"].id,
                status="pending",
            ),
        ]
    )
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    assert summary["duplicates_removed"] == 1
    assert summary["carried_over"] == 1
    anc_rows = [task for task in await _asha_tasks(db_session, asha) if task.task_type == "anc_visit"]
    live = [task for task in anc_rows if task.status != "cancelled"]
    assert len(live) == 1
    keeper = live[0]
    # The oldest record wins (its overdue signal survives) and its broken
    # household link is healed to the member's current household.
    assert keeper.task_date == TODAY
    assert keeper.household_id == households[0].id
    assert keeper.metadata_json["carried_from"] == (TODAY - timedelta(days=30)).isoformat()
    losers = [task for task in anc_rows if task.status == "cancelled"]
    assert len(losers) == 1
    assert losers[0].household_id is None
    assert "duplicate" in losers[0].notes


@pytest.mark.asyncio
async def test_duplicate_rows_on_the_plan_day_collapse(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 3)
    member = await _member(db_session, households[0], "Manju")
    db_session.add_all(
        [
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY,
                task_type="ec_followup",
                household_id=None,
                beneficiary_id=member.id,
                village_id=org["village"].id,
                status="pending",
            ),
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY,
                task_type="ec_followup",
                household_id=households[0].id,
                beneficiary_id=member.id,
                village_id=org["village"].id,
                status="pending",
            ),
        ]
    )
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    # Plans built before duplicate detection existed self-heal on the next
    # generation pass instead of showing the same visit twice.
    assert summary["duplicates_removed"] == 1
    rows = [task for task in await _asha_tasks(db_session, asha) if task.task_type == "ec_followup"]
    assert len(rows) == 2
    live = [task for task in rows if task.status != "cancelled"]
    assert len(live) == 1
    assert live[0].household_id == households[0].id
    assert summary["assigned_total"] <= DAILY_TASK_QUOTA


@pytest.mark.asyncio
async def test_same_day_rows_at_one_household_collapse_into_one_stop(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    mother = await _member(db_session, households[0], "Rekha")
    other = await _member(db_session, households[0], "Kamla")
    db_session.add_all(
        [
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY - timedelta(days=30),
                task_type="anc_visit",
                household_id=households[0].id,
                beneficiary_id=mother.id,
                village_id=org["village"].id,
                status="pending",
            ),
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY - timedelta(days=20),
                task_type="ncd_followup",
                household_id=households[0].id,
                beneficiary_id=other.id,
                village_id=org["village"].id,
                status="pending",
            ),
        ]
    )
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    # Both backlog rows carried over, then folded into one stop: three rows
    # at one household would be three trips for the worker.
    assert summary["carried_over"] == 2
    assert summary["merged_stops"] == 1
    tasks = await _asha_tasks(db_session, asha)
    live = [t for t in tasks if t.household_id == households[0].id and t.status != "cancelled"]
    assert len(live) == 1
    keeper = live[0]
    assert keeper.task_type == "anc_visit"  # heaviest type keeps the label
    reason_types = {r["task_type"] for r in keeper.metadata_json.get("reasons", [])}
    assert "ncd_followup" in reason_types
    folded = [t for t in tasks if t.status == "cancelled" and "merged into anc_visit stop" in (t.notes or "")]
    assert len(folded) == 1


@pytest.mark.asyncio
async def test_collapse_keeps_in_progress_and_completed_rows(db_session):
    org = await _org(db_session)
    asha = await _asha(db_session, org["village"], "9876543210", "Sunita Devi")
    households = await _households(db_session, asha, org["village"], 7)
    worker = await _member(db_session, households[0], "Manju")
    started = await _member(db_session, households[0], "Rekha")
    finished = await _member(db_session, households[0], "Kamla")
    db_session.add_all(
        [
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY,
                task_type="ec_followup",
                household_id=households[0].id,
                beneficiary_id=finished.id,
                village_id=org["village"].id,
                status="completed",
            ),
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY,
                task_type="anc_visit",
                household_id=households[0].id,
                beneficiary_id=started.id,
                village_id=org["village"].id,
                status="pending",
            ),
            ASHATask(
                asha_id=asha.id,
                task_date=TODAY,
                task_type="ncd_followup",
                household_id=households[0].id,
                beneficiary_id=worker.id,
                village_id=org["village"].id,
                status="in_progress",
            ),
        ]
    )
    await db_session.flush()

    summary = await _run_plan(db_session, asha)

    rows = [
        t for t in await _asha_tasks(db_session, asha) if t.household_id == households[0].id or t.status == "cancelled"
    ]
    by_status = {t.task_type: t.status for t in rows if t.task_type in ("ec_followup", "anc_visit", "ncd_followup")}
    # Completed history is never touched and the active visit keeps running;
    # only the idle pending row folds into the in-progress stop.
    assert by_status["ec_followup"] == "completed"
    assert by_status["ncd_followup"] == "in_progress"
    assert by_status["anc_visit"] == "cancelled"
    assert summary["merged_stops"] == 1
    # One live stop remains at this household: the in-progress visit.
    at_home = [t for t in rows if t.household_id == households[0].id and t.status in ("pending", "in_progress", "open")]
    assert [t.task_type for t in at_home] == ["ncd_followup"]
