from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.vaccination import NIP_SCHEDULE
from app.models.child import Immunization

# Average length of a Gregorian month in days — keeps fractional month ages
# (1.5 = 6 weeks, 2.5 = 10 weeks, 3.5 = 14 weeks, 16.5, 60, 120 …) correct
# without special-casing birth doses or week-based ages.
DAYS_PER_MONTH = 30.4375


async def generate_child_schedule(db: AsyncSession, child_id: str, dob: date | None) -> int:
    """Create Immunization rows from the NIP schedule for a child. Idempotent.

    Returns the number of rows created. If ``dob`` is None no schedule can be
    dated, so nothing is created and 0 is returned.
    """
    if dob is None:
        return 0
    rows = (
        await db.execute(
            select(Immunization.vaccine_code, Immunization.dose_number).where(Immunization.child_id == child_id)
        )
    ).all()
    existing = {(row.vaccine_code, row.dose_number) for row in rows}
    created = 0
    for entry in NIP_SCHEDULE:
        key = (entry["vaccine_code"], entry["dose"])
        if key in existing:
            continue
        due = dob + timedelta(days=round(entry["age_months"] * DAYS_PER_MONTH))
        db.add(
            Immunization(
                id=str(uuid4()),
                child_id=child_id,
                vaccine_code=entry["vaccine_code"],
                vaccine_name=entry["vaccine_name"],
                dose_number=entry["dose"],
                due_date=due,
                status="due",
                route=entry["route"],
                site=entry["site"],
            )
        )
        existing.add(key)
        created += 1
    return created
