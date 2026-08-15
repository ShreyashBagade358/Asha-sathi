from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.child import Child, Immunization
from app.models.incentive import IncentiveClaim
from app.models.maternal import ANCVISIT, DeliveryOutcome, PNCVisit, Pregnancy
from app.models.ncd import NCDScreening
from app.models.task import ASHAKPI
from app.models.user import User

router = APIRouter()


def _d(date_str: str) -> date:
    return date.fromisoformat(date_str)


@router.get("/asha-performance")
async def asha_performance_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    asha_id: str = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    stmt = select(ASHAKPI).where(ASHAKPI.period_start >= start, ASHAKPI.period_start <= end)
    if asha_id:
        stmt = stmt.where(ASHAKPI.asha_id == asha_id)
    rows = (await db.execute(stmt)).scalars().all()
    summary: dict[str, int] = {}
    for row in rows:
        for col in row.__table__.columns:
            if col.name in {
                "id",
                "asha_id",
                "period_start",
                "period_end",
                "period_type",
                "performance_score",
                "created_at",
                "updated_at",
            }:
                continue
            value = getattr(row, col.name)
            if isinstance(value, int):
                summary[col.name] = summary.get(col.name, 0) + value
    return {
        "period": [period_start, period_end],
        "asha_ids": [row.asha_id for row in rows],
        "count": len(rows),
        "summary": summary,
        "generated_at": date.today().isoformat(),
    }


@router.get("/maternal-health")
async def maternal_health_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    pregnancies = (
        await db.execute(
            select(func.count(Pregnancy.id)).where(Pregnancy.created_at >= start, Pregnancy.created_at <= end)
        )
    ).scalar_one()
    anc = (
        await db.execute(
            select(func.count(ANCVISIT.id)).where(ANCVISIT.visit_date >= start, ANCVISIT.visit_date <= end)
        )
    ).scalar_one()
    pnc = (
        await db.execute(
            select(func.count(PNCVisit.id)).where(PNCVisit.visit_date >= start, PNCVisit.visit_date <= end)
        )
    ).scalar_one()
    high_risk = (await db.execute(select(func.count(Pregnancy.id)).where(Pregnancy.risk_level == "high"))).scalar_one()
    institutional = (
        await db.execute(
            select(func.count(DeliveryOutcome.id)).where(
                DeliveryOutcome.place_of_delivery.in_(["phc", "chc", "district_hospital", "private_hospital"])
            )
        )
    ).scalar_one()
    return {
        "period": [period_start, period_end],
        "pregnancies_registered": pregnancies,
        "anc_visits": anc,
        "pnc_visits": pnc,
        "high_risk_pregnancies": high_risk,
        "institutional_deliveries": institutional,
    }


@router.get("/child-health")
async def child_health_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    children = (
        await db.execute(select(func.count(Child.id)).where(Child.created_at >= start, Child.created_at <= end))
    ).scalar_one()
    low_birth_weight = (
        await db.execute(
            select(func.count(Child.id)).where(Child.birth_weight_grams.is_not(None), Child.birth_weight_grams < 2500)
        )
    ).scalar_one()
    return {
        "period": [period_start, period_end],
        "children_registered": children,
        "low_birth_weight": low_birth_weight,
        "lbw_pct": round(low_birth_weight / children * 100, 2) if children else 0,
    }


@router.get("/immunization")
async def immunization_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    given = (
        await db.execute(
            select(func.count(Immunization.id)).where(Immunization.given_date >= start, Immunization.given_date <= end)
        )
    ).scalar_one()
    by_vaccine = (
        await db.execute(
            select(Immunization.vaccine_code, func.count(Immunization.id))
            .where(Immunization.status == "given", Immunization.given_date >= start, Immunization.given_date <= end)
            .group_by(Immunization.vaccine_code)
        )
    ).all()
    return {
        "period": [period_start, period_end],
        "doses_given": given,
        "by_vaccine": [{"vaccine_code": code, "doses": count} for code, count in by_vaccine],
    }


@router.get("/ncd")
async def ncd_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    total = (
        await db.execute(
            select(func.count(NCDScreening.id)).where(
                NCDScreening.screening_date >= start, NCDScreening.screening_date <= end
            )
        )
    ).scalar_one()
    referred = (
        await db.execute(select(func.count(NCDScreening.id)).where(NCDScreening.referral_made.is_(True)))
    ).scalar_one()
    high_bp = (
        await db.execute(select(func.count(NCDScreening.id)).where(NCDScreening.bp_systolic >= 140))
    ).scalar_one()
    high_sugar = (
        await db.execute(select(func.count(NCDScreening.id)).where(NCDScreening.blood_sugar_random >= 200))
    ).scalar_one()
    return {
        "period": [period_start, period_end],
        "screenings": total,
        "referred": referred,
        "high_bp": high_bp,
        "high_random_sugar": high_sugar,
    }


@router.get("/incentives")
async def incentives_report(
    period_start: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period_end: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    status: str = Query("approved"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    start, end = _d(period_start), _d(period_end)
    stmt = select(IncentiveClaim).where(
        IncentiveClaim.status == status,
        IncentiveClaim.claim_period_start >= start,
        IncentiveClaim.claim_period_start <= end,
    )
    claims = (await db.execute(stmt)).scalars().all()
    total_amount = sum(float(c.approved_amount or c.total_amount or 0) for c in claims)
    return {
        "period": [period_start, period_end],
        "status": status,
        "claims": len(claims),
        "total_amount": round(total_amount, 2),
        "ashas": list({c.asha_id for c in claims}),
    }
