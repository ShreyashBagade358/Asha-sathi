from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError
from app.models.beneficiary import Beneficiary, Household
from app.models.referral import Referral, ReferralFollowup
from app.models.user import Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.other_domain import (
    ReferralCreate,
    ReferralFollowupAllResponse,
    ReferralFollowupCreate,
    ReferralFollowupResponse,
    ReferralResponse,
    ReferralUpdate,
)
from app.services.audit import log_action
from app.services.notification import NotificationService
from app.services.sync_scope import resolve_scope

router = APIRouter()


async def _get_referral(db: AsyncSession, referral_id: str) -> Referral:
    referral = await db.get(Referral, referral_id)
    if not referral:
        raise NotFoundError("Referral not found")
    return referral


async def _patient_and_asha_for_referral(
    db: AsyncSession, referral: Referral
) -> tuple[User | None, User | None]:
    """Resolve the patient user and assigned ASHA for a referral's beneficiary."""
    beneficiary = await db.get(Beneficiary, referral.beneficiary_id)
    if beneficiary is None:
        return None, None

    # Patient user: prefer the durable users.beneficiary_id link
    patient = None
    result = await db.execute(
        select(User).where(
            User.beneficiary_id == beneficiary.id,
            User.role == Role.PATIENT.value,
        ).limit(1)
    )
    patient = result.scalar_one_or_none()

    # ASHA: registered_by first, then household
    asha = None
    if beneficiary.registered_by:
        candidate = await db.get(User, beneficiary.registered_by)
        if candidate is not None and candidate.role == Role.ASHA.value:
            asha = candidate
    if asha is None and beneficiary.household_id:
        household = await db.get(Household, beneficiary.household_id)
        if household and household.asha_id:
            asha = await db.get(User, household.asha_id)

    return patient, asha


async def _notify_referral_status(
    db: AsyncSession,
    referral: Referral,
    patient: User | None,
    asha: User | None,
    status: str,
) -> None:
    """Notify the patient and their ASHA when a referral status changes."""
    beneficiary = await db.get(Beneficiary, referral.beneficiary_id)
    patient_name = (beneficiary.full_name if beneficiary else "") or "A patient"

    if status == "accepted":
        title = "Your referral was accepted"
        message = f"{patient_name}'s {referral.urgency} referral ({referral.referral_type}) has been accepted. Please contact your ASHA worker for next steps."
        action_url = "/patient/referrals"
    elif status == "completed":
        title = "Your referral was completed"
        message = f"{patient_name}'s referral ({referral.referral_type}) has been completed."
        action_url = "/patient/referrals"
    else:
        return

    # Notify patient
    if patient is not None:
        await NotificationService.ensure_notification(
            db,
            user_id=patient.id,
            notif_type=f"referral_{status}",
            title=title,
            message=message,
            reference_id=referral.id,
            reference_type="referral",
            priority="normal",
            action_url=action_url,
            data={"referral_id": referral.id, "status": status},
        )

    # Notify ASHA
    if asha is not None:
        await NotificationService.ensure_notification(
            db,
            user_id=asha.id,
            notif_type=f"referral_{status}",
            title=f"Referral {status} for {patient_name}",
            message=f"The {referral.urgency} referral for {patient_name} ({referral.referral_type}) has been {status}.",
            reference_id=referral.id,
            reference_type="referral",
            priority="normal",
            action_url="/referrals",
            data={"patient_name": patient_name, "referral_id": referral.id, "status": status},
        )


@router.get("", response_model=PaginatedResponse[ReferralResponse])
async def list_referrals(
    status: str | None = None,
    referral_type: str | None = None,
    urgency: str | None = None,
    beneficiary_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Referral)
    if status:
        # The UI shows patient-raised referrals as "Pending", but the row is
        # stored as "initiated" — accept both spellings so the filter works.
        if status == "pending":
            stmt = stmt.where(Referral.status == "initiated")
        else:
            stmt = stmt.where(Referral.status == status)
    if referral_type:
        stmt = stmt.where(Referral.referral_type == referral_type)
    if urgency:
        stmt = stmt.where(Referral.urgency == urgency)
    if beneficiary_id:
        stmt = stmt.where(Referral.beneficiary_id == beneficiary_id)
    if user.role == Role.ASHA.value:
        # ASHAs see only referrals raised for their own people — the same
        # beneficiary set the sync scope gives the mobile app.
        scope = await resolve_scope(db, user)
        stmt = stmt.where(Referral.beneficiary_id.in_(scope.beneficiary_ids or set()))
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Referral.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate([ReferralResponse.model_validate(r) for r in result.scalars().all()], total, page, page_size)


