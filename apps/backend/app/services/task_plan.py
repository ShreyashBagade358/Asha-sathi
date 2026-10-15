"""Daily visit-plan generation for ASHA workers.

How a day is built:

* At most ``DAILY_TASK_QUOTA`` (5) visits, assembled in this order:

  1. up to ``CLINICAL_SLOTS`` (3) clinical visits, best score first —
     referral follow-up, ANC, immunization, PNC, child check-up, EC, NCD;
  2. rotation visits for households the worker has not served in the last
     week (never served, oldest-served and never-surveyed come first, and
     villages are served round-robin so one village cannot dominate);
  3. whatever slots are still free go back to clinical demand.
* The ``CARRY_OVER_CAP`` (2) oldest open tasks are re-dated onto the plan day
  first, so a backlog can never starve today's due immunization or ANC —
  and the cap is per *day*, so regenerating the plan repeatedly never
  drags more than two backlog rows onto it. Remaining backlog stays open on
  its original date — never dropped — is escalated to ``high`` priority after
  ``OVERDUE_ESCALATION_DAYS`` and is reported to the worker's PHC admin once
  per task.

Uniqueness — every task is specific and never a repeat:

* one row per household per day: all reasons to travel are merged into
  ``metadata["reasons"]``, so a single stop closes ANC + vaccination + … —
  rows the backlog carried in are folded together the same way (the
  heaviest type keeps the label, active ``in_progress`` work is never
  cancelled);
* a completed ``(task_type, beneficiary)`` never repeats within
  ``WEEKLY_COOLDOWN_DAYS`` (and neither does an open one);
* a routine household visit never repeats within a week, whether it was a
  task or a recorded survey;
* pre-existing duplicates (same work recorded twice, e.g. once against a
  stale or missing household link) collapse into the oldest row, whose
  household link is healed to the member's current household.

Every candidate comes from the worker's own catchment (``households.asha_id``)
and is scored — ``weight(type) + 2 * overdue_days (capped) + risk bonus`` — so
the most overdue, riskiest work always claims the top slots.

Generation is idempotent: calling it again only fills the remaining slots for
``plan_date``. It runs lazily the first time a worker asks for today's plan.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beneficiary import Beneficiary, Household, HouseholdSurvey
from app.models.child import Child, HBYCVisit, Immunization
from app.models.config import AppConfig
from app.models.eligible_couple import EligibleCouple
from app.models.maternal import DeliveryOutcome, PNCVisit, Pregnancy
from app.models.ncd import NCDScreening
from app.models.referral import Referral
from app.models.task import ASHATask
from app.models.user import Role, User
from app.services.notification import NotificationService

DAILY_TASK_QUOTA = 5
CLINICAL_SLOTS = 3
CARRY_OVER_CAP = 2
WEEKLY_COOLDOWN_DAYS = 7
OVERDUE_ESCALATION_DAYS = 7
PNC_WINDOW_DAYS = 42
CHILD_CHECKUP_INTERVAL_DAYS = 30
NCD_INTERVAL_DAYS = 90
CHILD_MAX_AGE_DAYS = 5 * 365
QUOTA_CONFIG_KEY = "asha_daily_task_quota"
OPEN_TASK_STATUSES = ("pending", "in_progress", "open")
PLAN_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Ordering weight per task type: urgent clinical work always outranks the
# rotation filler. Anything >= HIGH_SCORE is flagged ``high`` priority.
TYPE_WEIGHTS: dict[str, int] = {
    "referral_followup": 45,
    "anc_visit": 44,
    "immunization": 43,
    "pnc_visit": 42,
    "child_checkup": 30,
    "ncd_followup": 28,
    "ec_followup": 26,
    "household_visit": 10,
}
CLINICAL_TYPES = frozenset(TYPE_WEIGHTS) - {"household_visit"}
HIGH_SCORE = 40
OVERDUE_WEIGHT_CAP = 14
OVERDUE_WEIGHT_PER_DAY = 2
RISK_BONUS = 15


def plan_today() -> date:
    return datetime.now(PLAN_TIMEZONE).date()


def _score(task_type: str, due: date | None, plan_date: date, risk: bool = False) -> int:
    """Rank a need: base weight + overdue days (capped) + risk bonus."""
    overdue = (plan_date - due).days if due else 0
    return (
        TYPE_WEIGHTS.get(task_type, 10)
        + min(max(overdue, 0), OVERDUE_WEIGHT_CAP) * OVERDUE_WEIGHT_PER_DAY
        + (RISK_BONUS if risk else 0)
    )


def _need(
    household_id: str,
    village_id: str | None,
    beneficiary_id: str | None,
    task_type: str,
    plan_date: date,
    due: date | None,
    note: str,
    risk: bool = False,
) -> dict:
    return {
        "household_id": household_id,
        "village_id": village_id,
        "beneficiary_id": beneficiary_id,
        "task_type": task_type,
        "due": due,
        "note": note,
        "risk": risk,
        "score": _score(task_type, due, plan_date, risk),
    }


def _reason(need: dict) -> dict:
    """The serialised shape stored in ``metadata["reasons"]``."""
    return {
        "task_type": need["task_type"],
        "beneficiary_id": need["beneficiary_id"],
        "due": need["due"].isoformat() if need["due"] else None,
        "note": need["note"],
    }


async def generate_daily_plan(db: AsyncSession, asha_id: str, plan_date: date) -> dict[str, int]:
    """Ensure ``asha_id`` has at most ``DAILY_TASK_QUOTA`` visits on ``plan_date``.

    Returns a summary of what happened so callers can surface it in the UI.
    """
    quota = await _daily_quota(db)
    collapsed = await _collapse_day(db, asha_id, plan_date)
    carry = await _carry_over_open_tasks(db, asha_id, plan_date, quota)
    collapsed += await _collapse_day(db, asha_id, plan_date)

    today_rows = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.task_date == plan_date,
                    ASHATask.status != "cancelled",
                )
            )
        )
        .scalars()
        .all()
    )
    assigned_today = len(today_rows)
    slots = max(0, quota - assigned_today)
    visits_today = {task.household_id: task for task in today_rows if task.household_id}

    groups = await _visit_groups(db, asha_id, plan_date)

    # A visit already stands at this household today (carried over): fold the
    # new reasons into it instead of booking a second stop.
    merged = 0
    for group in groups:
        standing = visits_today.get(group["household_id"])
        if standing is not None and standing.status not in ("completed", "done", "cancelled"):
            merged += _merge_reasons(standing, group)

    planned = 0
    for group in _visit_order(groups):
        if planned >= slots:
            break
        if group["household_id"] in visits_today:
            continue
        primary = group["needs"][0]
        task = ASHATask(
            asha_id=asha_id,
            task_date=plan_date,
            task_type=primary["task_type"],
            beneficiary_id=primary["beneficiary_id"],
            household_id=group["household_id"],
            village_id=primary["village_id"],
            priority="high" if primary["score"] >= HIGH_SCORE else "medium",
            status="pending",
            notes=primary["note"],
            metadata_json={
                "source": "auto_plan",
                "score": primary["score"],
                "due": primary["due"].isoformat() if primary["due"] else None,
                "reasons": [_reason(need) for need in group["needs"]],
            },
        )
        db.add(task)
        visits_today[group["household_id"]] = task
        planned += 1

    await db.commit()
    return {
        "quota": quota,
        "carried_over": carry["carried"],
        "planned": planned,
        "assigned_total": assigned_today + planned,
        "merged_reasons": merged,
        "backlog": carry["backlog"],
        "escalated": carry["escalated"],
        "duplicates_removed": carry["cancelled"],
        "merged_stops": collapsed,
    }


# ---------------------------------------------------------------------------
# Carry-over: the backlog moves forward, but never eats the whole day
# ---------------------------------------------------------------------------
async def _carry_over_open_tasks(db: AsyncSession, asha_id: str, plan_date: date, quota: int) -> dict[str, int]:
    stale = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.status.in_(OPEN_TASK_STATUSES),
                    or_(ASHATask.task_date.is_(None), ASHATask.task_date < plan_date),
                )
            )
        )
        .scalars()
        .all()
    )
    today_rows = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.status != "cancelled",
                    ASHATask.task_date == plan_date,
                )
            )
        )
        .scalars()
        .all()
    )
    if not stale and not today_rows:
        return {"carried": 0, "backlog": 0, "escalated": 0, "cancelled": 0}

    # A task's household link can be missing or point at a deleted household;
    # the member's current household is the authority for "where is this work".
    household_ids = {task.household_id for task in (*stale, *today_rows) if task.household_id}
    beneficiary_ids = {task.beneficiary_id for task in (*stale, *today_rows) if task.beneficiary_id}
    existing_households: set[str] = set()
    if household_ids:
        existing_households.update(
            (await db.execute(select(Household.id).where(Household.id.in_(household_ids)))).scalars().all()
        )
    home_of: dict[str, str | None] = {}
    if beneficiary_ids:
        rows = (
            await db.execute(
                select(Beneficiary.id, Beneficiary.household_id).where(Beneficiary.id.in_(beneficiary_ids))
            )
        ).all()
        home_of = {row[0]: row[1] for row in rows}

    def home(task: ASHATask) -> str | None:
        if task.household_id and task.household_id in existing_households:
            return task.household_id
        if task.beneficiary_id:
            return home_of.get(task.beneficiary_id)
        return None

    def work_keys(task: ASHATask) -> set[tuple[str, str, str]]:
        # Two rows overlap when they schedule the same work: same type for the
        # same member, or same type at the same household.
        keys: set[tuple[str, str, str]] = set()
        if task.beneficiary_id:
            keys.add(("b", task.task_type, task.beneficiary_id))
        household = home(task)
        if household:
            keys.add(("h", task.task_type, household))
        return keys

    def keep_rank(task: ASHATask) -> tuple:
        # Active work survives; otherwise the oldest record wins so the
        # overdue signal is never lost, resolvable household links first.
        active = 0 if task.status in ("completed", "done", "in_progress") else 1
        return (active, task.task_date is None, task.task_date or date.min, home(task) is None, task.created_at)

    def drop(task: ASHATask, why: str) -> None:
        # Releasing the household link frees the (day, household, type) unique
        # slot so the surviving duplicate can heal onto it.
        task.household_id = None
        task.status = "cancelled"
        task.notes = (task.notes + " — " if task.notes else "") + why

    cancelled = 0
    seen: set[tuple[str, str, str]] = set()

    # 1. Collapse duplicates among today's own rows — self-healing for plans
    #    built before this pass existed.
    kept_today: list[ASHATask] = []
    for task in sorted(today_rows, key=keep_rank):
        keys = work_keys(task)
        if keys & seen:
            drop(task, "duplicate of today's plan")
            cancelled += 1
            continue
        seen |= keys
        kept_today.append(task)

    # 2. Stale backlog: superseded rows give way to today's plan, duplicates
    #    give way to the oldest record, and only then does the day's carry-over
    #    budget (cap + quota) decide what moves onto the plan date.
    today_keys: set[tuple[str, str, str]] = set()
    for task in kept_today:
        today_keys |= work_keys(task)

    already_carried = sum(
        1
        for task in kept_today
        if task.status in OPEN_TASK_STATUSES and task.metadata_json and "carried_from" in task.metadata_json
    )
    budget = max(0, CARRY_OVER_CAP - already_carried)
    used = len(kept_today)  # a finished visit still fills a slot

    survivors: list[ASHATask] = []
    superseded = dropped = 0
    for task in sorted(stale, key=keep_rank):
        original = task.task_date
        if original is not None and original >= plan_date:
            continue
        keys = work_keys(task)
        if keys & today_keys:
            drop(task, "superseded by today's plan")
            superseded += 1
            continue
        if keys & seen:
            drop(task, "duplicate of an older task")
            dropped += 1
            continue
        seen |= keys
        survivors.append(task)
    cancelled += superseded + dropped
    if cancelled:
        # Flushed before any healing so the freed unique slots are gone.
        await db.flush()

    carried = backlog = escalated = 0
    for task in survivors:
        original = task.task_date
        resolved = home(task)
        if task.household_id != resolved:
            task.household_id = resolved  # heal: broken link follows the member
        if budget > 0 and used < quota:
            if original is not None:
                metadata = dict(task.metadata_json or {})
                metadata.setdefault("carried_from", original.isoformat())
                task.metadata_json = metadata
            task.task_date = plan_date
            budget -= 1
            used += 1
            carried += 1
        else:
            backlog += 1
            if original is not None and (plan_date - original).days > OVERDUE_ESCALATION_DAYS:
                await _escalate(db, asha_id, task, plan_date)
                escalated += 1

    for task in kept_today:
        resolved = home(task)
        if task.household_id != resolved:
            task.household_id = resolved

    return {"carried": carried, "backlog": backlog, "escalated": escalated, "cancelled": cancelled}


async def _escalate(db: AsyncSession, asha_id: str, task: ASHATask, plan_date: date) -> None:
    """Oldest-of-the-old work: high priority + one alert to the PHC admins."""
    metadata = dict(task.metadata_json or {})
    metadata["overdue_days"] = (plan_date - task.task_date).days if task.task_date else None
    task.priority = "high"

    asha = await db.get(User, asha_id)
    if asha is not None and asha.sub_center_id:
        where = task.household_id[:8] if task.household_id else (task.beneficiary_id or "their catchment")[:8]
        admins = (
            (
                await db.execute(
                    select(User).where(User.role == Role.ADMIN.value, User.sub_center_id == asha.sub_center_id)
                )
            )
            .scalars()
            .all()
        )
        for admin in admins:
            await NotificationService.ensure_notification(
                db,
                user_id=admin.id,
                notif_type="asha_task_overdue",
                title="Overdue ASHA visit",
                message=(
                    f"Visit {task.task_type} at household {where} is overdue by {metadata['overdue_days']} day(s)."
                ),
                reference_id=task.id,
                reference_type="asha_task",
                priority="high",
                data={"asha_id": asha_id, "task_type": task.task_type, "overdue_days": metadata["overdue_days"]},
            )
        metadata["supervisor_alerted_at"] = plan_date.isoformat()
    task.metadata_json = metadata


# ---------------------------------------------------------------------------
# One stop per household — even rows the backlog carried in
# ---------------------------------------------------------------------------
async def _collapse_day(db: AsyncSession, asha_id: str, plan_date: date) -> int:
    """Fold same-day open rows at one household into a single visit.

    Backlog rows re-dated by carry-over can put an ANC, an NCD and an EC
    task on the same household for the same day — three rows, one stop.
    The heaviest type keeps the label (``in_progress`` work always wins so
    an active visit is never cancelled), the others fold into its
    ``metadata["reasons"]`` and are cancelled with a pointer note. Their
    underlying needs are never lost: every need regenerates from clinical
    data and merges straight back into the surviving stop.

    Households whose rows are all the same type are left alone — those are
    exact duplicates and belong to the key-dedupe pass in carry-over.
    """
    rows = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.task_date == plan_date,
                    ASHATask.status.in_(OPEN_TASK_STATUSES),
                    ASHATask.household_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    by_household: dict[str, list[ASHATask]] = {}
    for task in rows:
        by_household.setdefault(task.household_id, []).append(task)

    merged = 0
    for household_rows in by_household.values():
        if len(household_rows) < 2 or len({task.task_type for task in household_rows}) < 2:
            continue
        keeper = min(
            household_rows,
            key=lambda task: (
                0 if task.status == "in_progress" else 1,
                -TYPE_WEIGHTS.get(task.task_type, 0),
                task.created_at,
            ),
        )
        reasons = list((keeper.metadata_json or {}).get("reasons") or [])
        seen = {(reason.get("task_type"), reason.get("beneficiary_id")) for reason in reasons}
        seen.add((keeper.task_type, keeper.beneficiary_id))
        group_merged = 0
        for task in household_rows:
            if task is keeper:
                continue
            entries = list((task.metadata_json or {}).get("reasons") or [])
            entries.append(
                {
                    "task_type": task.task_type,
                    "beneficiary_id": task.beneficiary_id,
                    "due": (task.metadata_json or {}).get("due"),
                    "note": task.notes or f"{task.task_type.replace('_', ' ')} follow-up",
                }
            )
            for entry in entries:
                key = (entry.get("task_type"), entry.get("beneficiary_id"))
                if key in seen:
                    continue
                reasons.append(entry)
                seen.add(key)
            task.household_id = None
            task.status = "cancelled"
            task.notes = (task.notes + " — " if task.notes else "") + f"merged into {keeper.task_type} stop"
            group_merged += 1
        if group_merged:
            metadata = dict(keeper.metadata_json or {})
            if reasons:
                metadata["reasons"] = reasons
            keeper.metadata_json = metadata
            merged += group_merged
    if merged:
        await db.flush()
    return merged


# ---------------------------------------------------------------------------
# Blocked / cooldown context — the "unique within the week" rules
# ---------------------------------------------------------------------------
class _Blocked:
    def __init__(self) -> None:
        self.open_households: set[str] = set()
        self.recent_households: set[str] = set()
        self.surveyed_recently: set[str] = set()
        self.completed_recently: set[tuple[str, str]] = set()
        self.open_keys: set[tuple[str, str]] = set()


async def _blocked_context(db: AsyncSession, asha_id: str, plan_date: date) -> _Blocked:
    blocked = _Blocked()
    window_start = plan_date - timedelta(days=WEEKLY_COOLDOWN_DAYS)

    rows = (
        (
            await db.execute(
                select(ASHATask).where(
                    ASHATask.asha_id == asha_id,
                    ASHATask.status != "cancelled",
                    or_(
                        ASHATask.status.in_(OPEN_TASK_STATUSES),
                        ASHATask.task_date >= window_start,
                    ),
                )
            )
        )
        .scalars()
        .all()
    )
    for task in rows:
        subject = task.beneficiary_id or task.household_id
        key = (task.task_type, subject)
        if task.status in OPEN_TASK_STATUSES:
            if task.household_id:
                blocked.open_households.add(task.household_id)
            if subject:
                blocked.open_keys.add(key)
        if task.task_date is not None and task.task_date >= window_start:
            if task.household_id:
                blocked.recent_households.add(task.household_id)
            if subject and task.status in ("completed", "done"):
                blocked.completed_recently.add(key)

    surveys = (
        (
            await db.execute(
                select(HouseholdSurvey.household_id).where(
                    HouseholdSurvey.household_id.is_not(None),
                    HouseholdSurvey.visited_at >= window_start,
                )
            )
        )
        .scalars()
        .all()
    )
    blocked.surveyed_recently.update(surveys)
    return blocked


# ---------------------------------------------------------------------------
# Visit groups: one row per household, ranked by the best reason to go
# ---------------------------------------------------------------------------
async def _visit_groups(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    needs = await _all_needs(db, asha_id, plan_date, await _blocked_context(db, asha_id, plan_date))
    groups: dict[str, dict] = {}
    for need in sorted(needs, key=lambda item: -item["score"]):
        group = groups.setdefault(
            need["household_id"],
            {"household_id": need["household_id"], "village_id": need["village_id"], "needs": []},
        )
        group["needs"].append(need)
    return list(groups.values())


def _visit_order(groups: list[dict]) -> list[dict]:
    """Clinical first (best score), then rotation fill, then the rest."""
    clinical = [g for g in groups if g["needs"][0]["task_type"] in CLINICAL_TYPES]
    routine = [g for g in groups if g["needs"][0]["task_type"] not in CLINICAL_TYPES]
    return clinical[:CLINICAL_SLOTS] + _round_robin_by_village(routine) + clinical[CLINICAL_SLOTS:]


def _round_robin_by_village(groups: list[dict]) -> list[dict]:
    """Interleave villages so a single village never claims the whole day."""
    buckets: dict[str | None, list[dict]] = {}
    for group in groups:
        buckets.setdefault(group["village_id"], []).append(group)
    ordered: list[dict] = []
    while any(buckets.values()):
        for bucket in buckets.values():
            if bucket:
                ordered.append(bucket.pop(0))
    return ordered


def _merge_reasons(task: ASHATask, group: dict) -> int:
    """Fold a group's reasons into a visit that already stands today."""
    metadata = dict(task.metadata_json or {})
    reasons = list(metadata.get("reasons") or [])
    seen = {(reason.get("task_type"), reason.get("beneficiary_id")) for reason in reasons}
    seen.add((task.task_type, task.beneficiary_id))
    added = 0
    for need in group["needs"]:
        key = (need["task_type"], need["beneficiary_id"])
        if key in seen:
            continue
        reasons.append(_reason(need))
        seen.add(key)
        added += 1
    if added:
        metadata["reasons"] = reasons
        task.metadata_json = metadata
    return added


