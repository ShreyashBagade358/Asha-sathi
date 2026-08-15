from typing import Any

from app.models.task import ASHAKPI

# Configurable rate table (INR per activity). Production values come from AppConfig.
INCENTIVE_RATES: dict[str, float] = {
    "household_registered": 5.0,
    "beneficiary_registered": 2.0,
    "pregnancy_registered": 25.0,
    "anc_visits": 15.0,
    "pnc_visits": 15.0,
    "institutional_deliveries": 300.0,
    "home_deliveries": 500.0,
    "birth_registrations": 50.0,
    "hbnc_visits": 50.0,
    "hbyc_visits": 25.0,
    "children_immunized_bcg": 100.0,
    "children_immunized_opol": 100.0,
    "children_immunized_penta": 100.0,
    "children_immunized_mr": 100.0,
    "full_immunization_children": 500.0,
    "ec_registered": 20.0,
    "ec_followups": 10.0,
    "ncd_screenings": 10.0,
    "village_health_sanitation_days": 200.0,
    "village_health_nutrition_days": 200.0,
    "eligible_claims_submitted": 0.0,
    "incentives_earned": 0.0,
}


def calculate_claim(kpi: ASHAKPI, rates: dict[str, float] | None = None) -> dict[str, Any]:
    """Compute an incentive claim breakdown from an ASHAKPI row."""
    rate_table = rates or INCENTIVE_RATES
    activities: dict[str, Any] = {}
    total = 0.0
    for column, count in kpi.to_dict().items():
        if column in {
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
        rate = rate_table.get(column, 0.0)
        if rate <= 0:
            continue
        amount = float(count or 0) * rate
        if amount > 0:
            activities[column] = {"count": count, "rate": rate, "amount": amount}
            total += amount
    return {"activities": activities, "total_amount": round(total, 2)}
