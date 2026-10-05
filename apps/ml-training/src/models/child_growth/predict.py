"""Inference helpers for the child growth / nutrition model.

Includes an embedded approximation of the WHO Child Growth Standards LMS
tables (weight-for-age, length/height-for-age) so z-scores can be computed
without a network call or an external reference library. Values follow the
published WHO LMS constants at anchor ages and are linearly interpolated in
between - sufficiently accurate for screening and prioritisation.

Weight-for-height is approximated from median weight-for-height references.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from src.features.engineering import encode_categoricals

NUTRITION_LABELS = ["normal", "MAM", "SAM"]

# ---------------------------------------------------------------------------
# WHO Child Growth Standards - Weight-for-age (kg), boys/girls.
# Anchor age in months -> (L, M, S) as published by WHO.
# ---------------------------------------------------------------------------

_WAZ_BOYS: dict[float, tuple[float, float, float]] = {
    0.0: (0.3487, 3.3464, 0.14602),
    1.0: (0.2297, 4.4709, 0.13395),
    2.0: (0.1970, 5.5675, 0.12385),
    3.0: (0.1738, 6.3762, 0.11727),
    4.0: (0.1553, 7.0023, 0.11274),
    5.0: (0.1416, 7.5105, 0.10969),
    6.0: (0.1325, 7.9340, 0.10772),
    7.0: (0.1270, 8.2970, 0.10660),
    8.0: (0.1240, 8.6211, 0.10603),
    9.0: (0.1226, 8.9195, 0.10579),
    10.0: (0.1224, 9.1997, 0.10579),
    11.0: (0.1230, 9.4664, 0.10595),
    12.0: (0.1242, 9.7230, 0.10622),
    24.0: (0.1351, 12.2715, 0.10729),
    36.0: (0.0946, 14.2943, 0.11163),
    48.0: (0.0288, 16.2098, 0.12064),
    60.0: (-0.0442, 18.2004, 0.13000),
}

_WAZ_GIRLS: dict[float, tuple[float, float, float]] = {
    0.0: (0.3809, 3.2322, 0.14171),
    1.0: (0.1714, 4.1873, 0.13724),
    2.0: (0.0962, 5.1282, 0.13000),
    3.0: (0.0402, 5.8458, 0.12619),
    4.0: (0.0049, 6.4237, 0.12402),
    5.0: (-0.0177, 6.8985, 0.12273),
    6.0: (-0.0321, 7.2964, 0.12204),
    7.0: (-0.0413, 7.6396, 0.12181),
    8.0: (-0.0471, 7.9487, 0.12194),
    9.0: (-0.0505, 8.2322, 0.12236),
    10.0: (-0.0522, 8.4961, 0.12298),
    11.0: (-0.0523, 8.7442, 0.12375),
    12.0: (-0.0513, 8.9793, 0.12460),
    24.0: (-0.0214, 11.6191, 0.12965),
    36.0: (0.0450, 13.6500, 0.13398),
    48.0: (0.1647, 15.5123, 0.14068),
    60.0: (0.2862, 17.4430, 0.14667),
}

# ---------------------------------------------------------------------------
# Length/height-for-age (cm): (L=1, M, S) approximations from WHO standards.
# ---------------------------------------------------------------------------

_HAZ_BOYS: dict[float, tuple[float, float, float]] = {
    0.0: (1.0, 49.9, 1.9),
    3.0: (1.0, 61.4, 2.2),
    6.0: (1.0, 67.6, 2.3),
    9.0: (1.0, 72.0, 2.4),
    12.0: (1.0, 75.7, 2.5),
    18.0: (1.0, 82.3, 2.9),
    24.0: (1.0, 87.1, 3.2),
    36.0: (1.0, 96.1, 3.8),
    48.0: (1.0, 103.3, 4.2),
    60.0: (1.0, 110.0, 4.5),
}

_HAZ_GIRLS: dict[float, tuple[float, float, float]] = {
    0.0: (1.0, 49.1, 1.9),
    3.0: (1.0, 60.0, 2.1),
    6.0: (1.0, 65.7, 2.3),
    9.0: (1.0, 70.1, 2.4),
    12.0: (1.0, 74.0, 2.5),
    18.0: (1.0, 80.7, 2.9),
    24.0: (1.0, 85.7, 3.2),
    36.0: (1.0, 95.1, 3.8),
    48.0: (1.0, 102.7, 4.2),
    60.0: (1.0, 109.4, 4.5),
}

# Weight-for-height median (kg) by height (cm), sexes pooled approximation.
_WHZ_BY_HEIGHT: dict[float, tuple[float, float]] = {
    45.0: (2.6, 0.35),
    50.0: (3.4, 0.45),
    55.0: (4.4, 0.60),
    60.0: (5.6, 0.75),
    65.0: (7.0, 0.90),
    70.0: (8.3, 1.05),
    75.0: (9.5, 1.15),
    80.0: (10.7, 1.25),
    85.0: (11.9, 1.35),
    90.0: (13.1, 1.45),
    95.0: (14.4, 1.55),
    100.0: (15.6, 1.70),
    105.0: (17.0, 1.85),
    110.0: (18.5, 2.00),
}


def who_lms(domain: str, sex: str, age_months: float) -> tuple[float, float, float]:
    """Return interpolated WHO (L, M, S) constants for a domain/age.

    Args:
        domain: ``"waz"`` or ``"haz"``.
        sex: ``"M"`` or ``"F"``.
        age_months: age in months (0-60).
    """
    table = {
        "waz": _WAZ_BOYS if sex.upper() == "M" else _WAZ_GIRLS,
        "haz": _HAZ_BOYS if sex.upper() == "M" else _HAZ_GIRLS,
    }.get(domain)
    if table is None:
        raise ValueError(f"Unknown WHO domain: {domain}")

    anchors = sorted(table.items())
    if age_months <= anchors[0][0]:
        return table[anchors[0][0]]
    if age_months >= anchors[-1][0]:
        return table[anchors[-1][0]]

    for (a0, v0), (a1, v1) in zip(anchors, anchors[1:]):
        if a0 <= age_months <= a1:
            t = (age_months - a0) / (a1 - a0)
            return (
                v0[0] + (v1[0] - v0[0]) * t,
                v0[1] + (v1[1] - v0[1]) * t,
                v0[2] + (v1[2] - v0[2]) * t,
            )
    return table[anchors[-1][0]]


def _z_from_lms(value: float, l: float, m: float, s: float) -> float:
    """Convert an anthropometric measurement to a z-score via LMS."""
    if m <= 0 or value <= 0 or s <= 0:
        raise ValueError("Invalid LMS inputs")
    if abs(l) < 1e-9:
        return float(np.log(value / m) / s)
    return float(((value / m) ** l - 1.0) / (l * s))


def _interp_whz(value: float) -> Optional[tuple[float, float]]:
    """Interpolate the median/SD weight-for-height table at ``value`` cm."""
    anchors = sorted(_WHZ_BY_HEIGHT.items())
    if value < anchors[0][0] or value > anchors[-1][0]:
        return None
    if value <= anchors[0][0]:
        return anchors[0][1]
    if value >= anchors[-1][0]:
        return anchors[-1][1]
    for (x0, y0), (x1, y1) in zip(anchors, anchors[1:]):
        if x0 <= value <= x1:
            t = (value - x0) / (x1 - x0)
            return (y0[0] + (y1[0] - y0[0]) * t, y0[1] + (y1[1] - y0[1]) * t)
    return None


def compute_who_zscore(
    age_months: float,
    sex: str,
    weight: float,
    height: float,
    muac_mm: Optional[float],
) -> dict[str, Optional[float]]:
    """Compute approximate WHO z-scores for a child.

    Returns a dict with ``waz``, ``haz``, ``whz`` and ``muac_status``. Each
    z-score is ``None`` when inputs are out of range / missing.
    """
    sex_norm = sex.upper()
    if sex_norm not in ("M", "F"):
        raise ValueError(f"Invalid sex: {sex!r}")

    waz: Optional[float] = None
    haz: Optional[float] = None
    whz: Optional[float] = None
    muac_status: Optional[str] = None

    if age_months < 0 or age_months > 60:
        waz = None
        haz = None
    else:
        if weight is not None and weight > 0:
            l, m, s = who_lms("waz", sex_norm, age_months)
            waz = _z_from_lms(weight, l, m, s)
        if height is not None and height > 0:
            l, m, s = who_lms("haz", sex_norm, age_months)
            haz = _z_from_lms(height, l, m, s)

    if height is not None and weight is not None and height > 0:
        ref = _interp_whz(height)
        if ref is not None:
            whz = (weight - ref[0]) / ref[1]

    if muac_mm is not None:
        if muac_mm < 115:
            muac_status = "SAM"
        elif muac_mm < 125:
            muac_status = "MAM"
        else:
            muac_status = "normal"

    return {"waz": waz, "haz": haz, "whz": whz, "muac_status": muac_status}


def _confidence(probabilities: np.ndarray) -> float:
    """Confidence from probability margin (top - second)."""
    probs = np.asarray(probabilities, dtype=float)
    if probs.ndim == 2:
        probs = probs[0]
    top = probs.max()
    second = np.partition(probs, -2)[-2] if probs.size > 1 else 0.0
    return float(np.clip(top - second, 0.0, 1.0))


def predict_child_growth(model, features) -> dict:
    """Predict nutrition status + z-scores for a child record.

    Args:
        model: trained sklearn Pipeline (preprocessor -> classifier) with a
            ``labels_`` attribute listing the class order.
        features: dict or DataFrame with the raw child feature columns.
    """
    import pandas as pd

    if isinstance(features, dict):
        frame = pd.DataFrame([features])
    else:
        frame = features

    proba = model.predict_proba(encode_categoricals(frame, "child"))
    if proba.ndim == 1:
        proba = proba.reshape(1, -1)
    row = proba[0]
    labels = list(getattr(model, "labels_", NUTRITION_LABELS))
    idx = int(np.argmax(row))
    nutrition_status = str(labels[idx])

    z_scores: dict[str, Optional[float]] = {}
    if "age_months" in frame.columns:
        record = frame.iloc[0]
        z_scores = compute_who_zscore(
            age_months=float(record.get("age_months") or 0.0),
            sex=str(record.get("sex") or "M"),
            weight=float(record.get("weight_kg") or 0.0),
            height=float(record.get("height_cm") or 0.0),
            muac_mm=(
                float(record["muac_mm"]) if "muac_mm" in frame.columns else None
            ),
        )

    return {
        "z_scores": {
            k: (None if v is None else (round(float(v), 3) if isinstance(v, (int, float)) else v))
            for k, v in z_scores.items()
        },
        "nutrition_status": nutrition_status,
        "probabilities": {str(l): float(p) for l, p in zip(labels, row)},
        "confidence": _confidence(row),
    }