# ---------------------------------------------------------------------------
# Candidate needs — one function per source of genuine work
# ---------------------------------------------------------------------------
async def _all_needs(db: AsyncSession, asha_id: str, plan_date: date, blocked: _Blocked) -> list[dict]:
    clinical = (
        await _due_anc_visits(db, asha_id, plan_date)
        + await _due_pnc_visits(db, asha_id, plan_date)
        + await _due_immunizations(db, asha_id, plan_date)
        + await _due_child_checkups(db, asha_id, plan_date)
        + await _due_ec_followups(db, asha_id, plan_date)
        + await _due_ncd_followups(db, asha_id, plan_date)
        + await _due_referral_followups(db, asha_id, plan_date)
    )
    routine = await _routine_households(db, asha_id, plan_date)

    kept: list[dict] = []
    for need in clinical + routine:
        subject = need["beneficiary_id"] or need["household_id"]
        key = (need["task_type"], subject)
        if key in blocked.completed_recently or key in blocked.open_keys:
            continue
        if need["task_type"] not in CLINICAL_TYPES and (
            need["household_id"] in blocked.open_households
            or need["household_id"] in blocked.recent_households
            or need["household_id"] in blocked.surveyed_recently
        ):
            continue
        kept.append(need)
    return kept


async def _due_anc_visits(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    """ANC that is due — plus weekly monitoring for high-risk pregnancies."""
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Pregnancy.beneficiary_id,
                Pregnancy.next_anc_due,
                Pregnancy.last_anc_date,
                Pregnancy.risk_level,
            )
            .join(Beneficiary, Beneficiary.id == Pregnancy.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(Household.asha_id == asha_id, Pregnancy.status == "ongoing")
        )
    ).all()
    needs: list[dict] = []
    for household_id, village_id, beneficiary_id, next_due, last_anc, risk_level in rows:
        risk = bool(risk_level) and risk_level != "low"
        due = next_due
        if risk:
            # High-risk mothers are seen every week, due date or not.
            anchor = last_anc or next_due
            if anchor:
                weekly = anchor + timedelta(days=7)
                due = min(weekly, next_due) if next_due else weekly
        if due is None or due > plan_date:
            continue
        overdue = (plan_date - due).days
        note = f"ANC visit due {due.isoformat()}"
        if overdue > 0:
            note += f" ({overdue}d overdue)"
        if risk:
            note += " — high risk"
        needs.append(_need(household_id, village_id, beneficiary_id, "anc_visit", plan_date, due, note, risk))
    return needs


