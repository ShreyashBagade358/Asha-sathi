from collections import Counter
from datetime import date, timedelta
from typing import NoReturn

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.admin import PHC, Block, District, State
from app.models.beneficiary import Beneficiary, Household
from app.models.child import Child, Immunization
from app.models.eligible_couple import EligibleCouple
from app.models.incentive import IncentiveClaim
from app.models.maternal import ANCVISIT, DeliveryOutcome, PNCVisit, Pregnancy
from app.models.ncd import NCDScreening
from app.models.task import ASHAKPI
from app.models.user import User

router = APIRouter()


async def _kpi_rows(db: AsyncSession, asha_ids: list[str]) -> list[ASHAKPI]:
    if not asha_ids:
        return []
    stmt = select(ASHAKPI).where(ASHAKPI.asha_id.in_(asha_ids))
    return list((await db.execute(stmt)).scalars().all())


def _bundle_from_rows(rows: list[ASHAKPI]) -> dict:
    if not rows:
        return {"ashas": 0, "pregnancies": 0, "anc_visits": 0, "pnc_visits": 0, "deliveries": 0, "immunizations": 0}
    totals: dict[str, float] = {"ashas": len(set(r.asha_id for r in rows))}
    counter_cols = {
        "pregnancy_registered": "pregnancies",
        "anc_visits": "anc_visits",
        "pnc_visits": "pnc_visits",
        "institutional_deliveries": "deliveries",
        "children_immunized_penta": "immunizations",
        "beneficiary_registered": "beneficiaries",
        "household_registered": "households",
        "ncd_screenings": "ncd_screenings",
        "ncd_positive_referred": "ncd_positive",
        "ec_registered": "eligible_couples",
        "high_risk_pregnancies_identified": "hrp_active",
        "incentives_earned": "incentives",
    }
    for col, label in counter_cols.items():
        totals[label] = sum(getattr(r, col, 0) or 0 for r in rows)
    totals["home_visits"] = sum((getattr(r, "hbnc_visits", 0) or 0) + (getattr(r, "hbyc_visits", 0) or 0) for r in rows)
    return totals


async def _kpi_bundle(db: AsyncSession, asha_ids: list[str]) -> dict:
    return _bundle_from_rows(await _kpi_rows(db, asha_ids))


def _pct(part: float, whole: float) -> int:
    if not whole:
        return 0
    return min(100, round(part / whole * 100))


def _indicator_values(rows: list[ASHAKPI]) -> dict[str, int]:
    cols = (
        "anc_visits",
        "pregnancy_registered",
        "institutional_deliveries",
        "children_immunized_penta",
        "birth_registrations",
        "beneficiary_registered",
        "ncd_screenings",
    )
    sums = {c: sum(getattr(r, c, 0) or 0 for r in rows) for c in cols}
    immunization_denominator = sums["birth_registrations"] or sums["beneficiary_registered"]
    return {
        "anc4": _pct(sums["anc_visits"], sums["pregnancy_registered"] * 3),
        "institutional": _pct(sums["institutional_deliveries"], sums["pregnancy_registered"]),
        "immunization": _pct(sums["children_immunized_penta"], immunization_denominator),
        "ncd": _pct(sums["ncd_screenings"], sums["beneficiary_registered"]),
    }


def _recent_active(rows: list[ASHAKPI]) -> set[str]:
    previous_month = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
    return {r.asha_id for r in rows if r.period_start >= previous_month}


async def _ashas_for_users(db: AsyncSession, user_ids: list[str]) -> list[str]:
    return list((await db.execute(select(User.id).where(User.id.in_(user_ids), User.role == "asha"))).scalars().all())


async def _ashas_by_parent(db: AsyncSession, parent: str, parent_id: str) -> list[str]:
    if parent == "phc":
        return await _ashas_for_users(
            db, list((await db.execute(select(User.id).where(User.phc_id == parent_id))).scalars().all())
        )
    if parent == "district":
        return await _ashas_for_users(
            db, list((await db.execute(select(User.id).where(User.district_id == parent_id))).scalars().all())
        )
    if parent == "state":
        return await _ashas_for_users(
            db, list((await db.execute(select(User.id).where(User.state_id == parent_id))).scalars().all())
        )
    return []


async def _resolve_entity(db: AsyncSession, model, provided: str | None, user_field: str | None, label: str):
    candidate = provided or user_field
    entity = await db.get(model, candidate) if candidate else None
    if not entity and provided and user_field and provided != user_field:
        entity = await db.get(model, user_field)
    if not entity:
        raise_app_error(f"{label} not found")
    return entity


