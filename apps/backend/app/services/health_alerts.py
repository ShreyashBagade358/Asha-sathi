"""Scheduled health-alert generators.

Each generator scans beneficiary data scoped to a single ASHA worker and
returns a list of push payloads to fan out to the worker's devices. Alerts are
deduplicated through NotificationService.ensure_notification so the same alarm
is only pushed once (until it is resolved by new data).
"""

from datetime import date, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beneficiary import Beneficiary, Household
from app.models.child import Child, Immunization
from app.models.maternal import Pregnancy
from app.models.notification import Notification
from app.models.referral import Referral
from app.services.notification import NotificationService

DUE_WINDOW_DAYS = 7
OVERDUE_WINDOW_DAYS = 30
HIGH_RISK_SCORE = 5.0


async def _asha_beneficiary_ids(db: AsyncSession, user_id: str) -> set[str]:
    """Beneficiaries a worker owns: registered by them or living in a household
    assigned to them (households carry the asha_id)."""
    rows = (
        await db.execute(
            select(Beneficiary.id).where(
                Beneficiary.status != "inactive",
                or_(
                    Beneficiary.registered_by == user_id,
                    Beneficiary.household_id.in_(
                        select(Household.id).where(Household.asha_id == user_id)
                    ),
                ),
            )
        )
    ).scalars().all()
    return set(rows)


async def _emit(
    db: AsyncSession,
    *,
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    reference_id: str,
    reference_type: str,
    priority: str = "normal",
    data: dict[str, Any] | None = None,
) -> tuple[Notification, dict[str, Any]] | None:
    """Dedupe + persist a notification; returns (notification, push payload)."""
    notification, created = await NotificationService.ensure_notification(
        db,
        user_id=user_id,
        notif_type=notif_type,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type,
        priority=priority,
        channels=["push"],
        data=data,
    )
    if not created:
        return None
    payload = {
        "user_id": user_id,
        "title": notification.title,
        "message": notification.message,
        "data": {
            "type": notif_type,
            "reference_type": reference_type,
            "reference_id": reference_id,
            **(data or {}),
        },
    }
    return notification, payload


async def vaccination_due(db: AsyncSession, user_id: str) -> list[tuple[Notification, dict[str, Any]]]:
    """Immunizations that are due / overdue for the worker's children."""
    today = date.today()
    window_start = today - timedelta(days=OVERDUE_WINDOW_DAYS)
    window_end = today + timedelta(days=DUE_WINDOW_DAYS)
    rows = (
        await db.execute(
            select(Immunization, Child)
            .join(Child, Child.id == Immunization.child_id)
            .where(
                Immunization.given_date.is_(None),
                Immunization.status == "due",
                Immunization.due_date.is_not(None),
                Immunization.due_date >= window_start,
                Immunization.due_date <= window_end,
            )
            .order_by(Immunization.due_date.asc())
        )
    ).all()
    beneficiary_ids = await _asha_beneficiary_ids(db, user_id)

    payloads: list[tuple[Notification, dict[str, Any]]] = []
    for immunization, child in rows:
        child_row = child
        # Scoping uses the child row's beneficiary relation (child has no asha_id).
        # Pull beneficiary_id via the child's Beneficiary link below.
        beneficiary_id = await _child_beneficiary_id(db, immunization.child_id)
        if not beneficiary_id or beneficiary_id not in beneficiary_ids:
            continue
        due_date = immunization.due_date
        overdue = bool(due_date) and due_date < today
        vaccine = immunization.vaccine_name or immunization.vaccine_code
        dose = immunization.dose_number or 1
        title = f"{vaccine} dose {dose} {'overdue' if overdue else 'due'} today"
        if due_date:
            delta = (due_date - today).days
            if overdue:
                title = f"{vaccine} dose {dose} overdue by {abs(delta)} day(s)"
                child_name = child_row.birth_registration_no or "Child"
                message = f"{child_name} ({immunization.child_id[:8]}) - give {vaccine} dose {dose} soon."
            else:
                message = f"{vaccine} dose {dose} due in {delta} day(s) ({due_date.isoformat()})."
        emitted = await _emit(
            db,
            user_id=user_id,
            notif_type="vaccination_due",
            title=title,
            message=message,
            reference_id=f"{immunization.child_id}:{immunization.vaccine_code}:{immunization.dose_number}",
            reference_type="immunization",
            data={
                "child_id": immunization.child_id,
                "beneficiary_id": beneficiary_id,
                "vaccine_code": immunization.vaccine_code,
                "dose_number": immunization.dose_number,
                "due_date": due_date.isoformat() if due_date else None,
                "overdue": bool(due_date and due_date < today),
                "action_url": f"immunization?id={immunization.child_id}",
            },
        )
        if emitted:
            payloads.append(emitted)
    return payloads


