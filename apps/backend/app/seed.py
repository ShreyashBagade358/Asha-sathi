"""Demo data seeder for ASHA Sathi.

Populates a realistic Uttar Pradesh health-system hierarchy plus demo users,
households, beneficiaries, pregnancies, children, an NCD screening, KPIs,
incentive claims, tasks and notifications.

Run from the backend directory:

    python -m app.seed

The script is idempotent for records that carry natural unique keys
(geography, users, households, beneficiaries, KPIs). Records without a natural
key (ANC visits, immunizations, notifications) may be duplicated on repeat runs,
which is acceptable for a demo environment.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.security import get_password_hash
from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.beneficiary import Beneficiary, Household
from app.models.child import Child, Immunization
from app.models.eligible_couple import EligibleCouple
from app.models.incentive import IncentiveClaim
from app.models.maternal import ANCVISIT, Pregnancy
from app.models.ncd import NCDScreening
from app.models.notification import Notification
from app.models.task import ASHAKPI, ASHATask
from app.models.user import ASHAProfile, Role, User

logger = logging.getLogger(__name__)


async def _get_or_create(
    session: Any, model: type, defaults: dict[str, Any], **unique_filters: Any
) -> tuple[Any, bool]:
    """Return (instance, created) matching unique_filters, creating it with defaults."""
    existing = await session.scalar(select(model).filter_by(**unique_filters))
    if existing is not None:
        return existing, False
    instance = model(**defaults, **unique_filters)
    session.add(instance)
    await session.flush()
    return instance, True


async def seed_demo() -> None:
    async with async_session_maker() as session:
        async with session.begin():
            # ------------------------------------------------------------------
            # 1. Geography hierarchy (Uttar Pradesh)
            # ------------------------------------------------------------------
            state, _ = await _get_or_create(
                session,
                State,
                {
                    "name": "Uttar Pradesh",
                    "name_local": {"hi": "उत्तर प्रदेश"},
                    "latitude": 26.8467,
                    "longitude": 80.9462,
                    "is_active": True,
                },
                code="UP",
            )
            district, _ = await _get_or_create(
                session,
                District,
                {
                    "name": "Lucknow",
                    "name_local": {"hi": "लखनऊ"},
                    "latitude": 26.8467,
                    "longitude": 80.9462,
                    "is_active": True,
                },
                state_id=state.id,
                code="UP-LKO",
            )
            block, _ = await _get_or_create(
                session,
                Block,
                {
                    "name": "Sarojini Nagar",
                    "name_local": {"hi": "सरोजिनी नगर"},
                    "latitude": 26.82,
                    "longitude": 80.9,
                    "is_active": True,
                },
                district_id=district.id,
                code="UP-LKO-SRN",
            )
            phc, _ = await _get_or_create(
                session,
                PHC,
                {
                    "name": "PHC Sarojini Nagar",
                    "contact_phone": "0522-2400000",
                    "head_officer_name": "Dr. R. P. Singh",
                    "address": "Sarojini Nagar, Lucknow",
                    "is_active": True,
                },
                block_id=block.id,
                code="UP-LKO-SRN-PHC1",
            )
            sub_center, _ = await _get_or_create(
                session,
                SubCenter,
                {
                    "name": "Sub Center Khasra",
                    "contact_phone": "0522-2400111",
                    "is_active": True,
                },
                phc_id=phc.id,
                code="UP-LKO-SRN-SC1",
            )
            village, _ = await _get_or_create(
                session,
                Village,
                {
                    "name": "Khasra",
                    "name_local": {"hi": "खसरा"},
                    "latitude": 26.815,
                    "longitude": 80.905,
                    "total_households": 420,
                    "total_population": 2100,
                    "is_active": True,
                },
                sub_center_id=sub_center.id,
                code="UP-LKO-SRN-KHS",
            )

            # ------------------------------------------------------------------
            # 2. Users: ASHA, ANM, MOIC
            # ------------------------------------------------------------------
            dev_password_hash = get_password_hash("asha@123")  # dev-only credential

            asha_user, _ = await _get_or_create(
                session,
                User,
                {
                    "role": Role.ASHA.value,
                    "state_id": state.id,
                    "district_id": district.id,
                    "block_id": block.id,
                    "phc_id": phc.id,
                    "sub_center_id": sub_center.id,
                    "village_id": village.id,
                    "employee_id": "EMP-UP-0001234",
                    "email": "sunita.asha@example.in",
                    "full_name": "Sunita Devi",
                    "full_name_local": {"hi": "सुनीता देवी"},
                    "language": "hi",
                    "hashed_password": dev_password_hash,
                    "is_active": True,
                },
                phone="9876543210",
            )
            anm_user, _ = await _get_or_create(
                session,
                User,
                {
                    "role": Role.ANM.value,
                    "state_id": state.id,
                    "district_id": district.id,
                    "block_id": block.id,
                    "phc_id": phc.id,
                    "sub_center_id": sub_center.id,
                    "employee_id": "EMP-UP-0005678",
                    "email": "anita.anm@example.in",
                    "full_name": "Anita Singh",
                    "full_name_local": {"hi": "अनीता सिंह"},
                    "language": "hi",
                    "hashed_password": dev_password_hash,
                    "is_active": True,
                },
                phone="9876543211",
            )
            moic_user, _ = await _get_or_create(
                session,
                User,
                {
                    "role": Role.MOIC.value,
                    "state_id": state.id,
                    "district_id": district.id,
                    "block_id": block.id,
                    "phc_id": phc.id,
                    "employee_id": "EMP-UP-0009012",
                    "email": "moic.sarojini@example.in",
                    "full_name": "Dr. R. P. Singh",
                    "language": "en",
                    "hashed_password": dev_password_hash,
                    "is_active": True,
                },
                phone="9876543212",
            )

            _, created = await _get_or_create(
                session,
                ASHAProfile,
                {
                    "user_id": asha_user.id,
                    "bank_account": {
                        "bank": "State Bank of India",
                        "branch": "Sarojini Nagar",
                        "ifsc": "SBIN0000123",
                        "account_no_last4": "4821",
                    },
                    "aadhaar_hash": "CHANGE_ME_AADHAAR_HASH_PLACEHOLDER",
                    "qualification": "12th Pass",
                    "experience_years": 6.5,
                    "training_status": {
                        "module1": "completed",
                        "module2": "completed",
                        "ncd_training": "pending",
                    },
                    "supervisor_id": anm_user.id,
                    "catchment_villages": [village.id],
                    "performance_score": 87.5,
                },
                asha_id="ASHA-UP-LKO-0001",
            )
            if created:
                logger.info("Created ASHA profile ASHA-UP-LKO-0001")

            # ------------------------------------------------------------------
            # 3. Household + pregnant beneficiary
            # ------------------------------------------------------------------
            household, _ = await _get_or_create(
                session,
                Household,
                {
                    "village_id": village.id,
                    "asha_id": asha_user.id,
                    "address": "House 12, Ward 4, Khasra",
                    "address_local": {"hi": "मकान १२, वार्ड ४, खसरा"},
                    "amenities": {
                        "toilet": True,
                        "electricity": True,
                        "clean_water": True,
                        "lpg_connection": True,
                    },
                    "consent_given": True,
                    "consent_date": date.today() - timedelta(days=20),
                    "consent_version": "v1",
                    "abha_consent": True,
                },
                hhid="HH-UP-LKO-0001",
            )
            pregnant_woman, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": household.id,
                    "full_name": "Rekha Sharma",
                    "full_name_local": {"hi": "रेखा शर्मा"},
                    "gender": "female",
                    "age_years": 24,
                    "age_months": 0,
                    "phone": "9876500001",
                    "marital_status": "married",
                    "blood_group": "B+",
                    "religion": "hindu",
                    "caste_category": "general",
                    "education_level": "high_school",
                    "occupation": "home_maker",
                    "is_pregnant": True,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=150),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-UP-LKO-0001",
            )

            # ------------------------------------------------------------------
            # 4. Pregnancy with 2 ANC visits
            # ------------------------------------------------------------------
            lmp = date.today() - timedelta(days=150)
            edd = lmp + timedelta(days=280)
            pregnancy, _ = await _get_or_create(
                session,
                Pregnancy,
                {
                    "lmp": lmp,
                    "edd": edd,
                    "gravida": 2,
                    "parity": 1,
                    "abortions": 0,
                    "living_children": 1,
                    "risk_level": "medium",
                    "risk_factors": {
                        "previous_c_section": False,
                        "anaemia": True,
                        "short_stature": False,
                    },
                    "risk_score": 42.5,
                    "last_anc_date": lmp + timedelta(days=120),
                    "next_anc_due": lmp + timedelta(days=150),
                    "anc_count": 2,
                    "status": "ongoing",
                },
                beneficiary_id=pregnant_woman.id,
            )

            anc1 = ANCVISIT(
                pregnancy_id=pregnancy.id,
                visit_number=1,
                visit_date=lmp + timedelta(days=84),
                bp_systolic=110,
                bp_diastolic=70,
                weight_kg=52.0,
                height_cm=155.0,
                bmi=21.6,
                temperature=98.4,
                pulse=78,
                hemoglobin=10.2,
                blood_group="B+",
                rh_factor="positive",
                urine_protein="negative",
                danger_signs={"bleeding": False, "convulsions": False},
                advice_given={"iron_folic_acid": True, "rest": True},
                pmsma_attended=False,
                recorded_by=asha_user.id,
            )
            anc2 = ANCVISIT(
                pregnancy_id=pregnancy.id,
                visit_number=2,
                visit_date=lmp + timedelta(days=120),
                bp_systolic=112,
                bp_diastolic=72,
                weight_kg=53.2,
                height_cm=155.0,
                bmi=22.1,
                temperature=98.2,
                pulse=80,
                hemoglobin=9.8,
                blood_group="B+",
                rh_factor="positive",
                urine_protein="negative",
                fundal_height_cm=16,
                fetal_heart_rate=148,
                danger_signs={"bleeding": False, "convulsions": False},
                advice_given={"iron_folic_acid": True, "tt_booster": True},
                pmsma_attended=True,
                recorded_by=anm_user.id,
            )
            session.add_all([anc1, anc2])

            # ------------------------------------------------------------------
            # 5. Child beneficiary with immunization schedule
            # ------------------------------------------------------------------
            child_beneficiary, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": household.id,
                    "full_name": "Aarav Kumar",
                    "full_name_local": {"hi": "आरव कुमार"},
                    "gender": "male",
                    "age_years": 0,
                    "age_months": 6,
                    "date_of_birth": date.today() - timedelta(days=180),
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=180),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-UP-LKO-0002",
            )
            child, created = await _get_or_create(
                session,
                Child,
                {
                    "birth_registration_no": "BR-UP-2026-000123",
                    "birth_weight_grams": 2850,
                    "birth_length_cm": 48.5,
                    "head_circumference_cm": 34.0,
                    "gestation_weeks": 38,
                    "delivery_type": "normal",
                    "place_of_birth": "PHC Sarojini Nagar",
                    "apgar_1min": 8,
                    "apgar_5min": 9,
                },
                beneficiary_id=child_beneficiary.id,
            )
            if created:
                immunization_schedule = [
                    ("BCG", "BCG", 1, date.today() - timedelta(days=178), "given"),
                    ("HEPB", "Hepatitis B - Birth Dose", 1, date.today() - timedelta(days=178), "given"),
                    ("OPV", "OPV - 0", 1, date.today() - timedelta(days=178), "given"),
                    ("PENTA", "Pentavalent - 1", 1, date.today() - timedelta(days=150), "given"),
                    ("OPV", "OPV - 1", 2, date.today() - timedelta(days=150), "given"),
                    ("PENTA", "Pentavalent - 2", 2, date.today() - timedelta(days=120), "given"),
                    ("OPV", "OPV - 2", 3, date.today() - timedelta(days=120), "given"),
                    ("PENTA", "Pentavalent - 3", 3, date.today() - timedelta(days=90), "given"),
                    ("OPV", "OPV - 3", 4, date.today() - timedelta(days=90), "given"),
                    ("MR", "Measles Rubella - 1", 1, date.today() + timedelta(days=120), "due"),
                    ("VITA", "Vitamin A - 1", 1, date.today() + timedelta(days=60), "due"),
                ]
                for vaccine_code, vaccine_name, dose_number, due_date, status in immunization_schedule:
                    session.add(
                        Immunization(
                            child_id=child.id,
                            vaccine_code=vaccine_code,
                            vaccine_name=vaccine_name,
                            dose_number=dose_number,
                            due_date=due_date,
                            status=status,
                            given_by=anm_user.id if status == "given" else None,
                            facility_id=phc.id if status == "given" else None,
                            recorded_by=asha_user.id if status == "given" else None,
                        )
                    )
                logger.info("Created immunization schedule for child %s", child_beneficiary.id)

            # ------------------------------------------------------------------
            # 6. Eligible couple
            # ------------------------------------------------------------------
            wife, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": household.id,
                    "full_name": "Manju Kumari",
                    "full_name_local": {"hi": "मंजू कुमारी"},
                    "gender": "female",
                    "age_years": 29,
                    "age_months": 0,
                    "marital_status": "married",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=300),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-UP-LKO-0003",
            )
            husband, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": household.id,
                    "full_name": "Rakesh Kumar",
                    "full_name_local": {"hi": "राकेश कुमार"},
                    "gender": "male",
                    "age_years": 32,
                    "age_months": 0,
                    "marital_status": "married",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=300),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-UP-LKO-0004",
            )
            ec, created = await _get_or_create(
                session,
                EligibleCouple,
                {
                    "husband_id": husband.id,
                    "registration_date": date.today() - timedelta(days=290),
                    "status": "active",
                    "current_method": "OCP",
                    "method_start_date": date.today() - timedelta(days=90),
                    "last_followup_date": date.today() - timedelta(days=15),
                    "next_followup_date": date.today() + timedelta(days=15),
                    "missed_period_tracked": True,
                    "pregnancy_confirmed": False,
                    "registered_by": asha_user.id,
                },
                wife_id=wife.id,
            )
            if created:
                logger.info("Created eligible couple EC for wife %s", wife.id)

            # ------------------------------------------------------------------
            # 7. NCD screening (older beneficiary)
            # ------------------------------------------------------------------
            ncd_beneficiary, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": household.id,
                    "full_name": "Kamla Devi",
                    "full_name_local": {"hi": "कमला देवी"},
                    "gender": "female",
                    "age_years": 55,
                    "age_months": 0,
                    "marital_status": "married",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=200),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-UP-LKO-0005",
            )
            session.add(
                NCDScreening(
                    beneficiary_id=ncd_beneficiary.id,
                    screening_date=date.today() - timedelta(days=7),
                    age_above_30=True,
                    tobacco_use=False,
                    alcohol_use=False,
                    physical_activity=True,
                    waist_circumference_cm=92.0,
                    family_history_diabetes=True,
                    family_history_hypertension=True,
                    family_history_cancer=False,
                    known_diabetes=False,
                    known_hypertension=True,
                    known_cancer=False,
                    bp_systolic=145,
                    bp_diastolic=95,
                    blood_sugar_random=168.0,
                    cbac_score=4,
                    diabetes_risk="medium",
                    hypertension_risk="high",
                    cardiovascular_risk="medium",
                    cancer_risk="low",
                    referral_made=True,
                    referral_type="hypertension",
                    referral_facility_id=phc.id,
                    recorded_by=asha_user.id,
                )
            )

            # ------------------------------------------------------------------
            # 8. ASHA KPIs (2 monthly periods)
            # ------------------------------------------------------------------
            today = date.today()
            current_period = today.replace(day=1)
            previous_period = (current_period - timedelta(days=1)).replace(day=1)
            for period_start in (previous_period, current_period):
                await _get_or_create(
                    session,
                    ASHAKPI,
                    {
                        "period_end": (period_start + timedelta(days=31)).replace(day=1) - timedelta(days=1),
                        "household_registered": 24,
                        "beneficiary_registered": 38,
                        "pregnancy_registered": 5,
                        "anc_visits": 12,
                        "pnc_visits": 9,
                        "institutional_deliveries": 3,
                        "home_deliveries": 1,
                        "high_risk_pregnancies_identified": 2,
                        "high_risk_pregnancies_referred": 2,
                        "deliveries_birth_preparedness": 3,
                        "live_births": 4,
                        "birth_registrations": 4,
                        "hbnc_visits": 10,
                        "hbyc_visits": 8,
                        "children_immunized_bcg": 4,
                        "children_immunized_opol": 4,
                        "children_immunized_penta": 4,
                        "children_immunized_mr": 3,
                        "children_immunized_vitamin_a": 3,
                        "full_immunization_children": 3,
                        "growth_monitoring_done": 11,
                        "sam_children_identified": 1,
                        "mam_children_identified": 2,
                        "ec_registered": 6,
                        "ec_followups": 14,
                        "contraceptives_distributed": 8,
                        "ncd_screenings": 15,
                        "ncd_positive_referred": 4,
                        "cbac_screenings": 15,
                        "fever_screenings": 6,
                        "malaria_suspects_referred": 1,
                        "tb_suspects_referred": 0,
                        "village_health_sanitation_days": 2,
                        "village_health_nutrition_days": 2,
                        "maternal_deaths_reported": 0,
                        "child_deaths_reported": 0,
                        "eligible_claims_submitted": 2,
                        "incentives_earned": 1240,
                        "sync_successful": 96,
                        "sync_failed": 3,
                        "performance_score": 87.5,
                    },
                    asha_id=asha_user.id,
                    period_start=period_start,
                    period_type="monthly",
                )

            # ------------------------------------------------------------------
            # 9. Incentive claim (current month)
            # ------------------------------------------------------------------
            await _get_or_create(
                session,
                IncentiveClaim,
                {
                    "claim_period_start": current_period,
                    "claim_period_end": (current_period + timedelta(days=31)).replace(day=1) - timedelta(days=1),
                    "activities": {
                        "anc_visits": 4,
                        "pnc_visits": 3,
                        "pregnancy_registrations": 1,
                        "immunization_sessions": 2,
                        "ncd_screenings": 5,
                    },
                    "total_amount": 640.0,
                    "status": "draft",
                },
                asha_id=asha_user.id,
                claim_month=current_period.strftime("%Y-%m"),
            )

            # ------------------------------------------------------------------
            # 10. ASHA tasks (today's work plan)
            # ------------------------------------------------------------------
            session.add_all(
                [
                    ASHATask(
                        asha_id=asha_user.id,
                        task_date=today,
                        task_type="anc_visit",
                        beneficiary_id=pregnant_woman.id,
                        household_id=household.id,
                        village_id=village.id,
                        priority="high",
                        status="pending",
                        scheduled_time=datetime.now(UTC) + timedelta(hours=2),
                        notes="ANC-3 counselling and IFA distribution",
                    ),
                    ASHATask(
                        asha_id=asha_user.id,
                        task_date=today,
                        task_type="ec_followup",
                        beneficiary_id=wife.id,
                        household_id=household.id,
                        village_id=village.id,
                        priority="medium",
                        status="pending",
                        scheduled_time=datetime.now(UTC) + timedelta(hours=5),
                    ),
                    ASHATask(
                        asha_id=asha_user.id,
                        task_date=today,
                        task_type="ncd_followup",
                        beneficiary_id=ncd_beneficiary.id,
                        household_id=household.id,
                        village_id=village.id,
                        priority="high",
                        status="pending",
                        scheduled_time=datetime.now(UTC) + timedelta(hours=7),
                        notes="Follow-up for hypertension referral to PHC",
                    ),
                ]
            )

            # ------------------------------------------------------------------
            # 11. Notifications
            # ------------------------------------------------------------------
            session.add_all(
                [
                    Notification(
                        user_id=asha_user.id,
                        type="reminder",
                        priority="high",
                        title="ANC visit due",
                        title_local={"hi": "एएनसी जाँच की सूचना"},
                        message="Rekha Sharma's 3rd ANC visit is due tomorrow.",
                        message_local={"hi": "रेखा शर्मा की तीसरी एएनसी जाँच कल होनी है।"},
                        action_url="/beneficiaries/BEN-UP-LKO-0001/pregnancy",
                        action_label="Open ANC",
                        reference_id=pregnant_woman.id,
                        reference_type="pregnancy",
                        channels=["push", "in_app"],
                        status="scheduled",
                    ),
                    Notification(
                        user_id=asha_user.id,
                        type="sync",
                        priority="low",
                        title="Offline data synced",
                        title_local={"hi": "ऑफ़लाइन डेटा समकालिक हुआ"},
                        message="All pending records were synced successfully.",
                        message_local={"hi": "सभी लंबित रिकॉर्ड सफलतापूर्वक समकालिक हो गए।"},
                        reference_id=asha_user.id,
                        reference_type="sync",
                        channels=["in_app"],
                        status="sent",
                        sent_at=datetime.now(UTC) - timedelta(minutes=10),
                        delivered_at=datetime.now(UTC) - timedelta(minutes=9),
                    ),
                    Notification(
                        user_id=anm_user.id,
                        type="task",
                        priority="medium",
                        title="New high-risk pregnancy",
                        title_local={"hi": "नई उच्च जोखिम गर्भावस्था"},
                        message="Rekha Sharma (BEN-UP-LKO-0001) flagged as medium risk. Review recommended.",
                        message_local={"hi": "रेखा शर्मा (BEN-UP-LKO-0001) मध्यम जोखिम में चिह्नित। समीक्षा अनुशंसित है।"},
                        action_url="/beneficiaries/BEN-UP-LKO-0001",
                        reference_id=pregnant_woman.id,
                        reference_type="pregnancy",
                        channels=["push", "in_app"],
                        status="scheduled",
                    ),
                ]
            )

            logger.info(
                "Seed complete: state=%s district=%s block=%s phc=%s sc=%s village=%s",
                state.code,
                district.code,
                block.code,
                phc.code,
                sub_center.code,
                village.code,
            )


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    await seed_demo()
    print("Demo data seeded successfully. Login phone: 9876543210 (password: asha@123)")


if __name__ == "__main__":
    asyncio.run(main())