@router.get("/phc")
async def phc_dashboard(
    phc_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    phc = await _resolve_entity(db, PHC, phc_id, user.phc_id, "PHC")
    asha_ids = await _ashas_by_parent(db, "phc", phc.id)
    return {"entity": "phc", "name": phc.name, "kpis": await _kpi_bundle(db, asha_ids)}


@router.get("/district")
async def district_dashboard(
    district_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    district = await _resolve_entity(db, District, district_id, user.district_id, "District")
    asha_rows = (
        await db.execute(select(User.id, User.phc_id).where(User.role == "asha", User.district_id == district.id))
    ).all()
    asha_ids = [r.id for r in asha_rows]
    phc_of = {r.id: r.phc_id for r in asha_rows}
    kpi_rows = await _kpi_rows(db, asha_ids)
    active = _recent_active(kpi_rows)

    phcs = (
        (
            await db.execute(
                select(PHC).join(Block, Block.id == PHC.block_id).where(Block.district_id == district.id)
            )
        )
        .scalars()
        .all()
    )
    rows_by_phc: dict[str, list[ASHAKPI]] = {p.id: [] for p in phcs}
    for row in kpi_rows:
        phc_id = phc_of.get(row.asha_id)
        if phc_id in rows_by_phc:
            rows_by_phc[phc_id].append(row)
    ashas_by_phc = Counter(phc_of.values())
    active_by_phc = Counter(phc_of[a] for a in active if phc_of.get(a) in rows_by_phc)

    phc_comparison = []
    resource_utilization = []
    for phc in phcs:
        phc_rows = rows_by_phc[phc.id]
        values = _indicator_values(phc_rows)
        phc_comparison.append({"phcId": phc.id, "phcName": phc.name, "values": values})
        resource_utilization.append(
            {
                "phcId": phc.id,
                "phcName": phc.name,
                "staffFillRate": _pct(active_by_phc.get(phc.id, 0), ashas_by_phc.get(phc.id, 0)),
                "vaccineStockPct": values["immunization"],
                "equipmentUtilization": values["ncd"],
            }
        )

    return {
        "entity": "district",
        "name": district.name,
        "kpis": _bundle_from_rows(kpi_rows),
        "phcComparison": phc_comparison,
        "resourceUtilization": resource_utilization,
    }


@router.get("/state")
async def state_dashboard(
    state_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    state = await _resolve_entity(db, State, state_id, user.state_id, "State")
    asha_rows = (
        await db.execute(select(User.id, User.district_id).where(User.role == "asha", User.state_id == state.id))
    ).all()
    asha_ids = [r.id for r in asha_rows]
    district_of = {r.id: r.district_id for r in asha_rows}
    kpi_rows = await _kpi_rows(db, asha_ids)

    districts = (await db.execute(select(District).where(District.state_id == state.id))).scalars().all()
    rows_by_district: dict[str, list[ASHAKPI]] = {d.id: [] for d in districts}
    for row in kpi_rows:
        district_id = district_of.get(row.asha_id)
        if district_id in rows_by_district:
            rows_by_district[district_id].append(row)

    indicator_labels = [
        ("anc4", "ANC4+"),
        ("institutional", "Institutional"),
        ("immunization", "Immunization"),
        ("ncd", "NCD Screening"),
    ]
    district_comparison = []
    focus_areas = []
    for district in districts:
        values = _indicator_values(rows_by_district[district.id])
        district_comparison.append({"phcId": district.id, "phcName": district.name, "values": values})
        lagging_key, lagging_label = min(indicator_labels, key=lambda pair: values[pair[0]])
        gap = 75 - values[lagging_key]
        if gap > 0:
            focus_areas.append(
                {
                    "districtId": district.id,
                    "districtName": district.name,
                    "laggingIndicator": lagging_label,
                    "gapPct": gap,
                }
            )

    by_period: dict[date, list[ASHAKPI]] = {}
    for row in kpi_rows:
        by_period.setdefault(row.period_start, []).append(row)
    trend = []
    for period in sorted(by_period):
        values = _indicator_values(by_period[period])
        trend.append(
            {
                "label": period.strftime("%b %Y"),
                "value": round(sum(values.values()) / len(values)),
            }
        )

    return {
        "entity": "state",
        "name": state.name,
        "kpis": _bundle_from_rows(kpi_rows),
        "districtComparison": district_comparison,
        "trend": trend,
        "focusAreas": focus_areas,
    }


@router.get("/kpis")
async def dashboard_kpis(
    scope: str = "all",
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    today = date.today()
    kpis = [
        {
            "key": "beneficiaries",
            "label": "Total Beneficiaries",
            "value": (await db.execute(select(func.count(Beneficiary.id)))).scalar_one(),
        },
        {
            "key": "households",
            "label": "Households",
            "value": (await db.execute(select(func.count(Household.id)))).scalar_one(),
        },
        {
            "key": "pregnancies",
            "label": "Ongoing Pregnancies",
            "value": (
                await db.execute(select(func.count(Pregnancy.id)).where(Pregnancy.status == "ongoing"))
            ).scalar_one(),
        },
        {
            "key": "anc_visits",
            "label": "ANC Visits",
            "value": (await db.execute(select(func.count(ANCVISIT.id)))).scalar_one(),
        },
        {
            "key": "pnc_visits",
            "label": "PNC Visits",
            "value": (await db.execute(select(func.count(PNCVisit.id)))).scalar_one(),
        },
        {
            "key": "deliveries",
            "label": "Deliveries",
            "value": (await db.execute(select(func.count(DeliveryOutcome.id)))).scalar_one(),
        },
        {
            "key": "children",
            "label": "Children",
            "value": (await db.execute(select(func.count(Child.id)))).scalar_one(),
        },
        {
            "key": "immunizations",
            "label": "Immunizations Given",
            "value": (
                await db.execute(select(func.count(Immunization.id)).where(Immunization.status == "given"))
            ).scalar_one(),
        },
        {
            "key": "eligible_couples",
            "label": "Eligible Couples",
            "value": (await db.execute(select(func.count(EligibleCouple.id)))).scalar_one(),
        },
        {
            "key": "ncd_screenings",
            "label": "NCD Screenings",
            "value": (await db.execute(select(func.count(NCDScreening.id)))).scalar_one(),
        },
        {
            "key": "pending_claims",
            "label": "Pending Incentive Claims",
            "value": (
                await db.execute(
                    select(func.count(IncentiveClaim.id)).where(IncentiveClaim.status.in_(["draft", "submitted"]))
                )
            ).scalar_one(),
        },
    ]
    return {"scope": scope, "date": today.isoformat(), "kpis": kpis}


def raise_app_error(detail: str) -> NoReturn:
    from app.core.exceptions import NotFoundError

    raise NotFoundError(detail)
