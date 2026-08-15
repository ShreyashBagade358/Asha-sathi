"""Tests: each model trains on synthetic data and predicts plausibly."""

from __future__ import annotations

import numpy as np
import pytest

from src.models.child_growth.predict import (
    NUTRITION_LABELS,
    compute_who_zscore,
    predict_child_growth,
)
from src.models.child_growth.train import train_child_growth_model
from src.models.maternal_risk.predict import predict_maternal_risk
from src.models.maternal_risk.train import train_maternal_model
from src.models.ncd_risk.predict import predict_ncd_risk
from src.models.ncd_risk.train import train_ncd_models


def test_maternal_model_trains_and_predicts(maternal_feature_set, tmp_config):
    fs = maternal_feature_set
    model, metrics = train_maternal_model(
        fs.X, fs.y, preprocessor=fs.preprocessor, config=tmp_config, verbose=False
    )

    assert metrics["accuracy"] >= 0.55
    assert "f1_macro" in metrics

    sample = fs.X.iloc[0].to_dict()
    prediction = predict_maternal_risk(model, sample)
    assert prediction["risk_level"] in {"low", "medium", "high"}
    probs = list(prediction["probabilities"].values())
    assert sum(probs) == pytest.approx(1.0, abs=0.05)
    assert 0.0 <= prediction["confidence"] <= 1.0


def test_child_model_trains_and_predicts(child_feature_set, tmp_config):
    fs = child_feature_set
    model, metrics = train_child_growth_model(
        fs.X, fs.y, preprocessor=fs.preprocessor, config=tmp_config, verbose=False
    )

    assert metrics["accuracy"] >= 0.55
    sample = {
        "age_months": 18.0,
        "sex": "F",
        "weight_kg": 9.4,
        "height_cm": 78.0,
        "muac_mm": 132.0,
        "birth_weight_kg": 2.9,
        "gestation_weeks": 39,
        "breastfeeding": "mixed",
        "complementary_feeding": True,
        "diarrhea_episodes": 0,
        "immunization_complete": True,
    }
    prediction = predict_child_growth(model, sample)
    assert prediction["nutrition_status"] in set(NUTRITION_LABELS)
    assert 0.0 <= prediction["confidence"] <= 1.0
    assert "waz" in prediction["z_scores"]


def test_ncd_models_train_and_predict(ncd_feature_set, ncd_df, tmp_config):
    fs = ncd_feature_set
    models = train_ncd_models(
        fs.X,
        ncd_df["diabetes_risk"],
        ncd_df["hypertension_risk"],
        preprocessor=fs.preprocessor,
        config=tmp_config,
        verbose=False,
    )
    assert set(models) == {"diabetes", "hypertension"}

    sample = {
        "age": 45,
        "sex": "M",
        "bmi": 27.5,
        "waist_cm": 95,
        "tobacco_use": False,
        "alcohol_use": True,
        "physical_activity": "low",
        "family_history_diabetes": True,
        "family_history_hypertension": False,
        "known_diabetes": False,
        "known_hypertension": False,
        "bp_systolic": 128,
        "bp_diastolic": 84,
        "blood_sugar_random": 142,
    }
    prediction = predict_ncd_risk(models, sample)
    assert 0.0 <= prediction["diabetes_risk"] <= 1.0
    assert 0.0 <= prediction["hypertension_risk"] <= 1.0
    assert prediction["diabetes_label"] in {"yes", "no"}
    assert prediction["hypertension_label"] in {"yes", "no"}


def test_who_zscore_reasonable():
    result = compute_who_zscore(
        age_months=12.0, sex="M", weight=9.6, height=75.0, muac_mm=140.0
    )
    # 12-month WHO boy median weight is ~9.7 kg -> WAZ near 0.
    assert -2.5 < result["waz"] < 2.5
    assert -3.0 < result["haz"] < 3.0
    assert result["muac_status"] == "normal"


def test_who_zscore_detects_malnutrition():
    result = compute_who_zscore(
        age_months=24.0, sex="F", weight=8.0, height=80.0, muac_mm=110.0
    )
    assert result["whz"] is not None and result["whz"] < -2.0
    assert result["muac_status"] == "SAM"
