"""Demo data seeder for ASHA Sathi - Creates 4 households with 4 patients each.

Run from the backend directory:
    python -m app.seed_households
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select

from app.core.database import async_session_maker
from app.core.security import get_password_hash
from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.beneficiary import Beneficiary, Household
from app.models.child import Child, GrowthRecord, Immunization
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


async def seed_households_4x4() -> None:
    """Create 4 households with 4 patients each - logical family structures."""
    async with async_session_maker() as session:
        async with session.begin():
            # ------------------------------------------------------------------
            # 1. Geography hierarchy (Uttar Pradesh - Lucknow)
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
            # 2. Users: ASHA, Admin
            # ------------------------------------------------------------------
            dev_password_hash = get_password_hash("asha@123")

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
            admin_user, _ = await _get_or_create(
                session,
                User,
                {
                    "role": Role.ADMIN.value,
                    "state_id": state.id,
                    "district_id": district.id,
                    "block_id": block.id,
                    "phc_id": phc.id,
                    "employee_id": "EMP-UP-0050001",
                    "email": "admin@example.in",
                    "full_name": "System Admin",
                    "language": "en",
                    "hashed_password": dev_password_hash,
                    "is_active": True,
                },
                phone="9876543215",
            )
            await _get_or_create(
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
                    "supervisor_id": admin_user.id,
                    "catchment_villages": [village.id],
                    "performance_score": 87.5,
                },
                asha_id="ASHA-UP-LKO-0001",
            )

            # ------------------------------------------------------------------
            # 3. Create 4 households with 4 patients each (logical families)
            # ------------------------------------------------------------------
            
            # Household 1: Young nuclear family (parents + 2 children)
            hh1, _ = await _get_or_create(
                session,
                Household,
                {
                    "village_id": village.id,
                    "asha_id": asha_user.id,
                    "address": "House 10, Ward 2, Khasra",
                    "address_local": {"hi": "मकान १०, वार्ड २, खसरा"},
                    "amenities": {"toilet": True, "electricity": True, "clean_water": True, "lpg_connection": True},
                    "consent_given": True,
                    "consent_date": date.today() - timedelta(days=60),
                    "consent_version": "v1",
                    "abha_consent": True,
                },
                hhid="HH-KHS-0001",
            )
            
            # HH1 - Father (35, male)
            father1, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": hh1.id,
                    "full_name": "Rajesh Kumar",
                    "full_name_local": {"hi": "राजेश कुमार"},
                    "gender": "male",
                    "age_years": 35,
                    "age_months": 0,
                    "phone": "9876500001",
                    "marital_status": "married",
                    "blood_group": "O+",
                    "religion": "hindu",
                    "caste_category": "obc",
                    "education_level": "high_school",
                    "occupation": "farmer",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=365),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-KHS-0001",
            )
            
            # HH1 - Mother (30, female) - pregnant
            mother1, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": hh1.id,
                    "full_name": "Priya Devi",
                    "full_name_local": {"hi": "प्रिया देवी"},
                    "gender": "female",
                    "age_years": 30,
                    "age_months": 0,
                    "phone": "9876500002",
                    "marital_status": "married",
                    "blood_group": "A+",
                    "religion": "hindu",
                    "caste_category": "obc",
                    "education_level": "high_school",
                    "occupation": "home_maker",
                    "is_pregnant": True,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=365),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-KHS-0002",
            )
            
            # HH1 - Child 1 (7, male)
            child1_1, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": hh1.id,
                    "full_name": "Aarav Kumar",
                    "full_name_local": {"hi": "आरव कुमार"},
                    "gender": "male",
                    "age_years": 7,
                    "age_months": 0,
                    "date_of_birth": date.today() - timedelta(days=2555),
                    "marital_status": "never_married",
                    "blood_group": "O+",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=365),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-KHS-0003",
            )
            
            # HH1 - Child 2 (4, female)
            child1_2, _ = await _get_or_create(
                session,
                Beneficiary,
                {
                    "household_id": hh1.id,
                    "full_name": "Ananya Kumari",
                    "full_name_local": {"hi": "अनन्या कुमारी"},
                    "gender": "female",
                    "age_years": 4,
                    "age_months": 0,
                    "date_of_birth": date.today() - timedelta(days=1460),
                    "marital_status": "never_married",
                    "blood_group": "A+",
                    "is_pregnant": False,
                    "is_lactating": False,
                    "registration_date": date.today() - timedelta(days=365),
                    "registered_by": asha_user.id,
                    "status": "active",
                },
                beneficiary_id="BEN-KHS-0004",
            )

            # Pregnancy for mother1
            lmp = date.today() - timedelta(days=120)
            edd = lmp + timedelta(days=280)
            pregnancy1, _ = await _get_or_create(
                session,
                Pregnancy,
                {
                    "lmp": lmp,
                    "edd": edd,
                    "gravida": 3,
                    "parity": 2,
                    "abortions": 0,
                    "living_children": 2,
                    "risk_level": "low",
                    "risk_factors": {},
                    "risk_score": 15.0,
                    "last_anc_date": lmp + timedelta(days=84),
                    "next_anc_due": lmp + timedelta(days=150),
                    "anc_count": 2,
                    "status": "ongoing",
                },
                beneficiary_id=mother1.id,
            )

            # ANC visits
            anc1 = ANCVISIT(pregnancy_id=pregnancy1.id, visit_number=1, visit_date=lmp + timedelta(days=84), 
                           bp_systolic=110, bp_diastolic=70, weight_kg=55, height_cm=158, 
                           hemoglobin=11.2, recorded_by=asha_user.id)
            anc2 = ANCVISIT(pregnancy_id=pregnancy1.id, visit_number=2, visit_date=lmp + timedelta(days=120),
                           bp_systolic=112, bp_diastolic=72, weight_kg=57, height_cm=158,
                           hemoglobin=10.8, recorded_by=asha_user.id)
            session.add_all([anc1, anc2])

            # Child 1 immunization
            child1_child, _ = await _get_or_create(
                session, Child,
                {"birth_registration_no": "BR-UP-2017-000123", "birth_weight_grams": 3100,
                 "birth_length_cm": 50, "head_circumference_cm": 35,
                 "gestation_weeks": 39, "delivery_type": "normal",
                 "place_of_birth": "PHC Sarojini Nagar", "apgar_1min": 9, "apgar_5min": 10},
                beneficiary_id=child1_1.id,
            )
            for vc, vn, dn, dd, st in [
                ("BCG", "BCG", 1, date.today() - timedelta(days=2500), "given"),
                ("HEPB", "Hepatitis B - Birth Dose", 1, date.today() - timedelta(days=2500), "given"),
                ("PENTA", "Pentavalent - 1", 1, date.today() - timedelta(days=2400), "given"),
                ("OPV", "OPV - 1", 1, date.today() - timedelta(days=2400), "given"),
                ("PENTA", "Pentavalent - 2", 2, date.today() - timedelta(days=2300), "given"),
                ("OPV", "OPV - 2", 2, date.today() - timedelta(days=2300), "given"),
                ("PENTA", "Pentavalent - 3", 3, date.today() - timedelta(days=2200), "given"),
                ("OPV", "OPV - 3", 3, date.today() - timedelta(days=2200), "given"),
                ("MR", "Measles Rubella - 1", 1, date.today() - timedelta(days=1800), "given"),
            ]:
                session.add(Immunization(child_id=child1_child.id, vaccine_code=vc, vaccine_name=vn,
                                       dose_number=dn, due_date=dd, status=st,
                                       given_by=admin_user.id, facility_id=phc.id,
                                       recorded_by=asha_user.id))

            # Child 2 immunization
            child2_child, _ = await _get_or_create(
                session, Child,
                {"birth_registration_no": "BR-UP-2020-000456", "birth_weight_grams": 2900,
                 "birth_length_cm": 49, "head_circumference_cm": 34,
                 "gestation_weeks": 38, "delivery_type": "normal",
                 "place_of_birth": "PHC Sarojini Nagar", "apgar_1min": 8, "apgar_5min": 9},
                beneficiary_id=child1_2.id,
            )
            for vc, vn, dn, dd, st in [
                ("BCG", "BCG", 1, date.today() - timedelta(days=1400), "given"),
                ("HEPB", "Hepatitis B - Birth Dose", 1, date.today() - timedelta(days=1400), "given"),
                ("PENTA", "Pentavalent - 1", 1, date.today() - timedelta(days=1300), "given"),
                ("OPV", "OPV - 1", 1, date.today() - timedelta(days=1300), "given"),
                ("PENTA", "Pentavalent - 2", 2, date.today() - timedelta(days=1200), "given"),
                ("OPV", "OPV - 2", 2, date.today() - timedelta(days=1200), "given"),
            ]:
                session.add(Immunization(child_id=child2_child.id, vaccine_code=vc, vaccine_name=vn,
                                       dose_number=dn, due_date=dd, status=st,
                                       given_by=admin_user.id, facility_id=phc.id,
                                       recorded_by=asha_user.id))

            # Growth records for both children
            for child_rec, child_b in [(child1_child, child1_1), (child2_child, child1_2)]:
                for months, wt, ht, muac, z_wfa, z_hfa in [
                    (1, 3.5, 51, 115, -1.0, -0.8),
                    (2, 4.3, 54, 122, -0.8, -0.6),
                    (3, 5.2, 58, 129, -0.6, -0.4),
                    (4, 6.0, 61, 135, -0.4, -0.3),
                    (5, 6.7, 64, 140, -0.3, -0.2),
                    (6, 7.3, 66, 143, -0.2, -0.1),
                ]:
                    session.add(GrowthRecord(
                        child_id=child_rec.id,
                        record_date=date.today() - timedelta(days=180 - months * 30),
                        weight_kg=wt, height_cm=ht, muac_mm=muac,
                        z_score_wfa=z_wfa, z_score_hfa=z_hfa,
                        nutrition_status="normal", recorded_by=asha_user.id,
                    ))

            # ------------------------------------------------------------------
            # Household 2: Elderly couple + daughter + grandchild (3 generations)
            # ------------------------------------------------------------------
            hh2, _ = await _get_or_create(
                session,
                Household,
                {"village_id": village.id, "asha_id": asha_user.id,
                 "address": "House 25, Ward 5, Khasra",
                 "address_local": {"hi": "मकान २५, वार्ड ५, खसरा"},
                 "amenities": {"toilet": True, "electricity": True, "clean_water": True, "lpg_connection": False},
                 "consent_given": True, "consent_date": date.today() - timedelta(days=30),
                 "consent_version": "v1", "abha_consent": True},
                hhid="HH-KHS-0002",
            )
            
            # Grandfather (70, male) - NCD patient
            gf, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh2.id, "full_name": "Ram Prasad",
                 "full_name_local": {"hi": "राम प्रसाद"}, "gender": "male",
                 "age_years": 70, "phone": "9876500011", "marital_status": "married",
                 "blood_group": "B+", "religion": "hindu", "caste_category": "sc",
                 "education_level": "primary", "occupation": "retired",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=200),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0005",
            )
            
            # Grandmother (65, female)
            gm, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh2.id, "full_name": "Savitri Devi",
                 "full_name_local": {"hi": "सावित्री देवी"}, "gender": "female",
                 "age_years": 65, "phone": "9876500012", "marital_status": "married",
                 "blood_group": "AB+", "religion": "hindu", "caste_category": "sc",
                 "education_level": "illiterate", "occupation": "home_maker",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=200),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0006",
            )
            
            # Daughter (40, female) - lactating
            daughter, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh2.id, "full_name": "Meera Devi",
                 "full_name_local": {"hi": "मीरा देवी"}, "gender": "female",
                 "age_years": 40, "phone": "9876500013", "marital_status": "married",
                 "blood_group": "B+", "religion": "hindu", "caste_category": "sc",
                 "education_level": "middle", "occupation": "home_maker",
                 "is_pregnant": False, "is_lactating": True,
                 "registration_date": date.today() - timedelta(days=200),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0007",
            )
            
            # Grandchild (8 months, male)
            grandchild, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh2.id, "full_name": "Rohan Kumar",
                 "full_name_local": {"hi": "रोहन कुमार"}, "gender": "male",
                 "age_years": 0, "age_months": 8,
                 "date_of_birth": date.today() - timedelta(days=240),
                 "marital_status": "never_married", "blood_group": "O+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=120),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0008",
            )
            
            # NCD for grandfather
            session.add(NCDScreening(
                beneficiary_id=gf.id, screening_date=date.today() - timedelta(days=30),
                age_above_30=True, tobacco_use=True, alcohol_use=False, physical_activity=False,
                waist_circumference_cm=102, family_history_diabetes=True, family_history_hypertension=True,
                known_diabetes=False, known_hypertension=True, known_cancer=False,
                bp_systolic=155, bp_diastolic=98, blood_sugar_random=180,
                diabetes_risk="high", hypertension_risk="high", cardiovascular_risk="high", cancer_risk="low",
                referral_made=True, referral_type="hypertension", referral_facility_id=phc.id,
                recorded_by=asha_user.id,
            ))

            # Grandchild immunization
            gc_child, _ = await _get_or_create(
                session, Child,
                {"birth_registration_no": "BR-UP-2025-000789", "birth_weight_grams": 3000,
                 "birth_length_cm": 50, "head_circumference_cm": 34,
                 "gestation_weeks": 38, "delivery_type": "normal",
                 "place_of_birth": "PHC Sarojini Nagar", "apgar_1min": 9, "apgar_5min": 10},
                beneficiary_id=grandchild.id,
            )
            for vc, vn, dn, dd, st in [
                ("BCG", "BCG", 1, date.today() - timedelta(days=230), "given"),
                ("HEPB", "Hepatitis B - Birth Dose", 1, date.today() - timedelta(days=230), "given"),
                ("PENTA", "Pentavalent - 1", 1, date.today() - timedelta(days=200), "given"),
                ("OPV", "OPV - 1", 1, date.today() - timedelta(days=200), "given"),
                ("PENTA", "Pentavalent - 2", 2, date.today() - timedelta(days=170), "given"),
                ("OPV", "OPV - 2", 2, date.today() - timedelta(days=170), "given"),
            ]:
                session.add(Immunization(child_id=gc_child.id, vaccine_code=vc, vaccine_name=vn,
                                       dose_number=dn, due_date=dd, status=st,
                                       given_by=admin_user.id, facility_id=phc.id,
                                       recorded_by=asha_user.id))

            # ------------------------------------------------------------------
            # Household 3: Young couple with twin infants
            # ------------------------------------------------------------------
            hh3, _ = await _get_or_create(
                session,
                Household,
                {"village_id": village.id, "asha_id": asha_user.id,
                 "address": "House 42, Ward 3, Khasra",
                 "address_local": {"hi": "मकान ४२, वार्ड ३, खसरा"},
                 "amenities": {"toilet": True, "electricity": True, "clean_water": True, "lpg_connection": True},
                 "consent_given": True, "consent_date": date.today() - timedelta(days=15),
                 "consent_version": "v1", "abha_consent": True},
                hhid="HH-KHS-0003",
            )
            
            father3, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh3.id, "full_name": "Amit Singh",
                 "full_name_local": {"hi": "अमित सिंह"}, "gender": "male",
                 "age_years": 28, "phone": "9876500021", "marital_status": "married",
                 "blood_group": "A+", "religion": "hindu", "caste_category": "general",
                 "education_level": "graduate", "occupation": "teacher",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=180),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0009",
            )
            
            mother3, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh3.id, "full_name": "Neha Singh",
                 "full_name_local": {"hi": "नेहा सिंह"}, "gender": "female",
                 "age_years": 26, "phone": "9876500022", "marital_status": "married",
                 "blood_group": "O-", "religion": "hindu", "caste_category": "general",
                 "education_level": "graduate", "occupation": "teacher",
                 "is_pregnant": False, "is_lactating": True,
                 "registration_date": date.today() - timedelta(days=180),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0010",
            )
            
            # Twin 1 (3 months, female)
            twin1, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh3.id, "full_name": "Aaradhya Singh",
                 "full_name_local": {"hi": "आराध्या सिंह"}, "gender": "female",
                 "age_years": 0, "age_months": 3,
                 "date_of_birth": date.today() - timedelta(days=90),
                 "marital_status": "never_married", "blood_group": "A+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=60),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0011",
            )
            
            # Twin 2 (3 months, male)
            twin2, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh3.id, "full_name": "Arnav Singh",
                 "full_name_local": {"hi": "अर्नव सिंह"}, "gender": "male",
                 "age_years": 0, "age_months": 3,
                 "date_of_birth": date.today() - timedelta(days=90),
                 "marital_status": "never_married", "blood_group": "O+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=60),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0012",
            )
            
            # Twins immunization
            for twin_rec, twin_b in [("Aaradhya Singh", twin1), ("Arnav Singh", twin2)]:
                t_child, _ = await _get_or_create(
                    session, Child,
                    {"birth_registration_no": f"BR-UP-2025-{twin_b.beneficiary_id[-3:]}",
                     "birth_weight_grams": 2600, "birth_length_cm": 47,
                     "head_circumference_cm": 33, "gestation_weeks": 36,
                     "delivery_type": "c_section", "place_of_birth": "District Hospital Lucknow",
                     "apgar_1min": 8, "apgar_5min": 9},
                    beneficiary_id=twin_b.id,
                )
                for vc, vn, dn, dd, st in [
                    ("BCG", "BCG", 1, date.today() - timedelta(days=80), "given"),
                    ("HEPB", "Hepatitis B - Birth Dose", 1, date.today() - timedelta(days=80), "given"),
                    ("PENTA", "Pentavalent - 1", 1, date.today() - timedelta(days=50), "due"),
                ]:
                    session.add(Immunization(child_id=t_child.id, vaccine_code=vc, vaccine_name=vn,
                                           dose_number=dn, due_date=dd, status=st,
                                           given_by=admin_user.id if st == "given" else None,
                                           facility_id=phc.id if st == "given" else None,
                                           recorded_by=asha_user.id if st == "given" else None))

            # ------------------------------------------------------------------
            # Household 4: Single mother with 3 children (different ages)
            # ------------------------------------------------------------------
            hh4, _ = await _get_or_create(
                session,
                Household,
                {"village_id": village.id, "asha_id": asha_user.id,
                 "address": "House 8, Ward 1, Khasra",
                 "address_local": {"hi": "मकान ८, वार्ड १, खसरा"},
                 "amenities": {"toilet": True, "electricity": True, "clean_water": True, "lpg_connection": False},
                 "consent_given": True, "consent_date": date.today() - timedelta(days=10),
                 "consent_version": "v1", "abha_consent": True},
                hhid="HH-KHS-0004",
            )
            
            # Mother (38, female) - widowed
            mother4, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh4.id, "full_name": "Sunita Devi",
                 "full_name_local": {"hi": "सुनीता देवी"}, "gender": "female",
                 "age_years": 38, "phone": "9876500031", "marital_status": "widowed",
                 "blood_group": "A-", "religion": "hindu", "caste_category": "obc",
                 "education_level": "middle", "occupation": "tailor",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=100),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0013",
            )
            
            # Child 1 (15, male)
            ch1, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh4.id, "full_name": "Vikash Kumar",
                 "full_name_local": {"hi": "विकाश कुमार"}, "gender": "male",
                 "age_years": 15, "age_months": 0,
                 "date_of_birth": date.today() - timedelta(days=5475),
                 "marital_status": "never_married", "blood_group": "B+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=100),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0014",
            )
            
            # Child 2 (10, female)
            ch2, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh4.id, "full_name": "Riya Kumari",
                 "full_name_local": {"hi": "रिया कुमारी"}, "gender": "female",
                 "age_years": 10, "age_months": 0,
                 "date_of_birth": date.today() - timedelta(days=3650),
                 "marital_status": "never_married", "blood_group": "A+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=100),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0015",
            )
            
            # Child 3 (5, male)
            ch3, _ = await _get_or_create(
                session, Beneficiary,
                {"household_id": hh4.id, "full_name": "Chotu Kumar",
                 "full_name_local": {"hi": "छोटू कुमार"}, "gender": "male",
                 "age_years": 5, "age_months": 0,
                 "date_of_birth": date.today() - timedelta(days=1825),
                 "marital_status": "never_married", "blood_group": "O+",
                 "is_pregnant": False, "is_lactating": False,
                 "registration_date": date.today() - timedelta(days=100),
                 "registered_by": asha_user.id, "status": "active"},
                beneficiary_id="BEN-KHS-0016",
            )
            
            # Growth records for the 5-year-old
            ch3_child, _ = await _get_or_create(
                session, Child,
                {"birth_registration_no": "BR-UP-2020-001600", "birth_weight_grams": 2800,
                 "birth_length_cm": 48, "head_circumference_cm": 34,
                 "gestation_weeks": 38, "delivery_type": "normal",
                 "place_of_birth": "PHC Sarojini Nagar", "apgar_1min": 9, "apgar_5min": 10},
                beneficiary_id=ch3.id,
            )
            for months, wt, ht, muac, z_wfa, z_hfa in [
                (1, 3.4, 50, 114, -1.1, -0.9),
                (2, 4.2, 54, 121, -0.9, -0.7),
                (3, 5.0, 57, 128, -0.7, -0.5),
                (4, 5.8, 61, 134, -0.5, -0.3),
                (5, 6.5, 64, 139, -0.3, -0.2),
                (6, 7.1, 66, 142, -0.2, -0.1),
                (12, 9.0, 74, 148, -0.1, 0.0),
                (18, 10.5, 80, 152, 0.0, 0.1),
                (24, 11.8, 85, 155, 0.1, 0.2),
                (36, 13.8, 94, 158, 0.2, 0.3),
                (48, 15.5, 102, 160, 0.3, 0.4),
                (60, 17.0, 108, 162, 0.4, 0.5),
            ]:
                session.add(GrowthRecord(
                    child_id=ch3_child.id,
                    record_date=date.today() - timedelta(days=1825 - months * 30),
                    weight_kg=wt, height_cm=ht, muac_mm=muac,
                    z_score_wfa=z_wfa, z_score_hfa=z_hfa,
                    nutrition_status="normal", recorded_by=asha_user.id,
                ))

            logger.info("Created 4 households with 4 patients each (16 total beneficiaries)")

            # ------------------------------------------------------------------
            # 4. ASHA KPIs (2 monthly periods)
            # ------------------------------------------------------------------
            today = date.today()
            current_period = today.replace(day=1)
            previous_period = (current_period - timedelta(days=1)).replace(day=1)
            for period_start in (previous_period, current_period):
                await _get_or_create(
                    session, ASHAKPI,
                    {"period_end": (period_start + timedelta(days=31)).replace(day=1) - timedelta(days=1),
                     "household_registered": 4, "beneficiary_registered": 16,
                     "pregnancy_registered": 1, "anc_visits": 4,
                     "pnc_visits": 2, "institutional_deliveries": 1,
                     "home_deliveries": 0, "high_risk_pregnancies_identified": 0,
                     "high_risk_pregnancies_referred": 0, "deliveries_birth_preparedness": 1,
                     "live_births": 1, "birth_registrations": 1,
                     "hbnc_visits": 3, "hbyc_visits": 2,
                     "children_immunized_bcg": 4, "children_immunized_opol": 4,
                     "children_immunized_penta": 4, "children_immunized_mr": 1,
                     "children_immunized_vitamin_a": 1, "full_immunization_children": 1,
                     "growth_monitoring_done": 4, "sam_children_identified": 0,
                     "mam_children_identified": 0, "ec_registered": 1,
                     "ec_followups": 2, "contraceptives_distributed": 2,
                     "ncd_screenings": 2, "ncd_positive_referred": 1,
                     "cbac_screenings": 2, "fever_screenings": 2,
                     "malaria_suspects_referred": 0, "tb_suspects_referred": 0,
                     "village_health_sanitation_days": 1, "village_health_nutrition_days": 1,
                     "maternal_deaths_reported": 0, "child_deaths_reported": 0,
                     "eligible_claims_submitted": 1, "incentives_earned": 320,
                     "sync_successful": 98, "sync_failed": 1, "performance_score": 92.0},
                    asha_id=asha_user.id, period_start=period_start, period_type="monthly",
                )

            # ------------------------------------------------------------------
            # 5. ASHA tasks for today
            # ------------------------------------------------------------------
            session.add_all([
                ASHATask(asha_id=asha_user.id, task_date=today, task_type="anc_visit",
                         beneficiary_id=mother1.id, household_id=hh1.id, village_id=village.id,
                         priority="high", status="pending", notes="ANC-3 counselling"),
                ASHATask(asha_id=asha_user.id, task_date=today, task_type="hbnc_visit",
                         beneficiary_id=grandchild.id, household_id=hh2.id, village_id=village.id,
                         priority="high", status="pending", notes="HBNC visit for 8-month-old"),
                ASHATask(asha_id=asha_user.id, task_date=today, task_type="immunization",
                         beneficiary_id=twin1.id, household_id=hh3.id, village_id=village.id,
                         priority="medium", status="pending", notes="Pentavalent-1 due for twins"),
                ASHATask(asha_id=asha_user.id, task_date=today, task_type="growth_monitoring",
                         beneficiary_id=ch3.id, household_id=hh4.id, village_id=village.id,
                         priority="medium", status="pending", notes="60-month growth check"),
            ])

            logger.info("Seed complete: 4 households × 4 patients = 16 beneficiaries")


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    await seed_households_4x4()
    print("4×4 households seeded successfully (4 households × 4 patients = 16 beneficiaries)")


if __name__ == "__main__":
    asyncio.run(main())