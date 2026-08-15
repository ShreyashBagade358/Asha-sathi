from datetime import date
from typing import NoReturn

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.admin import PHC, District, State
from app.models.beneficiary import Beneficiary, Household
from app.models.child import Child, Immunization
from app.models.eligible_couple import EligibleCouple
from app.models.incentive import IncentiveClaim
from app.models.maternal import ANCVISIT, DeliveryOutcome, PNCVisit, Pregnancy
from app.models.ncd import NCDScreening
from app.models.task import ASHAKPI
from app.models.user import User

router = APIRouter()


async def _kpi_bundle(db: AsyncSession, asha_ids: list[str]) -> dict:
    if not asha_ids:
        return {"ashas": 0, "pregnancies": 0, "anc_visits": 0, "pnc_visits": 0, "deliveries": 0, "immunizations": 0}
    stmt = select(ASHAKPI).where(ASHAKPI.asha_id.in_(asha_ids))
    rows = (await db.execute(stmt)).scalars().all()
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
    asha_ids = await _ashas_by_parent(db, "district", district.id)
    return {"entity": "district", "name": district.name, "kpis": await _kpi_bundle(db, asha_ids)}


@router.get("/state")
async def state_dashboard(
    state_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    state = await _resolve_entity(db, State, state_id, user.state_id, "State")
    asha_ids = await _ashas_by_parent(db, "state", state.id)
    return {"entity": "state", "name": state.name, "kpis": await _kpi_bundle(db, asha_ids)}


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
