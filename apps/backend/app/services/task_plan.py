"""Daily visit-plan generation for ASHA workers.

Rules:

* Each worker gets at most ``DAILY_TASK_QUOTA`` visits assigned per day —
  whether they finish them or not, the day holds five.
* Work still pending from an earlier day is carried forward by re-dating the
  *same* row — it counts against today's quota and is never duplicated or
  * dropped, even when the backlog is larger than the quota.
* Candidates only come from the worker's own households (``households.asha_id``),
  so two workers can never be handed the same visit.
* A household that already has an open task, or a task completed today, is
  skipped, so a second row for the same day can never appear.

Generation is idempotent: calling it repeatedly only fills the remaining slots
for ``plan_date``. It runs lazily the first time a worker asks for today's plan.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey
from app.models.child import Child, Immunization
from app.models.maternal import Pregnancy
from app.models.referral import Referral
from app.models.task import ASHATask

DAILY_TASK_QUOTA = 5
OPEN_TASK_STATUSES = ("pending", "in_progress", "open")
PLAN_TIMEZONE = ZoneInfo("Asia/Kolkata")


def plan_today() -> date:
    return datetime.now(PLAN_TIMEZONE).date()


async def generate_daily_plan(db: AsyncSession, asha_id: str, plan_date: date) -> dict[str, int]:
    """Ensure ``asha_id`` has at most ``DAILY_TASK_QUOTA`` visits on ``plan_date``.

    Returns a summary of what happened so callers can surface it in the UI.
    """
    carried_over = await _carry_over_open_tasks(db, asha_id, plan_date)

    assigned_today = (
        await db.execute(
            select(func.count(ASHATask.id)).where(
                ASHATask.asha_id == asha_id,
                ASHATask.task_date == plan_date,
                ASHATask.status != "cancelled",
            )
        )
    ).scalar_one()
    slots = max(0, DAILY_TASK_QUOTA - assigned_today)

    planned = 0
    if slots:
        taken = await _households_already_scheduled(db, asha_id, plan_date)
        for candidate in await _candidate_visits(db, asha_id, plan_date):
            if planned >= slots:
                break
            if candidate["household_id"] in taken:
                continue
            taken.add(candidate["household_id"])
            db.add(
                ASHATask(
                    asha_id=asha_id,
                    task_date=plan_date,
                    task_type=candidate["task_type"],
                    beneficiary_id=candidate.get("beneficiary_id"),
                    household_id=candidate["household_id"],
                    village_id=candidate.get("village_id"),
                    priority=candidate["priority"],
                    status="pending",
                    notes=candidate.get("notes"),
                )
            )
            planned += 1

    await db.commit()
    return {
        "quota": DAILY_TASK_QUOTA,
        "carried_over": carried_over,
        "planned": planned,
        "assigned_total": assigned_today + planned,
    }


async def _carry_over_open_tasks(db: AsyncSession, asha_id: str, plan_date: date) -> int:
    stale = (
        await db.execute(
            select(ASHATask)
            .where(
                ASHATask.asha_id == asha_id,
                ASHATask.status.in_(OPEN_TASK_STATUSES),
                or_(ASHATask.task_date.is_(None), ASHATask.task_date < plan_date),
            )
            .order_by(ASHATask.task_date.is_(None), ASHATask.task_date)
        )
    ).scalars().all()
    if not stale:
        return 0

    scheduled_today = {
        (household_id, task_type)
        for household_id, task_type in (
            await db.execute(
                select(ASHATask.household_id, ASHATask.task_type).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.status.in_(OPEN_TASK_STATUSES),
                    ASHATask.task_date == plan_date,
                )
            )
        ).all()
        if household_id is not None
    }

    carried = 0
    for task in stale:
        original = task.task_date
        if original is not None and original >= plan_date:
            continue
        key = (task.household_id, task.task_type)
        if task.household_id is not None and key in scheduled_today:
            task.status = "cancelled"
            task.notes = (task.notes + " — " if task.notes else "") + "superseded by today's plan"
            continue
        if task.household_id is not None:
            scheduled_today.add(key)
        if original is not None:
            metadata = dict(task.metadata_json or {})
            metadata.setdefault("carried_from", original.isoformat())
            task.metadata_json = metadata
            carried += 1
        task.task_date = plan_date
    return carried


async def _households_already_scheduled(db: AsyncSession, asha_id: str, plan_date: date) -> set[str]:
    open_rows = select(ASHATask.household_id).where(
        ASHATask.asha_id == asha_id,
        ASHATask.status.in_(OPEN_TASK_STATUSES),
        ASHATask.household_id.is_not(None),
    )
    done_today_rows = select(ASHATask.household_id).where(
        ASHATask.asha_id == asha_id,
        ASHATask.status.in_(("completed", "done")),
        ASHATask.task_date == plan_date,
        ASHATask.household_id.is_not(None),
    )
    rows = await db.execute(open_rows.union(done_today_rows))
    return {household_id for (household_id,) in rows}


async def _candidate_visits(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    clinical = (
        await _due_anc_visits(db, asha_id, plan_date)
        + await _due_immunizations(db, asha_id, plan_date)
        + await _due_referral_followups(db, asha_id, plan_date)
    )
    clinical.sort(key=lambda item: (item["due"] is None, item["due"] or plan_date))

    candidates = clinical + await _routine_households(db, asha_id)

    seen: set[str] = set()
    deduped: list[dict] = []
    for candidate in candidates:
        if candidate["household_id"] in seen:
            continue
        seen.add(candidate["household_id"])
        deduped.append(candidate)
    return deduped


async def _due_anc_visits(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Pregnancy.beneficiary_id,
                Pregnancy.next_anc_due,
            )
            .join(Beneficiary, Beneficiary.id == Pregnancy.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                Pregnancy.status == "ongoing",
                Pregnancy.next_anc_due.is_not(None),
                Pregnancy.next_anc_due <= plan_date,
            )
            .order_by(Pregnancy.next_anc_due)
        )
    ).all()
    return [
        {
            "household_id": household_id,
            "village_id": village_id,
            "beneficiary_id": beneficiary_id,
            "task_type": "anc_visit",
            "priority": "high",
            "due": due,
            "notes": f"ANC visit due {due.isoformat()}",
        }
        for household_id, village_id, beneficiary_id, due in rows
    ]


async def _due_immunizations(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Child.beneficiary_id,
                Immunization.due_date,
                Immunization.vaccine_name,
            )
            .join(Child, Child.id == Immunization.child_id)
            .join(Beneficiary, Beneficiary.id == Child.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                Immunization.status == "due",
                Immunization.due_date.is_not(None),
                Immunization.due_date <= plan_date,
            )
            .order_by(Immunization.due_date)
        )
    ).all()
    return [
        {
            "household_id": household_id,
            "village_id": village_id,
            "beneficiary_id": beneficiary_id,
            "task_type": "immunization",
            "priority": "high",
            "due": due,
            "notes": f"{vaccine or 'Immunization'} due {due.isoformat()}",
        }
        for household_id, village_id, beneficiary_id, due, vaccine in rows
    ]


async def _due_referral_followups(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Referral.beneficiary_id,
                Referral.followup_date,
            )
            .join(Beneficiary, Beneficiary.id == Referral.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                Referral.followup_required.is_(True),
                Referral.followup_date.is_not(None),
                Referral.followup_date <= plan_date,
                Referral.status.notin_(("completed", "closed", "cancelled")),
            )
            .order_by(Referral.followup_date)
        )
    ).all()
    return [
        {
            "household_id": household_id,
            "village_id": village_id,
            "beneficiary_id": beneficiary_id,
            "task_type": "referral_followup",
            "priority": "high",
            "due": due,
            "notes": f"Referral follow-up due {due.isoformat()}",
        }
        for household_id, village_id, beneficiary_id, due in rows
    ]


async def _routine_households(db: AsyncSession, asha_id: str) -> list[dict]:
    last_planned = (
        select(func.max(ASHATask.task_date))
        .where(ASHATask.household_id == Household.id)
        .correlate(Household)
        .scalar_subquery()
    )
    last_visited = (
        select(func.max(HouseholdSurvey.visited_at))
        .where(HouseholdSurvey.household_id == Household.id)
        .correlate(Household)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(Household.id, Household.village_id, last_planned, last_visited)
            .where(Household.asha_id == asha_id)
            .order_by(
                last_planned.is_(None).desc(),
                last_planned.asc(),
                last_visited.is_(None).desc(),
                last_visited.asc(),
                Household.hhid,
            )
        )
    ).all()
    return [
        {
            "household_id": household_id,
            "village_id": village_id,
            "beneficiary_id": None,
            "task_type": "household_visit",
            "priority": "medium",
            "due": None,
            "notes": "Routine household visit",
        }
        for household_id, village_id, _last_planned, _last_visited in rows
    ]


def pending_first_order():
    """Shared ordering: pending work first, then high priority, oldest day first."""
    return (
        ASHATask.task_date.is_(None),
        ASHATask.task_date,
        case((ASHATask.status.in_(("completed", "done", "cancelled")), 1), else_=0),
        case(
            (ASHATask.priority == "high", 0),
            (ASHATask.priority == "medium", 1),
            else_=2,
        ),
    )
