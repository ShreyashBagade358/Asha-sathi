"""Feature engineering for the three model families."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MATERNAL_FEATURES: list[str] = [
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

CHILD_FEATURES: list[str] = [
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

NCD_FEATURES: list[str] = [
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

MATERNAL_TARGET = "risk_level"
CHILD_TARGET = "nutrition_status"
NCD_TARGETS = ["diabetes_risk", "hypertension_risk"]

# Categorical columns per domain and their numeric code mapping. Booleans are
# treated as numeric 0/1 columns and simply median-imputed + standardised.
#
# The codes deliberately mirror ``ml_common.feature_spec`` so the trained
# models consume a fully numeric feature matrix that exports cleanly to ONNX
# (skl2onnx cannot convert string-typed transformers / single-tensor graphs).
CATEGORY_CODES: dict[str, dict[str, int]] = {
    "sex": {"M": 0, "F": 1},
    "breastfeeding": {"exclusive": 0, "mixed": 1, "none": 2},
    "physical_activity": {"low": 0, "moderate": 1, "high": 2},
}

CATEGORICAL_COLUMNS: dict[str, list[str]] = {
    "maternal": [],
    "child": ["sex", "breastfeeding"],
    "ncd": ["sex", "physical_activity"],
}


def encode_categoricals(df: pd.DataFrame, domain: str) -> pd.DataFrame:
    """Map string categorical columns to numeric codes (returns a copy).

    Unknown categories become NaN so the median imputer can fill them.
    """
    frame = df.copy()
    for col in CATEGORICAL_COLUMNS[domain]:
        frame[col] = frame[col].map(CATEGORY_CODES[col]).astype(float)
    return frame

_FEATURES = {
    "maternal": MATERNAL_FEATURES,
    "child": CHILD_FEATURES,
    "ncd": NCD_FEATURES,
}


@dataclass
class FeatureSet:
    """The outcome of feature engineering.

    Attributes:
        X: raw feature frame (missing values still present - the preprocessor
            is responsible for imputation so the pipeline stays trainable
            end-to-end and exports cleanly to ONNX).
        y: target series/DataFrame. String targets for maternal/child,
            two binary columns for NCD.
        feature_names: ordered list of raw column names feeding the model.
        preprocessor: an **unfitted** numeric :class:`~sklearn.pipeline.Pipeline`.
            Training code fits it on the train split to avoid leakage.
    """

    X: pd.DataFrame
    y: pd.Series | pd.DataFrame
    feature_names: list[str]
    preprocessor: Pipeline


def _build_preprocessor(features: list[str]) -> Pipeline:
    """Build an unfitted numeric preprocessor over the (code-encoded) features."""
    return Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )


def _feature_engineering(df: pd.DataFrame, domain: str, target_col: str) -> FeatureSet:
    features = _FEATURES[domain]
    missing = [c for c in features if c not in df.columns]
    if missing:
        raise ValueError(f"{domain}: missing required columns {missing}")
    if target_col not in df.columns:
        raise ValueError(f"{domain}: missing target column {target_col!r}")

    frame = df[features + [target_col]].copy()
    frame = frame[frame[target_col].notna()]
    frame = encode_categoricals(frame, domain)
    preprocessor = _build_preprocessor(list(features))
    return FeatureSet(
        X=frame[features],
        y=frame[target_col],
        feature_names=list(features),
        preprocessor=preprocessor,
    )


def feature_engineering_maternal(df: pd.DataFrame) -> FeatureSet:
    """Prepare the maternal ANC dataset (target: ``risk_level``)."""
    return _feature_engineering(df, "maternal", MATERNAL_TARGET)


def feature_engineering_child(df: pd.DataFrame) -> FeatureSet:
    """Prepare the child growth dataset (target: ``nutrition_status``)."""
    return _feature_engineering(df, "child", CHILD_TARGET)


def feature_engineering_ncd(df: pd.DataFrame) -> FeatureSet:
    """Prepare the NCD dataset (targets: diabetes_risk / hypertension_risk)."""
    return _feature_engineering(df, "ncd", NCD_TARGETS[0])
