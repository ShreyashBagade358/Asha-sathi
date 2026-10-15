from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import generate_patient_password, get_password_hash
from app.models.admin import PHC, Village
from app.models.beneficiary import Beneficiary, Household
from app.models.disease import DiseaseCase
from app.models.maternal import ANCVISIT, Pregnancy
from app.models.ncd import NCDScreening
from app.models.task import ASHATask
from app.models.user import Role, User
from app.schemas.patient import (
    AppointmentRequestCreate,
    AppointmentRequestResponse,
    PatientHouseholdMember,
    PatientHouseholdResponse,
    PatientProfileResponse,
    PatientProfileUpdate,
    PatientRegistrationRequest,
    PatientRegistrationResponse,
    PatientVitals,
    PregnancySummary,
)
from app.services.audit import log_action
from app.services.notification import NotificationService

router = APIRouter()

# Either an ASHA worker or an admin can onboard a patient.
PATIENT_REGISTRARS = require_roles(Role.ASHA, Role.ADMIN)

# DiseaseCase.status values that mean the condition is no longer active.
_RESOLVED_CONDITIONS = {"resolved", "recovered", "cured", "completed", "negative"}
_HIGH_RISK_LEVELS = {"high", "very high", "critical"}


def _age_on(dob: date, on: date) -> int:
    years = on.year - dob.year
    if (on.month, on.day) < (dob.month, dob.day):
        years -= 1
    return max(years, 0)


async def _resolve_household(db: AsyncSession, ref: str | None) -> Household | None:
    """Resolve a client-supplied household reference to its row.

    Clients send either the household UUID (mobile picker, PHC form) or the
    human ``hhid`` (free-text forms). Unresolvable references return None —
    the raw value then lives only in the beneficiary's metadata.
    """
    if not ref:
        return None
    household = await db.get(Household, ref)
    if household is not None:
        return household
    result = await db.execute(select(Household).where(Household.hhid == ref))
    return result.scalar_one_or_none()


