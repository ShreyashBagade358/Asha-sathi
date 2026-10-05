"""Inference for the maternal ANC risk model."""

from __future__ import annotations

import numpy as np
import pandas as pd

RISK_LABELS = ["low", "medium", "high"]


def _confidence(probabilities: np.ndarray) -> float:
    """Confidence from the probability margin (top1 - top2, binary |p-0.5|*2)."""
    probs = np.asarray(probabilities, dtype=float)
    if probs.ndim == 2:
        probs = probs[0]
    if probs.size < 2:
        return float(probs[0])
    if probs.size == 2:
        return float(np.clip(abs(probs[0] - 0.5) * 2.0, 0.0, 1.0))
    top = probs.max()
    second = np.partition(probs, -2)[-2]
    return float(np.clip(top - second, 0.0, 1.0))


def predict_maternal_risk(model, features_df) -> dict:
    """Predict maternal risk for one record.

    Args:
        model: trained Pipeline with a ``labels_`` attribute (class order).
        features_df: dict or DataFrame of the raw maternal feature columns.

    Returns:
        ``{"risk_level", "probabilities", "confidence"}``.
    """
    if isinstance(features_df, dict):
        frame = pd.DataFrame([features_df])
    else:
        frame = features_df

    proba = model.predict_proba(frame)
    if proba.ndim == 1:
        proba = proba.reshape(1, -1)
    row = proba[0]

    labels = [str(c) for c in getattr(model, "labels_", RISK_LABELS)]
    idx = int(np.argmax(row))
    risk_level = labels[idx]

    return {
        "risk_level": risk_level,
        "probabilities": {label: float(p) for label, p in zip(labels, row)},
        "confidence": _confidence(row),
    }