async def _child_beneficiary_id(db: AsyncSession, child_id: str) -> str | None:
    row = (
        await db.execute(select(Child.beneficiary_id).where(Child.id == child_id))
    ).scalar_one_or_none()
    return row


async def high_risk(db: AsyncSession, user_id: str) -> list[tuple[Notification, dict[str, Any]]]:
    """High-risk pregnancies with upcoming ANC visits."""
    today = date.today()
    window_end = today + timedelta(days=DUE_WINDOW_DAYS)
    beneficiary_ids = await _asha_beneficiary_ids(db, user_id)
    if not beneficiary_ids:
        return []
    rows = (
        await db.execute(
            select(Pregnancy)
            .where(
                Pregnancy.beneficiary_id.in_(beneficiary_ids),
                Pregnancy.status == "ongoing",
                or_(
                    Pregnancy.risk_level.in_(["high", "very_high"]),
                    Pregnancy.risk_score >= HIGH_RISK_SCORE,
                ),
                Pregnancy.next_anc_due.is_not(None),
                Pregnancy.next_anc_due >= today,
                Pregnancy.next_anc_due <= window_end,
            )
            .order_by(Pregnancy.next_anc_due.asc())
        )
    ).scalars().all()

    payloads: list[tuple[Notification, dict[str, Any]]] = []
    for pregnancy in rows:
        next_due = pregnancy.next_anc_due
        delta = (next_due - today).days
        title = "High-risk pregnancy ANC due"
        message = (
            f"ANC check-up due {next_due.isoformat()} ({delta} day(s)) for a high-risk "
            f"pregnancy (score {pregnancy.risk_score or 'n/a'})."
        )
        emitted = await _emit(
            db,
            user_id=user_id,
            notif_type="high_risk",
            title=title,
            message=message,
            reference_id=pregnancy.id,
            reference_type="pregnancy",
            priority="high",
            data={
                "beneficiary_id": pregnancy.beneficiary_id,
                "pregnancy_id": pregnancy.id,
                "next_anc_due": next_due.isoformat(),
                "risk_score": pregnancy.risk_score,
                "action_url": f"beneficiary-detail?id={pregnancy.beneficiary_id}",
            },
        )
        if emitted:
            payloads.append(emitted)
    return payloads


async def missed_followup(db: AsyncSession, user_id: str) -> list[tuple[Notification, dict[str, Any]]]:
    """Referrals that required follow-up but are overdue."""
    today = date.today()
    beneficiary_ids = await _asha_beneficiary_ids(db, user_id)
    if not beneficiary_ids:
        return []
    rows = (
        await db.execute(
            select(Referral)
            .where(
                Referral.beneficiary_id.in_(beneficiary_ids),
                Referral.followup_required.is_(True),
                Referral.status.in_(["initiated", "accepted"]),
                Referral.followup_date.is_not(None),
                Referral.followup_date < today,
            )
            .order_by(Referral.followup_date.asc())
        )
    ).scalars().all()

    payloads: list[tuple[Notification, dict[str, Any]]] = []
    for referral in rows:
        followup_date = referral.followup_date
        delta = (today - followup_date).days
        title = "Missed follow-up"
        message = (
            f"Referral follow-up was due {followup_date.isoformat()} ({delta} day(s) ago) "
            f"- {referral.referral_type or 'referral'}."
        )
        emitted = await _emit(
            db,
            user_id=user_id,
            notif_type="missed_followup",
            title=title,
            message=message,
            reference_id=referral.id,
            reference_type="referral",
            data={
                "beneficiary_id": referral.beneficiary_id,
                "referral_id": referral.id,
                "followup_date": followup_date.isoformat() if followup_date else None,
                "action_url": (
                    f"beneficiary-detail?id={referral.beneficiary_id}"
                    if referral.beneficiary_id else "dashboard"
                ),
            },
        )
        if emitted:
            payloads.append(emitted)
    return payloads


async def generate_alerts_for_user(
    db: AsyncSession, user_id: str
) -> list[tuple[Notification, dict[str, Any]]]:
    """Run all generators for one worker and return the combined (notification, payload) pairs."""
    payloads: list[dict[str, Any]] = []
    for gen in (vaccination_due, high_risk, missed_followup):
        try:
            payloads.extend(await gen(db, user_id))
        except Exception:  # noqa: BLE001 - one generator must not break the others
            import logging

            logging.getLogger("asha.alerts").exception("Alert generator failed for user=%s", user_id)
    return payloads