"""Inference for the NCD risk models."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.features.engineering import encode_categoricals


def predict_ncd_risk(models: dict, features_df) -> dict:
    """Predict diabetes and hypertension risk for one record.

    Args:
        models: ``{"diabetes": Pipeline, "hypertension": Pipeline}``.
        features_df: dict or DataFrame of the raw NCD feature columns.

    Returns:
        ``{"diabetes_risk": prob, "hypertension_risk": prob,
        "diabetes_label", "hypertension_label"}``.
    """
    if isinstance(features_df, dict):
        frame = pd.DataFrame([features_df])
    else:
        frame = features_df

    result: dict[str, object] = {}
    model_frame = encode_categoricals(frame, "ncd")
    for name, model in models.items():
        proba = model.predict_proba(model_frame)
        if proba.ndim == 2:
            positive = float(proba[0, 1])
        else:
            positive = float(proba[0])
        result[f"{name}_risk"] = round(positive, 6)
        result[f"{name}_label"] = "yes" if positive >= 0.5 else "no"
    return result