@router.post("/register", response_model=PatientRegistrationResponse, status_code=201)
async def register_patient(
    payload: PatientRegistrationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    registrar: User = Depends(PATIENT_REGISTRARS),
):
    """Create the patient's domain record and their login account in one step.

    Returns the generated password exactly once — it is stored only as a bcrypt hash,
    so it cannot be recovered later.
    """
    existing_user = (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none()
    if existing_user:
        raise ConflictError("A user with this phone number already exists")

    existing_abha = (
        await db.execute(select(Beneficiary).where(Beneficiary.abha_id == payload.abha_id))
    ).scalar_one_or_none()
    if existing_abha:
        raise ConflictError("A patient with this ABHA ID already exists")

    password = payload.password or generate_patient_password(payload.phone)
    household = await _resolve_household(db, payload.household_id)

    user = User(
        role=Role.PATIENT.value,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=get_password_hash(password),
        language="hi",
    )
    db.add(user)
    await db.flush()

    beneficiary = Beneficiary(
        beneficiary_id=f"BHF-{user.id[:8].upper()}",
        abha_id=payload.abha_id,
        full_name=payload.full_name,
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
        age_years=_age_on(payload.date_of_birth, date.today()),
        phone=payload.phone,
        blood_group=payload.blood_group,
        registered_by=registrar.id,
        # The column is what `GET /households/{id}/members` and the ASHA sync
        # scope filter on — metadata alone left registered patients invisible
        # to their own household. The metadata copy is kept for older readers.
        household_id=household.id if household else None,
        relationship_to_head=payload.relationship_to_head,
        metadata_json={
            "village": payload.village,
            "state": payload.state,
            "district": payload.district,
            "household_id": household.id if household else payload.household_id,
            "asha_worker": payload.asha_worker,
            "risk": payload.risk,
            "notes": payload.notes,
        },
    )
    db.add(beneficiary)
    await db.flush()

    # Durable User -> Beneficiary link; phone stays as the fallback join for
    # accounts created before this column existed.
    user.beneficiary_id = beneficiary.id

    await log_action(
        db,
        registrar.id,
        "patient_registered",
        "user",
        user.id,
        new_values={"phone": user.phone, "full_name": user.full_name, "abha_id": payload.abha_id},
        ip_address=request.client.host if request.client else None,
        request_id=request.headers.get("X-Request-ID"),
    )
    await db.commit()
    await db.refresh(user)
    await db.refresh(beneficiary)

    return PatientRegistrationResponse(
        user_id=user.id,
        beneficiary_id=beneficiary.beneficiary_id,
        phone=user.phone,
        full_name=user.full_name,
        password=password,
    )


def _age_on_or_none(dob: date | None, stored: int | None) -> int | None:
    if stored is not None:
        return stored
    return _age_on(dob, date.today()) if dob else None


def _pregnancy_summary(pregnancy: Pregnancy) -> PregnancySummary:
    """Trimester and gestational week are not stored — derive them from LMP."""
    week: int | None = None
    trimester: int | None = None
    if pregnancy.lmp:
        days = (date.today() - pregnancy.lmp).days
        if 0 <= days <= 308:
            week = days // 7
            trimester = 1 if week < 14 else 2 if week < 28 else 3
    risk_level = (pregnancy.risk_level or "low").lower()
    return PregnancySummary(
        lmp=pregnancy.lmp,
        edd=pregnancy.edd,
        anc_visits=pregnancy.anc_count or 0,
        risk_level=risk_level,
        high_risk=risk_level in _HIGH_RISK_LEVELS,
        trimester=trimester,
        week=week,
    )


async def _find_my_beneficiary(db: AsyncSession, user: User) -> Beneficiary | None:
    """The one place the User -> Beneficiary join happens server-side.

    Prefers the durable ``users.beneficiary_id`` link written at registration;
    the phone join is the fallback for accounts created before that column
    existed. Several family members can share one phone, so the fallback picks
    the oldest active row deterministically instead of raising.
    """
    if user.beneficiary_id:
        linked = await db.get(Beneficiary, user.beneficiary_id)
        if linked is not None and linked.status == "active":
            return linked
    if not user.phone:
        return None
    result = await db.execute(
        select(Beneficiary)
        .where(Beneficiary.phone == user.phone, Beneficiary.status == "active")
        .order_by(Beneficiary.created_at)
        .limit(1)
    )
    return result.scalar_one_or_none()


_VITALS_INPUTS = (
    "height_cm", "weight_kg", "bp_systolic", "bp_diastolic", "hemoglobin",
    "blood_sugar_random", "waist_circumference_cm",
)


async def _build_profile(db: AsyncSession, user: User) -> PatientProfileResponse:
    """Assemble the signed-in patient's own record.

    Shared by `GET /patients/me` and `PUT /patients/me` so a write can never
    return a shape different from the read that follows it. Everything the
    client cannot query itself — the ASHA worker's name and their PHC — is
    resolved here from `beneficiaries.registered_by`.
    """
    beneficiary = await _find_my_beneficiary(db, user)

    if beneficiary is None:
        return PatientProfileResponse(
            user_id=user.id,
            full_name=user.full_name,
            phone=user.phone,
        )

    metadata = beneficiary.metadata_json or {}
    village = metadata.get("village")
    # The column holds a household UUID; older rows only carry a reference
    # (UUID or hhid) in metadata. Resolve either form so the ASHA fallback and
    # the address never compare an hhid against the UUID column.
    household = await _resolve_household(db, beneficiary.household_id)
    if household is None:
        household = await _resolve_household(db, metadata.get("household_id"))
    household_ref = household.id if household else (beneficiary.household_id or metadata.get("household_id"))
    profile_inputs = metadata.get("profile_inputs")

    # The ASHA worker who registered this patient is the only durable link;
    # self-registered patients have no household row to look them up through.
    asha_user: User | None = None
    if beneficiary.registered_by:
        asha_user = await db.get(User, beneficiary.registered_by)
    if asha_user is None and household and household.asha_id:
        asha_user = await db.get(User, household.asha_id)

    phc_name: str | None = None
    phc_id = asha_user.phc_id if asha_user else None
    if phc_id is None:
        phc_id = user.phc_id
    if phc_id:
        phc = await db.get(PHC, phc_id)
        phc_name = phc.name if phc else None

    address_parts: list[str] = []
    if household_ref:
        address_parts.append(f"Household {household_ref}")
    if village:
        address_parts.append(village)

    pregnancy = (
        await db.execute(
            select(Pregnancy)
            .where(
                Pregnancy.beneficiary_id == beneficiary.id,
                Pregnancy.status == "ongoing",
            )
            .order_by(Pregnancy.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    pregnancy_summary: PregnancySummary | None = None
    vitals: PatientVitals | None = None
    if pregnancy is not None:
        pregnancy_summary = _pregnancy_summary(pregnancy)
        latest_visit = (
            await db.execute(
                select(ANCVISIT)
                .where(ANCVISIT.pregnancy_id == pregnancy.id)
                .order_by(ANCVISIT.visit_date.desc(), ANCVISIT.visit_number.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest_visit is not None:
            bmi = latest_visit.bmi
            if bmi is None and latest_visit.height_cm and latest_visit.weight_kg:
                height_m = latest_visit.height_cm / 100
                bmi = round(latest_visit.weight_kg / (height_m * height_m), 1)
            vitals = PatientVitals(
                height_cm=latest_visit.height_cm,
                weight_kg=latest_visit.weight_kg,
                bmi=bmi,
                bp_systolic=latest_visit.bp_systolic,
                bp_diastolic=latest_visit.bp_diastolic,
                pulse=latest_visit.pulse,
                temperature=latest_visit.temperature,
                spo2=latest_visit.spo2,
                hemoglobin=latest_visit.hemoglobin,
                blood_sugar_random=latest_visit.blood_sugar_random,
                waist_circumference_cm=None,
                blood_group=latest_visit.blood_group or beneficiary.blood_group,
            )

    # Non-pregnant patients (or no ANC visit yet): pull the latest NCD
    # screening, which carries BP, blood sugar, and waist circumference.
    if vitals is None:
        ncd = (
            await db.execute(
                select(NCDScreening)
                .where(NCDScreening.beneficiary_id == beneficiary.id)
                .order_by(NCDScreening.screening_date.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if ncd is not None:
            vitals = PatientVitals(
                bp_systolic=ncd.bp_systolic,
                bp_diastolic=ncd.bp_diastolic,
                blood_sugar_random=ncd.blood_sugar_random,
                waist_circumference_cm=ncd.waist_circumference_cm,
                blood_group=beneficiary.blood_group,
            )

    # No ongoing pregnancy (or no visit yet): fall back to whatever the patient
    # themselves recorded through `PUT /patients/me`. Fields they never sent
    # stay null rather than being fabricated.
    if vitals is None and isinstance(profile_inputs, dict):
        fallback = {key: profile_inputs[key] for key in _VITALS_INPUTS if profile_inputs.get(key) is not None}
        if fallback:
            fallback["blood_group"] = beneficiary.blood_group
            if fallback.get("height_cm") and fallback.get("weight_kg"):
                height_m = fallback["height_cm"] / 100
                fallback["bmi"] = round(fallback["weight_kg"] / (height_m * height_m), 1)
            vitals = PatientVitals(**fallback)

    condition_rows = (
        await db.execute(
            select(DiseaseCase.disease_type, DiseaseCase.status).where(DiseaseCase.beneficiary_id == beneficiary.id)
        )
    ).all()
    active_conditions = [
        disease_type
        for disease_type, status in condition_rows
        if disease_type and (status or "").lower() not in _RESOLVED_CONDITIONS
    ]

    return PatientProfileResponse(
        user_id=user.id,
        beneficiary_id=beneficiary.beneficiary_id,
        full_name=beneficiary.full_name or user.full_name,
        phone=beneficiary.phone or user.phone,
        abha_id=beneficiary.abha_id,
        date_of_birth=beneficiary.date_of_birth,
        age_years=_age_on_or_none(beneficiary.date_of_birth, beneficiary.age_years),
        gender=beneficiary.gender,
        blood_group=beneficiary.blood_group,
        village=village,
        household_id=household_ref,
        address=", ".join(address_parts) if address_parts else None,
        phc_name=phc_name,
        asha_worker_name=asha_user.full_name if asha_user else None,
        asha_worker=metadata.get("asha_worker"),
        risk=beneficiary.risk,
        notes=beneficiary.notes,
        profile_inputs=profile_inputs,
        is_pregnant=pregnancy is not None,
        active_conditions=active_conditions,
        pregnancy=pregnancy_summary,
        vitals=vitals,
    )


@router.get("/me", response_model=PatientProfileResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """The signed-in patient's own record.

    Everything the client cannot query itself — the ASHA worker's name and
    their PHC — is resolved server-side (see `_build_profile`).
    """
    return await _build_profile(db, user)


@router.get("/me/household", response_model=PatientHouseholdResponse)
async def get_my_household(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """The household the signed-in patient lives in, and who else lives there.

    Demographics and the family roll only — every member is a name, an age and
    a relation, with `is_self` marking the caller so the client can label "You".
    A profile with no resolvable household is a 404 rather than an empty shell:
    there is nothing to show and nothing to invent.
    """
    beneficiary = await _find_my_beneficiary(db, user)
    if beneficiary is None:
        raise NotFoundError("No beneficiary profile")

    household = await _resolve_household(db, beneficiary.household_id)
    if household is None:
        household = await _resolve_household(db, (beneficiary.metadata_json or {}).get("household_id"))
    if household is None:
        raise NotFoundError("No household linked to this profile")

    members = (
        (
            await db.execute(
                select(Beneficiary)
                .where(Beneficiary.household_id == household.id, Beneficiary.status == "active")
                .order_by(
                    # Head first, then registration order: the same shape the
                    # ASHA members list uses, so the two agree.
                    case((Beneficiary.relationship_to_head == "head", 0), else_=1),
                    Beneficiary.created_at,
                )
            )
        )
        .scalars()
        .all()
    )

    village_name: str | None = None
    if household.village_id:
        village = await db.get(Village, household.village_id)
        village_name = village.name if village else None
    if village_name is None:
        village_name = (beneficiary.metadata_json or {}).get("village")

    return PatientHouseholdResponse(
        id=household.id,
        hhid=household.hhid,
        head_name=household.head_name,
        ward=household.ward,
        address=household.address,
        village=village_name,
        family_size=household.family_size,
        contact_phone=household.contact_phone,
        member_count=len(members),
        members=[
            PatientHouseholdMember(
                id=member.id,
                full_name=member.full_name,
                gender=member.gender,
                age_years=_age_on_or_none(member.date_of_birth, member.age_years),
                age_months=member.age_months,
                relationship_to_head=member.relationship_to_head,
                marital_status=member.marital_status,
                is_pregnant=member.is_pregnant,
                is_lactating=member.is_lactating,
                is_self=member.id == beneficiary.id,
            )
            for member in members
        ],
    )


# Human-readable labels for the fields a patient may self-edit. Used in the
# ASHA notification message so the worker sees "Blood Sugar" not "blood_sugar_random".
_FIELD_LABELS: dict[str, str] = {
    "height_cm": "Height",
    "weight_kg": "Weight",
    "bp_systolic": "BP (systolic)",
    "bp_diastolic": "BP (diastolic)",
    "hemoglobin": "Haemoglobin",
    "blood_sugar_random": "Blood Sugar",
    "waist_circumference_cm": "Waist Circumference",
    "tobacco_use": "Tobacco Use",
    "alcohol_use": "Alcohol Use",
    "physical_activity": "Physical Activity",
    "family_history_diabetes": "Family History of Diabetes",
    "family_history_hypertension": "Family History of Hypertension",
    "known_diabetes": "Known Diabetes",
    "known_hypertension": "Known Hypertension",
    "gravida": "Gravida",
    "parity": "Parity",
    "previous_csection": "Previous C-Section",
    "previous_miscarriages": "Previous Miscarriages",
    "previous_pph": "Previous PPH",
    "previous_preterm": "Previous Preterm",
    "previous_stillbirth": "Previous Stillbirth",
    "multiple_pregnancy": "Multiple Pregnancy",
}


async def _resolve_asha_for_beneficiary(db: AsyncSession, beneficiary: Beneficiary) -> User | None:
    """Find the ASHA worker responsible for this beneficiary.

    Same two-link rule as `_build_profile`: registered_by first, then the
    household's asha_id. Returns None for self-registered patients with no
    household — the notification is simply skipped in that case.
    """
    if beneficiary.registered_by:
        asha = await db.get(User, beneficiary.registered_by)
        if asha is not None and asha.role == "asha":
            return asha
    if beneficiary.household_id:
        household = await db.get(Household, beneficiary.household_id)
        if household and household.asha_id:
            asha = await db.get(User, household.asha_id)
            if asha is not None:
                return asha
    return None


@router.put("/me", response_model=PatientProfileResponse)
async def update_my_profile(
    payload: PatientProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Merge the patient's own screening inputs into their profile.

    Only the keys actually present in the body are written, into
    `Beneficiary.metadata_json["profile_inputs"]`; every other metadata key
    (village, asha_worker, risk, ...) is preserved. Responds with exactly the
    same document `GET /me` would return.

    When fields change, the patient's ASHA worker is notified with the
    patient's name and which fields were updated.
    """
    beneficiary = await _find_my_beneficiary(db, user)
    if beneficiary is None:
        raise NotFoundError("No beneficiary profile")

    updates = payload.model_dump(exclude_unset=True)
    if updates:
        metadata = dict(beneficiary.metadata_json or {})
        inputs = dict(metadata.get("profile_inputs") or {})
        old_inputs = dict(inputs)
        inputs.update(updates)
        metadata["profile_inputs"] = inputs
        beneficiary.metadata_json = metadata

        # Only fields whose value actually changed go in the notification —
        # a save that sends the same values is not an update.
        changed = {
            key: value
            for key, value in updates.items()
            if old_inputs.get(key) != value
        }

        await log_action(
            db,
            user.id,
            "patient_profile_updated",
            "beneficiary",
            beneficiary.id,
            old_values=old_inputs,
            new_values=updates,
        )

        if changed:
            asha = await _resolve_asha_for_beneficiary(db, beneficiary)
            if asha is not None:
                patient_name = beneficiary.full_name or user.full_name
                changed_list = ", ".join(
                    _FIELD_LABELS.get(key, key) for key in changed
                )
                await NotificationService.ensure_notification(
                    db,
                    user_id=asha.id,
                    notif_type="patient_profile_updated",
                    title=f"{patient_name} updated their health profile",
                    message=(
                        f"{patient_name} updated: {changed_list}. "
                        f"Review the latest values when convenient."
                    ),
                    reference_id=beneficiary.id,
                    reference_type="beneficiary",
                    priority="normal",
                    action_url=f"/asha/patients/{beneficiary.id}",
                    data={
                        "patient_name": patient_name,
                        "changed_fields": list(changed.keys()),
                        "changes": {
                            key: {"old": old_inputs.get(key), "new": value}
                            for key, value in changed.items()
                        },
                    },
                )

        await db.commit()

    return await _build_profile(db, user)


@router.post(
    "/me/appointment-requests",
    response_model=AppointmentRequestResponse,
    status_code=201,
)
async def create_appointment_request(
    payload: AppointmentRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Patient books an appointment with their ASHA worker.

    Creates an ASHATask (picked up by the worker via sync) and a Notification.
    """
    beneficiary = await _find_my_beneficiary(db, user)
    if beneficiary is None:
        raise NotFoundError("No beneficiary profile")

    asha = await _resolve_asha_for_beneficiary(db, beneficiary)
    if asha is None:
        raise NotFoundError("No ASHA worker assigned to your account")

    patient_name = beneficiary.full_name or user.full_name
    village_id = None
    if beneficiary.household_id:
        household = await db.get(Household, beneficiary.household_id)
        village_id = household.village_id if household else None

    task = ASHATask(
        asha_id=asha.id,
        task_date=payload.preferred_date,
        task_type="appointment_request",
        beneficiary_id=beneficiary.id,
        household_id=beneficiary.household_id,
        village_id=village_id,
        priority="medium",
        status="pending",
        notes=f"{patient_name}: {payload.reason}",
        metadata_json={
            "reason": payload.reason,
            "preferred_date": payload.preferred_date.isoformat(),
            "preferred_time": payload.preferred_time,
            "patient_name": patient_name,
            "patient_phone": user.phone,
            "notes": payload.notes,
        },
    )
    db.add(task)
    await db.flush()

    await log_action(
        db,
        user.id,
        "appointment_requested",
        "asha_task",
        task.id,
        new_values={
            "reason": payload.reason,
            "preferred_date": payload.preferred_date.isoformat(),
            "preferred_time": payload.preferred_time,
        },
    )

    await NotificationService.ensure_notification(
        db,
        user_id=asha.id,
        notif_type="appointment_requested",
        title=f"{patient_name} booked an appointment",
        message=(
            f"{patient_name} requested: {payload.reason} on "
            f"{payload.preferred_date.strftime('%d %b %Y')}"
            + (f" at {payload.preferred_time}" if payload.preferred_time else "")
            + "."
        ),
        reference_id=task.id,
        reference_type="asha_task",
        priority="normal",
        action_url="/tasks",
        data={
            "patient_name": patient_name,
            "reason": payload.reason,
            "preferred_date": payload.preferred_date.isoformat(),
            "preferred_time": payload.preferred_time,
        },
    )

    await db.commit()

    return AppointmentRequestResponse(
        id=task.id,
        reason=payload.reason,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        notes=payload.notes,
        status="pending",
        asha_worker_name=asha.full_name,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.get(
    "/me/appointment-requests",
    response_model=list[AppointmentRequestResponse],
)
async def list_appointment_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List this patient's appointment requests (their appointment_request tasks)."""
    beneficiary = await _find_my_beneficiary(db, user)
    if beneficiary is None:
        return []

    result = await db.execute(
        select(ASHATask)
        .where(
            ASHATask.beneficiary_id == beneficiary.id,
            ASHATask.task_type == "appointment_request",
        )
        .order_by(ASHATask.created_at.desc())
        .limit(50)
    )
    tasks = result.scalars().all()

    asha_ids = {t.asha_id for t in tasks}
    asha_names: dict[str, str] = {}
    if asha_ids:
        users = (
            await db.execute(select(User).where(User.id.in_(asha_ids)))
        ).scalars().all()
        asha_names = {u.id: u.full_name for u in users}

    return [
        AppointmentRequestResponse(
            id=t.id,
            reason=(t.metadata_json or {}).get("reason", t.notes or ""),
            preferred_date=t.task_date or date.today(),
            preferred_time=(t.metadata_json or {}).get("preferred_time"),
            notes=(t.metadata_json or {}).get("notes"),
            status=t.status,
            asha_worker_name=asha_names.get(t.asha_id),
            created_at=t.created_at.isoformat() if t.created_at else None,
        )
        for t in tasks
    ]
