from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import generate_patient_password, get_password_hash
from app.models.admin import PHC
from app.models.beneficiary import Beneficiary, Household
from app.models.disease import DiseaseCase
from app.models.maternal import ANCVISIT, Pregnancy
from app.models.user import Role, User
from app.schemas.patient import (
    PatientProfileResponse,
    PatientProfileUpdate,
    PatientRegistrationRequest,
    PatientRegistrationResponse,
    PatientVitals,
    PregnancySummary,
)
from app.services.audit import log_action

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
    existing_user = (
        await db.execute(select(User).where(User.phone == payload.phone))
    ).scalar_one_or_none()
    if existing_user:
        raise ConflictError("A user with this phone number already exists")

    existing_abha = (
        await db.execute(select(Beneficiary).where(Beneficiary.abha_id == payload.abha_id))
    ).scalar_one_or_none()
    if existing_abha:
        raise ConflictError("A patient with this ABHA ID already exists")

    password = payload.password or generate_patient_password(payload.phone)

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
        metadata_json={
            "village": payload.village,
            "household_id": payload.household_id,
            "asha_worker": payload.asha_worker,
            "risk": payload.risk,
            "notes": payload.notes,
        },
    )
    db.add(beneficiary)
    await db.flush()

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

    Users and Beneficiaries are linked only by phone (there is no foreign key),
    so every read of a patient's own record goes through here.
    """
    result = await db.execute(
        select(Beneficiary).where(
            Beneficiary.phone == user.phone,
            Beneficiary.status == "active",
        )
    )
    return result.scalar_one_or_none()


_VITALS_INPUTS = ("height_cm", "weight_kg", "bp_systolic", "bp_diastolic", "hemoglobin")


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
    household_ref = beneficiary.household_id or metadata.get("household_id")
    profile_inputs = metadata.get("profile_inputs")

    # The ASHA worker who registered this patient is the only durable link;
    # self-registered patients have no household row to look them up through.
    asha_user: User | None = None
    if beneficiary.registered_by:
        asha_user = await db.get(User, beneficiary.registered_by)
    if asha_user is None and beneficiary.household_id:
        household = (
            await db.execute(select(Household).where(Household.hhid == beneficiary.household_id))
        ).scalar_one_or_none()
        if household and household.asha_id:
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
            vitals = PatientVitals(
                height_cm=latest_visit.height_cm,
                weight_kg=latest_visit.weight_kg,
                bp_systolic=latest_visit.bp_systolic,
                bp_diastolic=latest_visit.bp_diastolic,
                hemoglobin=latest_visit.hemoglobin,
            )

    # No ongoing pregnancy (or no visit yet): fall back to whatever the patient
    # themselves recorded through `PUT /patients/me`. Fields they never sent
    # stay null rather than being fabricated.
    if vitals is None and isinstance(profile_inputs, dict):
        fallback = {
            key: profile_inputs[key] for key in _VITALS_INPUTS if profile_inputs.get(key) is not None
        }
        if fallback:
            vitals = PatientVitals(**fallback)

    condition_rows = (
        await db.execute(
            select(DiseaseCase.disease_type, DiseaseCase.status).where(
                DiseaseCase.beneficiary_id == beneficiary.id
            )
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
    """
    beneficiary = await _find_my_beneficiary(db, user)
    if beneficiary is None:
        raise NotFoundError("No beneficiary profile")

    updates = payload.model_dump(exclude_unset=True)
    if updates:
        metadata = dict(beneficiary.metadata_json or {})
        inputs = dict(metadata.get("profile_inputs") or {})
        inputs.update(updates)
        metadata["profile_inputs"] = inputs
        beneficiary.metadata_json = metadata
        await db.commit()

    return await _build_profile(db, user)
