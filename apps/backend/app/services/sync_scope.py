"""Tenant scoping for offline sync.

Without this, any authenticated mobile client could pull every household,
beneficiary and clinical record in the deployment. The rules below are the
single source of truth for what a given role may read or write.

Role rules
----------
* ``asha``          - only households in the worker's assigned catchment
                      villages, plus households she is directly responsible for.
                      Every clinical record is reached through those households.
* ``patient``       - only the beneficiary record matching the account's phone.
* supervisor roles  - unrestricted (``anm``, ``moic``, ``bpm``, ``dpm``,
                      ``state_admin``, ``super_admin``).

The scope is expressed as a set of household ids and a set of beneficiary ids
so it can be applied to any table with a ``household_id`` / ``beneficiary_id``
link. Tables that cannot be linked back to either are never returned to a
scoped role.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beneficiary import Beneficiary
from app.models.user import ASHAProfile, User

# Roles that may see the whole deployment.
UNRESTRICTED_ROLES = frozenset({"anm", "moic", "bpm", "dpm", "state_admin", "super_admin"})


@dataclass
class SyncScope:
    """Resolved visibility for a single user.

    ``unrestricted`` short-circuits every filter. Otherwise the sets below are
    used to build per-table predicates. Empty sets mean "no rows", which is
    the safe default when a worker has no catchment configured.
    """

    unrestricted: bool = False
    household_ids: set[str] = field(default_factory=set)
    beneficiary_ids: set[str] = field(default_factory=set)
    village_ids: set[str] = field(default_factory=set)
    asha_user_id: str | None = None
    asha_phone: str | None = None

    @property
    def is_scoped(self) -> bool:
        return not self.unrestricted


async def resolve_scope(db: AsyncSession, user: User) -> SyncScope:
    """Resolve what ``user`` is allowed to sync.

    A worker with no ``catchment_villages`` and no directly assigned households
    resolves to an empty scope rather than a full one: failing closed means an
    unconfigured ASHA sees nothing instead of every patient's data.
    """
    if user.role in UNRESTRICTED_ROLES:
        return SyncScope(unrestricted=True)

    if user.role == "patient":
        scope = SyncScope(asha_phone=user.phone)
        if user.phone:
            rows = await db.execute(select(Beneficiary.id).where(Beneficiary.phone == user.phone))
            scope.beneficiary_ids = {r for r in rows.scalars().all() if r}
        return scope

    # ASHA (and any future field role): scope to the assigned catchment.
    scope = SyncScope(asha_user_id=user.id, asha_phone=user.phone)
    villages: set[str] = set()
    if user.village_id:
        villages.add(user.village_id)

    profile = (await db.execute(select(ASHAProfile).where(ASHAProfile.user_id == user.id))).scalar_one_or_none()
    if profile:
        villages.update(v for v in (profile.catchment_villages or []) if v)
    scope.village_ids = villages

    from app.models.beneficiary import Household

    conditions = [Household.asha_id == user.id]
    if villages:
        conditions.append(Household.village_id.in_(villages))

    household_rows = await db.execute(select(Household.id).where(*conditions))
    scope.household_ids = {h for h in household_rows.scalars().all() if h}

    if scope.household_ids:
        beneficiary_rows = await db.execute(
            select(Beneficiary.id).where(Beneficiary.household_id.in_(scope.household_ids))
        )
        scope.beneficiary_ids = {b for b in beneficiary_rows.scalars().all() if b}

    # A patient with no linked beneficiary record is still scoped (empty).
    return scope


def can_write_entity(user: User, entity: str) -> bool:
    """Whether ``user`` may push writes for ``entity``.

    Supervisors may push anything. A patient may only write their own
    beneficiary record and the clinical rows hanging off it; population-level
    tables (households, tasks, village forms, ...) are ASHA-owned.
    """
    if user.role in UNRESTRICTED_ROLES:
        return True
    if user.role == "patient":
        return entity not in _NO_PATIENT_WRITE
    return True


_NO_PATIENT_WRITE = frozenset({"households", "asha_tasks", "village_forms"})


def allowed_tables_for(user: User, entity: str) -> str | None:
    """Reason a push of ``entity`` is rejected, or ``None`` when allowed."""
    if can_write_entity(user, entity):
        return None
    return f"role '{user.role}' may not write '{entity}'"


def scope_predicate(model: Any, scope: SyncScope) -> Any | None:
    """Build the SQL predicate restricting ``model`` rows to ``scope``.

    Returns ``None`` when no restriction applies (unrestricted role, or a table
    with no link back to the user). Callers must treat ``None`` as "allow" only
    for tables that are genuinely global; the table map below is what makes
    every sync table link back, so a missing link is treated as a failure.
    """
    if scope.unrestricted:
        return None

    from sqlalchemy import or_

    link = _TABLE_LINKS.get(model)
    if link is None:
        # Unknown table: fail closed rather than leak.
        return False  # noqa: E712 - a SQLAlchemy false predicate

    if link == "village":
        if not scope.village_ids:
            return False  # noqa: E712
        return model.village_id.in_(scope.village_ids)

    if link == "household":
        if not scope.household_ids:
            return False  # noqa: E712
        return model.household_id.in_(scope.household_ids)

    if link == "beneficiary_self":
        # The beneficiaries table itself. A patient sees only their own row; a
        # worker sees every beneficiary in the households they are assigned to.
        clauses = []
        if scope.beneficiary_ids:
            clauses.append(model.id.in_(scope.beneficiary_ids))
        if scope.household_ids:
            clauses.append(model.household_id.in_(scope.household_ids))
        if scope.asha_phone:
            clauses.append(model.phone == scope.asha_phone)
        return or_(*clauses) if clauses else False  # noqa: E712

    if link == "asha":
        if not scope.asha_user_id:
            return False  # noqa: E712
        return model.asha_id == scope.asha_user_id

    if link == "beneficiary":
        if not scope.beneficiary_ids:
            return False  # noqa: E712
        return model.beneficiary_id.in_(scope.beneficiary_ids)

    if link == "via_pregnancy":
        # ANC / PNC / delivery rows hang off a pregnancy, not a beneficiary.
        if not scope.beneficiary_ids:
            return False  # noqa: E712
        from app.models.maternal import Pregnancy

        return model.pregnancy_id.in_(
            select(Pregnancy.id).where(Pregnancy.beneficiary_id.in_(scope.beneficiary_ids))
        )

    if link == "via_child":
        # Immunization / growth / HBNC / HBYC rows hang off a child.
        if not scope.beneficiary_ids:
            return False  # noqa: E712
        from app.models.child import Child

        return model.child_id.in_(
            select(Child.id).where(Child.beneficiary_id.in_(scope.beneficiary_ids))
        )

    if link == "eligible_couple":
        if not scope.beneficiary_ids:
            return False  # noqa: E712
        return or_(
            model.husband_id.in_(scope.beneficiary_ids),
            model.wife_id.in_(scope.beneficiary_ids),
        )

    if link == "ec_followup":
        if not scope.beneficiary_ids:
            return False  # noqa: E712
        return model.ec_id.in_(
            select(_couple_model().id).where(
                or_(
                    _couple_model().husband_id.in_(scope.beneficiary_ids),
                    _couple_model().wife_id.in_(scope.beneficiary_ids),
                )
            )
        )

    if link == "asha_or_household":
        # Tasks and village forms can be addressed by any of these links, but
        # not every model carries every column, so build from what exists.
        columns = {c.name for c in model.__table__.columns}
        clauses = []
        if scope.asha_user_id and "asha_id" in columns:
            clauses.append(model.asha_id == scope.asha_user_id)
        if scope.household_ids and "household_id" in columns:
            clauses.append(model.household_id.in_(scope.household_ids))
        if scope.village_ids and "village_id" in columns:
            clauses.append(model.village_id.in_(scope.village_ids))
        if scope.beneficiary_ids and "beneficiary_id" in columns:
            clauses.append(model.beneficiary_id.in_(scope.beneficiary_ids))
        return or_(*clauses) if clauses else False  # noqa: E712

    return False  # noqa: E712


def _couple_model() -> Any:
    from app.models.eligible_couple import EligibleCouple

    return EligibleCouple


# How each sync table reaches back to the requesting user.
_TABLE_LINKS: dict[Any, str] = {}


def register_links(models: dict[str, Any]) -> None:
    """Populate the table-link map from the sync table registry.

    Kept as a function (rather than a module-level literal) so it can import
    the models without creating a circular import at module load.
    """
    from app.models import (
        ANCVISIT,
        ASHATask,
        Child,
        DeathReport,
        DeliveryOutcome,
        DiseaseCase,
        ECFollowup,
        EligibleCouple,
        GrowthRecord,
        HBNCVisit,
        HBYCVisit,
        Immunization,
        NCDScreening,
        PNCVisit,
        Pregnancy,
        Referral,
        VillageForm,
    )
    from app.models.beneficiary import Beneficiary, Household

    links: dict[str, tuple[Any, str]] = {
        "households": (Household, "village"),
        "beneficiaries": (Beneficiary, "beneficiary_self"),
        "pregnancies": (Pregnancy, "beneficiary"),
        "anc_visits": (ANCVISIT, "via_pregnancy"),
        "pnc_visits": (PNCVisit, "via_pregnancy"),
        "delivery_outcomes": (DeliveryOutcome, "via_pregnancy"),
        "children": (Child, "beneficiary"),
        "immunizations": (Immunization, "via_child"),
        "hbnc_visits": (HBNCVisit, "via_child"),
        "hbyc_visits": (HBYCVisit, "via_child"),
        "growth_records": (GrowthRecord, "via_child"),
        "eligible_couples": (EligibleCouple, "eligible_couple"),
        "ec_followups": (ECFollowup, "ec_followup"),
        "ncd_screenings": (NCDScreening, "beneficiary"),
        "disease_cases": (DiseaseCase, "beneficiary"),
        "death_reports": (DeathReport, "beneficiary"),
        "referrals": (Referral, "beneficiary"),
        "asha_tasks": (ASHATask, "asha_or_household"),
        "village_forms": (VillageForm, "asha_or_household"),
    }

    _TABLE_LINKS.clear()
    for name, model in models.items():
        declared = links.get(name)
        if declared is not None:
            _TABLE_LINKS[model] = declared[1]
