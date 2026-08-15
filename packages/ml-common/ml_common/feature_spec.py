"""Typed feature specifications for ASHA Sathi ML models.

Each dataclass mirrors the exact raw column set consumed by a trained model
(see ``apps/ml-training/src/features/engineering.py``). In addition to typing,
they:

* validate incoming payloads and report human-readable errors
* produce an ordered feature vector (with default filling) suitable for both
  joblib pipelines and ONNX sessions
* expose the ordered ``feature_names`` contract between client and model.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any, ClassVar

_BOOL_KEYS = frozenset(
    {
        "previous_csection",
        "previous_pph",
        "previous_preterm",
        "previous_stillbirth",
        "htn",
        "diabetes",
        "heart_disease",
        "kidney_disease",
        "pmsma_attended",
        "complementary_feeding",
        "immunization_complete",
        "tobacco_use",
        "alcohol_use",
        "family_history_diabetes",
        "family_history_hypertension",
        "known_diabetes",
        "known_hypertension",
    }
)


def _coerce_bool(value: Any, name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y", "t"}


def _num(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


@dataclass
class MaternalFeatures:
    """Raw features for the maternal ANC risk model (19 columns)."""

    feature_names: ClassVar[list[str]] = [
        "age",
        "gravida",
        "parity",
        "gestational_weeks",
        "bp_systolic",
        "bp_diastolic",
        "hemoglobin",
        "blood_sugar",
        "bmi",
        "previous_csection",
        "previous_pph",
        "previous_preterm",
        "previous_stillbirth",
        "htn",
        "diabetes",
        "heart_disease",
        "kidney_disease",
        "anc_visits_attended",
        "pmsma_attended",
    ]

    age: float = 25.0
    gravida: int = 1
    parity: int = 0
    gestational_weeks: float = 12.0
    bp_systolic: float = 115.0
    bp_diastolic: float = 75.0
    hemoglobin: float = 11.0
    blood_sugar: float = 100.0
    bmi: float = 23.0
    previous_csection: bool = False
    previous_pph: bool = False
    previous_preterm: bool = False
    previous_stillbirth: bool = False
    htn: bool = False
    diabetes: bool = False
    heart_disease: bool = False
    kidney_disease: bool = False
    anc_visits_attended: int = 0
    pmsma_attended: bool = False

    def validate(self) -> list[str]:
        """Return a list of human-readable validation errors (empty = OK)."""
        errors: list[str] = []
        if not 12 <= self.age <= 55:
            errors.append(f"age must be 12-55 (got {self.age})")
        if not 4 <= self.gestational_weeks <= 42:
            errors.append(f"gestational_weeks must be 4-42 (got {self.gestational_weeks})")
        if not 60 <= self.bp_systolic <= 250:
            errors.append(f"bp_systolic must be 60-250 (got {self.bp_systolic})")
        if not 40 <= self.bp_diastolic <= 150:
            errors.append(f"bp_diastolic must be 40-150 (got {self.bp_diastolic})")
        if not 2 <= self.hemoglobin <= 20:
            errors.append(f"hemoglobin must be 2-20 g/dL (got {self.hemoglobin})")
        if not 20 <= self.blood_sugar <= 600:
            errors.append(f"blood_sugar must be 20-600 (got {self.blood_sugar})")
        if not 10 <= self.bmi <= 60:
            errors.append(f"bmi must be 10-60 (got {self.bmi})")
        if not 0 <= self.gravida <= 15:
            errors.append(f"gravida must be 0-15 (got {self.gravida})")
        if not 0 <= self.parity <= 15:
            errors.append(f"parity must be 0-15 (got {self.parity})")
        return errors

    def to_feature_vector(self) -> dict[str, float]:
        """Ordered feature vector with missing/default values filled."""
        values = asdict(self)
        vector: dict[str, float] = {}
        for name in self.feature_names:
            raw = values.get(name)
            if name in _BOOL_KEYS:
                vector[name] = 1.0 if _coerce_bool(raw, name) else 0.0
            else:
                vector[name] = _num(raw, 0.0)
        return vector


@dataclass
class ChildFeatures:
    """Raw features for the child growth model (11 columns)."""

    feature_names: ClassVar[list[str]] = [
        "age_months",
        "sex",
        "weight_kg",
        "height_cm",
        "muac_mm",
        "birth_weight_kg",
        "gestation_weeks",
        "breastfeeding",
        "complementary_feeding",
        "diarrhea_episodes",
        "immunization_complete",
    ]

    age_months: float = 12.0
    sex: str = "M"
    weight_kg: float = 9.0
    height_cm: float = 74.0
    muac_mm: float = 140.0
    birth_weight_kg: float = 3.0
    gestation_weeks: float = 39.0
    breastfeeding: str = "exclusive"
    complementary_feeding: bool = False
    diarrhea_episodes: int = 0
    immunization_complete: bool = True

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not 0 <= self.age_months <= 60:
            errors.append(f"age_months must be 0-60 (got {self.age_months})")
        if self.sex.upper() not in {"M", "F"}:
            errors.append(f"sex must be M or F (got {self.sex})")
        if not 0.5 <= self.weight_kg <= 50:
            errors.append(f"weight_kg must be 0.5-50 (got {self.weight_kg})")
        if not 30 <= self.height_cm <= 150:
            errors.append(f"height_cm must be 30-150 (got {self.height_cm})")
        if not 60 <= self.muac_mm <= 300:
            errors.append(f"muac_mm must be 60-300 (got {self.muac_mm})")
        if not 20 <= self.gestation_weeks <= 44:
            errors.append(f"gestation_weeks must be 20-44 (got {self.gestation_weeks})")
        if self.breastfeeding not in {"exclusive", "mixed", "none"}:
            errors.append(f"breastfeeding must be exclusive/mixed/none (got {self.breastfeeding})")
        return errors

    def to_feature_vector(self) -> dict[str, float]:
        values = asdict(self)
        vector: dict[str, float] = {}
        for name in self.feature_names:
            raw = values.get(name)
            if name == "sex":
                vector[name] = 0.0 if str(raw).upper() == "M" else 1.0
            elif name == "breastfeeding":
                vector[name] = float({"exclusive": 0.0, "mixed": 1.0, "none": 2.0}.get(str(raw), 0.0))
            elif name in _BOOL_KEYS:
                vector[name] = 1.0 if _coerce_bool(raw, name) else 0.0
            else:
                vector[name] = _num(raw, 0.0)
        return vector

    def compute_z_scores(self) -> dict[str, float | None]:
        """Approximate WHO z-scores (WAZ via embedded LMS tables, HAZ approx)."""
        return _compute_child_z_scores(self.age_months, self.sex, self.weight_kg, self.height_cm)


@dataclass
class NCDFeatures:
    """Raw features for the NCD screening model (14 columns)."""

    feature_names: ClassVar[list[str]] = [
        "age",
        "sex",
        "bmi",
        "waist_cm",
        "tobacco_use",
        "alcohol_use",
        "physical_activity",
        "family_history_diabetes",
        "family_history_hypertension",
        "known_diabetes",
        "known_hypertension",
        "bp_systolic",
        "bp_diastolic",
        "blood_sugar_random",
    ]

    age: float = 40.0
    sex: str = "M"
    bmi: float = 24.0
    waist_cm: float = 85.0
    tobacco_use: bool = False
    alcohol_use: bool = False
    physical_activity: str = "moderate"
    family_history_diabetes: bool = False
    family_history_hypertension: bool = False
    known_diabetes: bool = False
    known_hypertension: bool = False
    bp_systolic: float = 120.0
    bp_diastolic: float = 78.0
    blood_sugar_random: float = 105.0

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not 10 <= self.age <= 120:
            errors.append(f"age must be 10-120 (got {self.age})")
        if self.sex.upper() not in {"M", "F"}:
            errors.append(f"sex must be M or F (got {self.sex})")
        if not 10 <= self.bmi <= 60:
            errors.append(f"bmi must be 10-60 (got {self.bmi})")
        if not 40 <= self.waist_cm <= 200:
            errors.append(f"waist_cm must be 40-200 (got {self.waist_cm})")
        if self.physical_activity not in {"low", "moderate", "high"}:
            errors.append(
                f"physical_activity must be low/moderate/high (got {self.physical_activity})"
            )
        if not 60 <= self.bp_systolic <= 250:
            errors.append(f"bp_systolic must be 60-250 (got {self.bp_systolic})")
        if not 40 <= self.bp_diastolic <= 150:
            errors.append(f"bp_diastolic must be 40-150 (got {self.bp_diastolic})")
        if not 20 <= self.blood_sugar_random <= 700:
            errors.append(
                f"blood_sugar_random must be 20-700 (got {self.blood_sugar_random})"
            )
        return errors

    def to_feature_vector(self) -> dict[str, float]:
        values = asdict(self)
        vector: dict[str, float] = {}
        for name in self.feature_names:
            raw = values.get(name)
            if name == "sex":
                vector[name] = 0.0 if str(raw).upper() == "M" else 1.0
            elif name == "physical_activity":
                vector[name] = float(
                    {"low": 0.0, "moderate": 1.0, "high": 2.0}.get(str(raw), 1.0)
                )
            elif name in _BOOL_KEYS:
                vector[name] = 1.0 if _coerce_bool(raw, name) else 0.0
            else:
                vector[name] = _num(raw, 0.0)
        return vector


# ---------------------------------------------------------------------------
# Compact WHO reference constants used by ChildFeatures.compute_z_scores().
# ---------------------------------------------------------------------------

_WAZ_BOYS = {
    0.0: (0.3487, 3.3464, 0.14602), 6.0: (0.1325, 7.9340, 0.10772),
    12.0: (0.1242, 9.7230, 0.10622), 24.0: (0.1351, 12.2715, 0.10729),
    36.0: (0.0946, 14.2943, 0.11163), 48.0: (0.0288, 16.2098, 0.12064),
    60.0: (-0.0442, 18.2004, 0.13000),
}
_WAZ_GIRLS = {
    0.0: (0.3809, 3.2322, 0.14171), 6.0: (-0.0321, 7.2964, 0.12204),
    12.0: (-0.0513, 8.9793, 0.12460), 24.0: (-0.0214, 11.6191, 0.12965),
    36.0: (0.0450, 13.6500, 0.13398), 48.0: (0.1647, 15.5123, 0.14068),
    60.0: (0.2862, 17.4430, 0.14667),
}
_HAZ_BOYS = {
    0.0: (49.9, 1.9), 6.0: (67.6, 2.3), 12.0: (75.7, 2.5),
    24.0: (87.1, 3.2), 36.0: (96.1, 3.8), 48.0: (103.3, 4.2), 60.0: (110.0, 4.5),
}
_HAZ_GIRLS = {
    0.0: (49.1, 1.9), 6.0: (65.7, 2.3), 12.0: (74.0, 2.5),
    24.0: (85.7, 3.2), 36.0: (95.1, 3.8), 48.0: (102.7, 4.2), 60.0: (109.4, 4.5),
}


def _interp(table: dict[float, tuple[float, ...]], x: float) -> tuple[float, ...]:
    anchors = sorted(table.items())
    if x <= anchors[0][0]:
        return anchors[0][1]
    if x >= anchors[-1][0]:
        return anchors[-1][1]
    for (a0, v0), (a1, v1) in zip(anchors, anchors[1:]):
        if a0 <= x <= a1:
            t = (x - a0) / (a1 - a0)
            return tuple(v0[i] + (v1[i] - v0[i]) * t for i in range(len(v0)))
    return anchors[-1][1]


def _z_from_lms(value: float, l: float, m: float, s: float) -> float | None:
    if m <= 0 or s <= 0 or value <= 0:
        return None
    if abs(l) < 1e-9:
        return math.log(value / m) / s
    return ((value / m) ** l - 1.0) / (l * s)


def _compute_child_z_scores(
    age_months: float, sex: str, weight: float, height: float
) -> dict[str, float | None]:
    sex_norm = sex.upper()
    if sex_norm not in {"M", "F"} or not 0 <= age_months <= 60:
        return {"waz": None, "haz": None, "whz": None}

    waz_table = _WAZ_BOYS if sex_norm == "M" else _WAZ_GIRLS
    haz_table = _HAZ_BOYS if sex_norm == "M" else _HAZ_GIRLS

    waz = _z_from_lms(weight, *_interp(waz_table, age_months)) if weight and weight > 0 else None
    haz = None
    if height and height > 0:
        m, s = _interp(haz_table, age_months)
        haz = _z_from_lms(height, 1.0, m, s)

    whz = None  # requires height-specific tables; left to the serving model.
    return {"waz": waz, "haz": haz, "whz": whz}
