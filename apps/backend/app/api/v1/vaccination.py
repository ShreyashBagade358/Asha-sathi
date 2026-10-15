from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.beneficiary import Beneficiary
from app.models.child import Child, Immunization
from app.models.user import User

router = APIRouter()

# National Immunization Schedule (India, MoHFW) - static reference data
NIP_SCHEDULE = [
    {
        "vaccine_code": "BCG",
        "vaccine_name": "BCG",
        "dose": 1,
        "age": "Birth",
        "age_months": 0,
        "route": "Intradermal",
        "site": "Left upper arm",
    },
    {
        "vaccine_code": "OPV0",
        "vaccine_name": "OPV (zero dose)",
        "dose": 1,
        "age": "Birth",
        "age_months": 0,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "HEPB0",
        "vaccine_name": "Hepatitis B (birth dose)",
        "dose": 1,
        "age": "Birth",
        "age_months": 0,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "OPV",
        "vaccine_name": "OPV",
        "dose": 1,
        "age": "6 weeks",
        "age_months": 1.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "PENTA",
        "vaccine_name": "Pentavalent",
        "dose": 1,
        "age": "6 weeks",
        "age_months": 1.5,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "ROTA",
        "vaccine_name": "Rotavirus",
        "dose": 1,
        "age": "6 weeks",
        "age_months": 1.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "FIPV",
        "vaccine_name": "IPV (fractional)",
        "dose": 1,
        "age": "6 weeks",
        "age_months": 1.5,
        "route": "ID",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "OPV",
        "vaccine_name": "OPV",
        "dose": 2,
        "age": "10 weeks",
        "age_months": 2.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "PENTA",
        "vaccine_name": "Pentavalent",
        "dose": 2,
        "age": "10 weeks",
        "age_months": 2.5,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "ROTA",
        "vaccine_name": "Rotavirus",
        "dose": 2,
        "age": "10 weeks",
        "age_months": 2.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "OPV",
        "vaccine_name": "OPV",
        "dose": 3,
        "age": "14 weeks",
        "age_months": 3.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "PENTA",
        "vaccine_name": "Pentavalent",
        "dose": 3,
        "age": "14 weeks",
        "age_months": 3.5,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "ROTA",
        "vaccine_name": "Rotavirus",
        "dose": 3,
        "age": "14 weeks",
        "age_months": 3.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "FIPV",
        "vaccine_name": "IPV (fractional)",
        "dose": 2,
        "age": "14 weeks",
        "age_months": 3.5,
        "route": "ID",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "MR",
        "vaccine_name": "Measles & Rubella",
        "dose": 1,
        "age": "9-12 months",
        "age_months": 9,
        "route": "SC",
        "site": "Right upper arm",
    },
    {
        "vaccine_code": "VITA",
        "vaccine_name": "Vitamin A",
        "dose": 1,
        "age": "9-12 months",
        "age_months": 9,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "DPT",
        "vaccine_name": "DPT booster",
        "dose": 1,
        "age": "16-24 months",
        "age_months": 16.5,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "OPV",
        "vaccine_name": "OPV booster",
        "dose": 4,
        "age": "16-24 months",
        "age_months": 16.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "MR",
        "vaccine_name": "Measles & Rubella",
        "dose": 2,
        "age": "16-24 months",
        "age_months": 16.5,
        "route": "SC",
        "site": "Left upper arm",
    },
    {
        "vaccine_code": "VITA",
        "vaccine_name": "Vitamin A",
        "dose": 2,
        "age": "16-24 months",
        "age_months": 16.5,
        "route": "Oral",
        "site": "Oral",
    },
    {
        "vaccine_code": "DPT",
        "vaccine_name": "DPT booster",
        "dose": 2,
        "age": "5-6 years",
        "age_months": 60,
        "route": "IM",
        "site": "Anterolateral thigh",
    },
    {
        "vaccine_code": "TT",
        "vaccine_name": "TT",
        "dose": 1,
        "age": "10-16 years",
        "age_months": 120,
        "route": "IM",
        "site": "Upper arm",
    },
]


def _age_months_to_dob(age_months: float) -> date:
    from datetime import timedelta

    return date.today() - timedelta(days=round(age_months * 30.4375))


@router.get("/schedule")
async def get_schedule(user: User = Depends(get_current_user)):
    return {"schedule": NIP_SCHEDULE, "source": "MoHFW National Immunization Schedule", "updated_at": "2024-01-01"}