@router.get("/followups/all", response_model=list[ReferralFollowupAllResponse])
async def list_all_referral_followups(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Every referral follow-up with its referral row, in one call.

    The ASHA follow-up page previously made one GET per referral (N+1);
    this returns the flat list instead, scoped for ASHA-role callers.
    """
    stmt = (
        select(ReferralFollowup, Referral)
        .join(Referral, Referral.id == ReferralFollowup.referral_id)
        .order_by(ReferralFollowup.followup_date)
    )
    if user.role == Role.ASHA.value:
        scope = await resolve_scope(db, user)
        stmt = stmt.where(Referral.beneficiary_id.in_(scope.beneficiary_ids or set()))
    rows = (await db.execute(stmt)).all()
    return [
        ReferralFollowupAllResponse(
            **ReferralFollowupResponse.model_validate(fu).model_dump(),
            beneficiary_id=ref.beneficiary_id,
            reason=ref.reason,
            referral_status=ref.status,
        )
        for fu, ref in rows
    ]


@router.post("", response_model=ReferralResponse, status_code=201)
async def create_referral(
    payload: ReferralCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    beneficiary = await db.get(Beneficiary, payload.beneficiary_id)
    if not beneficiary:
        raise NotFoundError("Beneficiary not found")
    referral = Referral(
        **payload.model_dump(),
        referred_from_id=user.id,
        initiated_at=datetime.now(UTC),
    )
    db.add(referral)
    await db.flush()
    await log_action(db, user.id, "referral_created", "referral", referral.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(referral)
    return referral


@router.get("/{referral_id}", response_model=ReferralResponse)
async def get_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    return await _get_referral(db, referral_id)


@router.put("/{referral_id}", response_model=ReferralResponse)
async def update_referral(
    referral_id: str,
    payload: ReferralUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    data = payload.model_dump(exclude_unset=True)
    await log_action(
        db, user.id, "referral_updated", "referral", referral.id, old_values=referral.to_dict(), new_values=data
    )
    for key, value in data.items():
        setattr(referral, key, value)
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/accept", response_model=ReferralResponse)
async def accept_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    if referral.status != "initiated":
        raise ConflictError(f"Cannot accept referral in status '{referral.status}'")
    referral.status = "accepted"
    referral.accepted_at = datetime.now(UTC)
    await log_action(db, user.id, "referral_accepted", "referral", referral.id, new_values={"status": "accepted"})
    patient, asha = await _patient_and_asha_for_referral(db, referral)
    await _notify_referral_status(db, referral, patient, asha, "accepted")
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/complete", response_model=ReferralResponse)
async def complete_referral(
    referral_id: str,
    outcome: str = "",
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    referral.status = "completed"
    referral.completed_at = datetime.now(UTC)
    if outcome:
        referral.outcome = outcome
    await log_action(db, user.id, "referral_completed", "referral", referral.id, new_values={"status": "completed"})
    patient, asha = await _patient_and_asha_for_referral(db, referral)
    await _notify_referral_status(db, referral, patient, asha, "completed")
    await db.commit()
    await db.refresh(referral)
    return referral


@router.post("/{referral_id}/followups", response_model=ReferralFollowupResponse, status_code=201)
async def add_referral_followup(
    referral_id: str,
    payload: ReferralFollowupCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_referral(db, referral_id)
    followup = ReferralFollowup(**payload.model_dump(), referral_id=referral_id, conducted_by=user.id)
    db.add(followup)
    await db.commit()
    await db.refresh(followup)
    return followup


@router.get("/{referral_id}/followups", response_model=list[ReferralFollowupResponse])
async def list_referral_followups(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    await _get_referral(db, referral_id)
    result = await db.execute(
        select(ReferralFollowup)
        .where(ReferralFollowup.referral_id == referral_id)
        .order_by(ReferralFollowup.followup_date)
    )
    return [ReferralFollowupResponse.model_validate(f) for f in result.scalars().all()]


@router.delete("/{referral_id}", response_model=MessageResponse)
async def delete_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    referral = await _get_referral(db, referral_id)
    await db.delete(referral)
    await db.commit()
    return MessageResponse(message="Referral deleted")
