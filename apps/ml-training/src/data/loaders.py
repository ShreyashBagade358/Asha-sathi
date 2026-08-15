"""Data loading and synthetic dataset generation.

Loaders read CSV or Parquet files and return pandas DataFrames. Synthetic
generators produce realistic, rule-based rows so the pipeline (and its tests)
can run end-to-end before production data lands in ``data/raw/``.

The rule sets mirror the clinical definitions used by ASHA Sathi:

* Maternal risk: high when a severe factor is present (BP >= 140/90, Hb < 8,
  prior stillbirth, major comorbidity), medium when any mild factor is present.
* Child nutrition: SAM/MAM thresholds follow WHO cut-offs (WAZ/WHZ < -3/-2 and
  MUAC < 115/125 mm).
* NCD: diabetes/hypertension rules based on blood sugar, BP and risk factors.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from src.models.child_growth.predict import who_lms

MATERNAL_COLUMNS = [
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
    "risk_level",
]

CHILD_COLUMNS = [
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
    "nutrition_status",
]

NCD_COLUMNS = [
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
    "diabetes_risk",
    "hypertension_risk",
]


def load_maternal_dataset(path: str | Path) -> pd.DataFrame:
    """Load the maternal ANC dataset from CSV or Parquet."""
    return _load_table(path)


def load_child_dataset(path: str | Path) -> pd.DataFrame:
    """Load the child growth dataset from CSV or Parquet."""
    return _load_table(path)


def load_ncd_dataset(path: str | Path) -> pd.DataFrame:
    """Load the NCD screening dataset from CSV or Parquet."""
    return _load_table(path)


def _load_table(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    if path.suffix.lower() in (".parquet", ".pq"):
        return pd.read_parquet(path)
    if path.suffix.lower() in (".csv", ".tsv"):
        return pd.read_csv(path, sep="\t" if path.suffix == ".tsv" else ",")
    raise ValueError(f"Unsupported dataset format: {path.suffix}")


# ---------------------------------------------------------------------------
# Synthetic generators
# ---------------------------------------------------------------------------


def _rule_maternal_risk(row: pd.Series) -> str:
    """Clinical rule used to label synthetic ANC rows."""
    if (
        row["bp_systolic"] >= 140
        or row["bp_diastolic"] >= 90
        or row["hemoglobin"] < 8
        or bool(row["previous_stillbirth"])
        or bool(row["kidney_disease"])
        or bool(row["heart_disease"])
        or (row["gestational_weeks"] >= 37 and (row["htn"] or row["diabetes"]))
    ):
        return "high"
    if (
        row["htn"]
        or row["diabetes"]
        or row["previous_csection"]
        or row["previous_pph"]
        or row["previous_preterm"]
        or row["bp_systolic"] >= 130
        or row["bp_diastolic"] >= 85
        or row["hemoglobin"] < 10.5
        or row["blood_sugar"] > 140
        or row["bmi"] >= 30
        or row["age"] >= 35
        or row["age"] <= 18
        or row["gravida"] >= 4
    ):
        return "medium"
    return "low"


def generate_synthetic_maternal(n: int = 5000, seed: Optional[int] = 42) -> pd.DataFrame:
    """Generate ``n`` realistic ANC registration rows with risk labels."""
    rng = np.random.default_rng(seed)
    n_missing = int(n * 0.03)

    df = pd.DataFrame(
        {
            "age": rng.integers(18, 40, n),
            "gravida": rng.integers(1, 6, n),
            "parity": rng.integers(0, 5, n),
            "gestational_weeks": rng.integers(8, 41, n),
            "bp_systolic": rng.normal(115, 12, n).clip(90, 175),
            "bp_diastolic": rng.normal(75, 10, n).clip(55, 115),
            "hemoglobin": rng.normal(11.0, 1.6, n).clip(5.0, 15.5),
            "blood_sugar": rng.normal(105, 22, n).clip(70, 280),
            "bmi": rng.normal(23, 4.0, n).clip(15, 38),
            "previous_csection": rng.random(n) < 0.12,
            "previous_pph": rng.random(n) < 0.06,
            "previous_preterm": rng.random(n) < 0.08,
            "previous_stillbirth": rng.random(n) < 0.02,
            "htn": rng.random(n) < 0.10,
            "diabetes": rng.random(n) < 0.05,
            "heart_disease": rng.random(n) < 0.03,
            "kidney_disease": rng.random(n) < 0.02,
            "anc_visits_attended": rng.integers(0, 9, n),
            "pmsma_attended": rng.random(n) < 0.40,
        }
    )
    df["gravida"] = np.maximum(df["gravida"], df["parity"] + 1)
    df["risk_level"] = df.apply(_rule_maternal_risk, axis=1)

    # Inject label noise so the problem is not trivially separable.
    flip = rng.random(n) < 0.04
    candidates = df.index[flip]
    if len(candidates) > 0:
        labels = ["low", "medium", "high"]
        df.loc[candidates, "risk_level"] = [
            rng.choice([l for l in labels if l != df.loc[i, "risk_level"]])
            for i in candidates
        ]

    for col in ("bp_systolic", "bp_diastolic", "hemoglobin", "blood_sugar", "bmi"):
        miss_idx = rng.choice(df.index, size=n_missing, replace=False)
        df.loc[miss_idx, col] = np.nan

    return df[MATERNAL_COLUMNS]


def _sample_lms_value(domain: str, sex: str, age_months: float, z: float) -> float:
    """Convert a z-score back to an anthropometric value using WHO LMS."""
    l, m, s = who_lms(domain, sex, age_months)
    if l == 0.0:
        return m * float(np.exp(s * z))
    return m * float((1.0 + l * s * z) ** (1.0 / l))


def _rule_child_nutrition(
    waz: Optional[float], whz: Optional[float], muac_mm: float
) -> str:
    """WHO-based SAM/MAM classification used to label synthetic child rows."""
    if whz is not None and whz < -3.0:
        return "SAM"
    if waz is not None and waz < -3.0:
        return "SAM"
    if muac_mm < 115.0:
        return "SAM"
    if whz is not None and whz < -2.0:
        return "MAM"
    if waz is not None and waz < -2.0:
        return "MAM"
    if muac_mm < 125.0:
        return "MAM"
    return "normal"


def generate_synthetic_child(n: int = 5000, seed: Optional[int] = 42) -> pd.DataFrame:
    """Generate ``n`` child growth records with nutrition status labels."""
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    for _ in range(n):
        age_months = float(rng.integers(0, 60))
        sex = str(rng.choice(["M", "F"]))

        # Weight/height sampled around the WHO median with a slight negative
        # bias to keep a realistic malnutrition prevalence.
        z_weight = float(rng.normal(-0.35, 1.05))
        z_height = float(rng.normal(-0.25, 1.0))
        weight_kg = _sample_lms_value("waz", sex, age_months, z_weight)
        height_cm = _sample_lms_value("haz", sex, age_months, z_height)
        muac_mm = float(np.clip(18.0 * weight_kg + 18.0 + rng.normal(0, 4), 90, 200))

        if age_months < 6:
            breastfeeding = str(rng.choice(["exclusive", "mixed"], p=[0.85, 0.15]))
        elif age_months < 24:
            breastfeeding = str(rng.choice(["mixed", "none"], p=[0.7, 0.3]))
        else:
            breastfeeding = "none"

        rows.append(
            {
                "age_months": age_months,
                "sex": sex,
                "weight_kg": round(weight_kg, 2),
                "height_cm": round(height_cm, 1),
                "muac_mm": round(muac_mm, 1),
                "birth_weight_kg": round(float(np.clip(rng.normal(3.0, 0.4), 1.6, 4.2)), 2),
                "gestation_weeks": int(rng.integers(32, 42)),
                "breastfeeding": breastfeeding,
                "complementary_feeding": bool(age_months >= 6 and rng.random() < 0.75),
                "diarrhea_episodes": int(rng.poisson(0.35)),
                "immunization_complete": bool(rng.random() < 0.75),
            }
        )

    df = pd.DataFrame(rows)
    z = df.apply(
        lambda r: _zscores_for(r["age_months"], r["sex"], r["weight_kg"], r["height_cm"]),
        axis=1,
    )
    df["nutrition_status"] = [
        _rule_child_nutrition(waz, whz, muac)
        for (waz, whz), muac in zip(z, df["muac_mm"])
    ]

    flip = rng.random(len(df)) < 0.04
    labels = ["normal", "MAM", "SAM"]
    for i in df.index[flip]:
        df.at[i, "nutrition_status"] = rng.choice(
            [l for l in labels if l != df.at[i, "nutrition_status"]]
        )
    return df[CHILD_COLUMNS]


def _zscores_for(age: float, sex: str, weight: float, height: float) -> tuple[Optional[float], Optional[float]]:
    """Quick z-score lookup for synthetic generation (avoids import cycle)."""
    try:
        from src.models.child_growth.predict import compute_who_zscore

        result = compute_who_zscore(age, sex, weight, height, muac_mm=None)
        return result["waz"], result["whz"]
    except Exception:  # pragma: no cover - safety fallback
        return None, None


def _rule_diabetes(row: pd.Series) -> bool:
    sugar = row["blood_sugar_random"]
    if bool(row["known_diabetes"]) or sugar >= 200:
        return True
    if sugar >= 126:
        return True
    if (
        sugar >= 110
        and (
            row["bmi"] >= 25
            or row["age"] >= 45
            or bool(row["family_history_diabetes"])
            or row["waist_cm"] >= 90
        )
    ):
        return True
    return False


def _rule_hypertension(row: pd.Series) -> bool:
    if bool(row["known_hypertension"]):
        return True
    if row["bp_systolic"] >= 140 or row["bp_diastolic"] >= 90:
        return True
    if (
        (row["bp_systolic"] >= 130 or row["bp_diastolic"] >= 85)
        and (bool(row["family_history_hypertension"]) or row["bmi"] >= 27 or row["age"] >= 50)
    ):
        return True
    return False


def generate_synthetic_ncd(n: int = 5000, seed: Optional[int] = 42) -> pd.DataFrame:
    """Generate ``n`` NCD screening rows with diabetes/hypertension targets."""
    rng = np.random.default_rng(seed)
    age = rng.integers(18, 81, n)
    sex = rng.choice(["M", "F"], n)
    bmi = rng.normal(24.5, 4.5, n).clip(15, 40)
    waist = np.where(
        sex == "M",
        np.clip(60 + bmi * 1.8 + rng.normal(0, 4, n), 60, 130),
        np.clip(55 + bmi * 1.6 + rng.normal(0, 4, n), 55, 125),
    )

    df = pd.DataFrame(
        {
            "age": age,
            "sex": sex,
            "bmi": bmi,
            "waist_cm": waist,
            "tobacco_use": rng.random(n) < 0.12,
            "alcohol_use": rng.random(n) < 0.15,
            "physical_activity": rng.choice(["low", "moderate", "high"], n, p=[0.4, 0.4, 0.2]),
            "family_history_diabetes": rng.random(n) < 0.25,
            "family_history_hypertension": rng.random(n) < 0.30,
            "known_diabetes": rng.random(n) < 0.06,
            "known_hypertension": rng.random(n) < 0.10,
            "bp_systolic": rng.normal(122, 16, n).clip(90, 190),
            "bp_diastolic": rng.normal(78, 11, n).clip(55, 120),
            "blood_sugar_random": rng.normal(112, 35, n).clip(60, 320),
        }
    )
    df["diabetes_risk"] = df.apply(_rule_diabetes, axis=1).astype(int)
    df["hypertension_risk"] = df.apply(_rule_hypertension, axis=1).astype(int)
    return df[NCD_COLUMNS]