@router.get("/due")
async def get_due_vaccinations(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Children with immunizations still due based on age."""
    result = await db.execute(
        select(Immunization, Child, Beneficiary)
        .join(Child, Child.id == Immunization.child_id)
        .outerjoin(Beneficiary, Beneficiary.id == Child.beneficiary_id)
        .where(Immunization.status == "due", Immunization.due_date.is_not(None))
    )
    due: list[dict] = []
    for imm, child, beneficiary in result.all():
        child_name = beneficiary.full_name if beneficiary else None
        due.append(
            {
                "child_id": child.id,
                "beneficiary_id": child.beneficiary_id,
                "child_name": child_name,
                "beneficiary_name": child_name,
                "vaccine_code": imm.vaccine_code,
                "vaccine_name": imm.vaccine_name,
                "dose_number": imm.dose_number,
                "due_date": imm.due_date.isoformat(),
                "status": imm.status,
            }
        )
    return {"count": len(due), "due": due}


@router.get("/coverage")
async def get_coverage(
    state_id: str = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    total_children = (await db.execute(select(func.count(Child.id)))).scalar_one()
    given = (await db.execute(select(func.count(Immunization.id)).where(Immunization.status == "given"))).scalar_one()
    due = (await db.execute(select(func.count(Immunization.id)).where(Immunization.status == "due"))).scalar_one()
    by_vaccine = (
        await db.execute(
            select(Immunization.vaccine_code, func.count(Immunization.id))
            .where(Immunization.status == "given")
            .group_by(Immunization.vaccine_code)
        )
    ).all()
    return {
        "total_children": total_children,
        "total_immunizations": given + due,
        "given": given,
        "due": due,
        "coverage_pct": round(given / (given + due) * 100, 2) if (given + due) else 0,
        "by_vaccine": [{"vaccine_code": code, "given": count} for code, count in by_vaccine],
    }


def _effective_status(status: str, due_date: date | None, today: date) -> str:
    """Resolve a stored immunization status against today's date."""
    if status in ("given", "skipped", "overdue"):
        return status
    if status == "due":
        if due_date is None:
            return "upcoming"
        return "overdue" if due_date < today else "due"
    return "upcoming"


@router.get("/children/{child_id}/vaccination-status")
async def get_child_vaccination_status(
    child_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Full vaccination status for one child: counts, progress and every dose."""
    child = await db.get(Child, child_id)
    if not child:
        raise NotFoundError("Child not found")
    result = await db.execute(
        select(Immunization)
        .where(Immunization.child_id == child_id)
        .order_by(Immunization.due_date.is_(None), Immunization.due_date)
    )
    immunizations = list(result.scalars().all())
    today = date.today()

    by_dose: list[dict] = []
    counts = {"given": 0, "due": 0, "overdue": 0, "upcoming": 0, "skipped": 0}
    next_due: dict | None = None
    for imm in immunizations:
        effective = _effective_status(imm.status, imm.due_date, today)
        counts[effective] = counts.get(effective, 0) + 1
        by_dose.append(
            {
                "vaccine_code": imm.vaccine_code,
                "vaccine_name": imm.vaccine_name,
                "dose_number": imm.dose_number,
                "due_date": imm.due_date.isoformat() if imm.due_date else None,
                "given_date": imm.given_date.isoformat() if imm.given_date else None,
                "status": imm.status,
                "effective_status": effective,
            }
        )
        if next_due is None and imm.status != "given":
            next_due = {
                "vaccine_code": imm.vaccine_code,
                "vaccine_name": imm.vaccine_name,
                "dose_number": imm.dose_number,
                "due_date": imm.due_date.isoformat() if imm.due_date else None,
            }

    total = len(immunizations)
    given = counts["given"]
    overdue = counts["overdue"]
    progress_pct = round(given / total * 100, 1) if total > 0 else 0
    fully_immunized = given == total and total > 0
    if fully_immunized:
        overall_status = "fully_immunized"
    elif overdue > 0:
        overall_status = "overdue"
    else:
        overall_status = "on_track"

    return {
        "child_id": child.id,
        "beneficiary_id": child.beneficiary_id,
        "total": total,
        "given": given,
        "due": counts["due"],
        "overdue": overdue,
        "upcoming": counts["upcoming"],
        "skipped": counts["skipped"],
        "progress_pct": progress_pct,
        "fully_immunized": fully_immunized,
        "overall_status": overall_status,
        "next_due": next_due,
        "by_dose": by_dose,
    }