async def _due_pnc_visits(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    """Deliveries in the last ``PNC_WINDOW_DAYS`` that still have no PNC visit."""
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Pregnancy.beneficiary_id,
                Pregnancy.id,
                DeliveryOutcome.delivery_date,
            )
            .select_from(DeliveryOutcome)
            .join(Pregnancy, Pregnancy.id == DeliveryOutcome.pregnancy_id)
            .join(Beneficiary, Beneficiary.id == Pregnancy.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                DeliveryOutcome.delivery_date.is_not(None),
                DeliveryOutcome.delivery_date <= plan_date,
                DeliveryOutcome.delivery_date >= plan_date - timedelta(days=PNC_WINDOW_DAYS),
            )
        )
    ).all()
    visited = set((await db.execute(select(PNCVisit.pregnancy_id))).scalars().all())
    return [
        _need(
            household_id,
            village_id,
            beneficiary_id,
            "pnc_visit",
            plan_date,
            delivery_date + timedelta(days=1),
            f"PNC visit due — delivery {delivery_date.isoformat()}",
        )
        for household_id, village_id, beneficiary_id, pregnancy_id, delivery_date in rows
        if pregnancy_id not in visited
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
                Immunization.vaccine_code,
                Immunization.dose_number,
            )
            .join(Child, Child.id == Immunization.child_id)
            .join(Beneficiary, Beneficiary.id == Child.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                Immunization.status == "due",
                Immunization.given_date.is_(None),
                Immunization.due_date.is_not(None),
                Immunization.due_date <= plan_date,
            )
            .order_by(Immunization.due_date)
        )
    ).all()
    needs: list[dict] = []
    for household_id, village_id, beneficiary_id, due, name, code, dose in rows:
        vaccine = name or code or "Vaccine"
        overdue = (plan_date - due).days
        note = f"{vaccine} dose {dose or 1} due {due.isoformat()}"
        if overdue > 0:
            note += f" ({overdue}d overdue)"
        needs.append(_need(household_id, village_id, beneficiary_id, "immunization", plan_date, due, note))
    return needs


