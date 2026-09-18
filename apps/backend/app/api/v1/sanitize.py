import re

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db_session
from app.models.beneficiary import Beneficiary
from app.models.user import ASHAProfile, User
from app.schemas.admin import SanitizeFixRequest, SanitizeFixResponse, SanitizeSummary
from app.services.audit import log_action

router = APIRouter()

VALID_PREFIXES = {"6", "7", "8", "9"}


def standardize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in VALID_PREFIXES:
        return None
    return digits


def has_name_issue(name: str | None) -> bool:
    if not name:
        return False
    return name.strip() != name or "  " in name


def normalize_name(name: str | None) -> str | None:
    if not name:
        return None
    return " ".join(name.split())


@router.get("/summary", response_model=SanitizeSummary)
async def get_sanitize_summary(
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_admin),
):
    beneficiaries = (await db.execute(select(Beneficiary))).scalars().all()
    users = (await db.execute(select(User))).scalars().all()
    profiles = (await db.execute(select(ASHAProfile))).scalars().all()
    profile_user_ids = {p.user_id for p in profiles}
    asha_users = [u for u in users if u.role == "asha"]

    ben_phone_issues = sum(1 for b in beneficiaries if standardize_phone(b.phone) != (b.phone or None))
    ben_name_issues = sum(1 for b in beneficiaries if has_name_issue(b.full_name))
    ben_no_household = sum(1 for b in beneficiaries if not b.household_id)

    user_phone_issues = sum(1 for u in users if standardize_phone(u.phone) != (u.phone or None))
    user_name_issues = sum(1 for u in users if has_name_issue(u.full_name))
    asha_no_profile = sum(1 for u in asha_users if u.id not in profile_user_ids)

    return SanitizeSummary(
        beneficiaries_total=len(beneficiaries),
        beneficiaries_phone_issues=ben_phone_issues,
        beneficiaries_name_issues=ben_name_issues,
        beneficiaries_without_household=ben_no_household,
        users_total=len(users),
        users_phone_issues=user_phone_issues,
        users_name_issues=user_name_issues,
        ashas_without_profile=asha_no_profile,
    )


@router.post("/fix", response_model=SanitizeFixResponse)
async def run_sanitize_fixes(
    payload: SanitizeFixRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_admin),
):
    done_count = 0
    results: dict[str, int] = {}
    allowed = {"fix_beneficiary_phones", "fix_beneficiary_names", "fix_user_phones", "fix_user_names"}

    for action in payload.actions:
        if action not in allowed:
            continue
        fixed = 0
        if action == "fix_beneficiary_phones":
            rows = (await db.execute(select(Beneficiary))).scalars().all()
            for row in rows:
                if standardize_phone(row.phone) == (row.phone or None):
                    continue
                normalized = standardize_phone(row.phone)
                if not normalized:
                    continue
                old = row.phone
                row.phone = normalized
                await log_action(
                    db,
                    user.id,
                    "sanitize_fix_beneficiary_phone",
                    "beneficiary",
                    row.id,
                    old_values={"phone": old},
                    new_values={"phone": normalized},
                )
                fixed += 1

        elif action == "fix_beneficiary_names":
            rows = (await db.execute(select(Beneficiary))).scalars().all()
            for row in rows:
                if not has_name_issue(row.full_name):
                    continue
                old = row.full_name
                row.full_name = normalize_name(row.full_name) or row.full_name
                await log_action(
                    db,
                    user.id,
                    "sanitize_fix_beneficiary_name",
                    "beneficiary",
                    row.id,
                    old_values={"full_name": old},
                    new_values={"full_name": row.full_name},
                )
                fixed += 1

        elif action == "fix_user_phones":
            users = (await db.execute(select(User))).scalars().all()
            existing = {u.phone for u in users}
            for u in users:
                normalized = standardize_phone(u.phone)
                if not normalized or normalized == u.phone:
                    continue
                if normalized != u.phone and normalized in existing:
                    continue
                existing.discard(u.phone)
                existing.add(normalized)
                old = u.phone
                u.phone = normalized
                await log_action(
                    db,
                    user.id,
                    "sanitize_fix_user_phone",
                    "user",
                    u.id,
                    old_values={"phone": old},
                    new_values={"phone": normalized},
                )
                fixed += 1
            profiles = (await db.execute(select(ASHAProfile))).scalars().all()
            for p in profiles:
                normalized = standardize_phone(p.emergency_contact_phone)
                if normalized and normalized != (p.emergency_contact_phone or None):
                    old = p.emergency_contact_phone
                    p.emergency_contact_phone = normalized
                    await log_action(
                        db,
                        user.id,
                        "sanitize_fix_asha_emergency_phone",
                        "asha_profile",
                        p.id,
                        old_values={"emergency_contact_phone": old},
                        new_values={"emergency_contact_phone": normalized},
                    )
                    fixed += 1

        elif action == "fix_user_names":
            users = (await db.execute(select(User))).scalars().all()
            for u in users:
                if not has_name_issue(u.full_name):
                    continue
                old = u.full_name
                u.full_name = normalize_name(u.full_name) or u.full_name
                await log_action(
                    db,
                    user.id,
                    "sanitize_fix_user_name",
                    "user",
                    u.id,
                    old_values={"full_name": old},
                    new_values={"full_name": u.full_name},
                )
                fixed += 1

        results[action] = fixed
        done_count += fixed

    await db.commit()
    return SanitizeFixResponse(message=f"Sanitized {done_count} record(s)", results=results)