async def _due_child_checkups(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    """Growth check-up: every ``CHILD_CHECKUP_INTERVAL_DAYS`` for under-fives."""
    last_visit = (
        select(func.max(HBYCVisit.visit_date)).where(HBYCVisit.child_id == Child.id).correlate(Child).scalar_subquery()
    )
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                Beneficiary.id,
                Beneficiary.date_of_birth,
                last_visit,
            )
            .select_from(Child)
            .join(Beneficiary, Beneficiary.id == Child.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(Household.asha_id == asha_id)
        )
    ).all()
    needs: list[dict] = []
    for household_id, village_id, beneficiary_id, dob, measured in rows:
        if dob is not None and (plan_date - dob).days > CHILD_MAX_AGE_DAYS:
            continue
        if measured is not None:
            due = measured + timedelta(days=CHILD_CHECKUP_INTERVAL_DAYS)
        elif dob is not None:
            due = dob + timedelta(days=CHILD_CHECKUP_INTERVAL_DAYS)
        else:
            continue
        if due > plan_date:
            continue
        overdue = (plan_date - due).days
        note = f"Growth check-up due {due.isoformat()}"
        if overdue > 0:
            note += f" ({overdue}d overdue)"
        needs.append(_need(household_id, village_id, beneficiary_id, "child_checkup", plan_date, due, note))
    return needs


async def _due_ec_followups(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                EligibleCouple.wife_id,
                EligibleCouple.next_followup_date,
            )
            .join(Beneficiary, Beneficiary.id == EligibleCouple.wife_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                EligibleCouple.status == "active",
                EligibleCouple.next_followup_date.is_not(None),
                EligibleCouple.next_followup_date <= plan_date,
            )
            .order_by(EligibleCouple.next_followup_date)
        )
    ).all()
    return [
        _need(
            household_id,
            village_id,
            wife_id,
            "ec_followup",
            plan_date,
            due,
            f"EC follow-up due {due.isoformat()}",
        )
        for household_id, village_id, wife_id, due in rows
    ]


async def _due_ncd_followups(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    """Known diabetic/hypertensive patients: review every ``NCD_INTERVAL_DAYS``."""
    rows = (
        await db.execute(
            select(
                Beneficiary.household_id,
                Household.village_id,
                NCDScreening.beneficiary_id,
                NCDScreening.screening_date,
            )
            .join(Beneficiary, Beneficiary.id == NCDScreening.beneficiary_id)
            .join(Household, Household.id == Beneficiary.household_id)
            .where(
                Household.asha_id == asha_id,
                or_(NCDScreening.known_diabetes.is_(True), NCDScreening.known_hypertension.is_(True)),
            )
        )
    ).all()
    latest: dict[str, tuple[str, str | None, date]] = {}
    for household_id, village_id, beneficiary_id, screening_date in rows:
        if screening_date is None:
            continue
        current = latest.get(beneficiary_id)
        if current is None or screening_date > current[2]:
            latest[beneficiary_id] = (household_id, village_id, screening_date)

    needs: list[dict] = []
    for beneficiary_id, (household_id, village_id, screening_date) in latest.items():
        due = screening_date + timedelta(days=NCD_INTERVAL_DAYS)
        if due > plan_date:
            continue
        overdue = (plan_date - due).days
        note = f"NCD review due {due.isoformat()}"
        if overdue > 0:
            note += f" ({overdue}d overdue)"
        needs.append(_need(household_id, village_id, beneficiary_id, "ncd_followup", plan_date, due, note))
    return needs


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
    needs: list[dict] = []
    for household_id, village_id, beneficiary_id, due in rows:
        overdue = (plan_date - due).days
        note = f"Referral follow-up due {due.isoformat()}"
        if overdue > 0:
            note += f" ({overdue}d overdue)"
        needs.append(_need(household_id, village_id, beneficiary_id, "referral_followup", plan_date, due, note))
    return needs


async def _routine_households(db: AsyncSession, asha_id: str, plan_date: date) -> list[dict]:
    """Rotation filler, oldest-served first; cooldowns are applied by the caller."""
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
        _need(
            household_id,
            village_id,
            None,
            "household_visit",
            plan_date,
            due=None,
            note="Routine household visit",
        )
        for household_id, village_id, _last_planned, _last_visited in rows
    ]


# ---------------------------------------------------------------------------
# Quota + shared ordering
# ---------------------------------------------------------------------------
async def _daily_quota(db: AsyncSession) -> int:
    """Per-deployment override for the five-visit day (``AppConfig``)."""
    row = (await db.execute(select(AppConfig).where(AppConfig.config_key == QUOTA_CONFIG_KEY))).scalar_one_or_none()
    raw = ((row.config_value or {}).get("value")) if row else None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DAILY_TASK_QUOTA
    return min(max(value, 1), 20)


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
