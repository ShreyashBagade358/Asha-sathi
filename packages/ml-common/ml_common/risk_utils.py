"""Risk label mapping and probability-margin confidence helpers.

Used consistently by the training pipeline, the ONNX serving layer and any
client that needs to interpret model outputs.
"""

from __future__ import annotations

from typing import Sequence

MATERNAL_RISK_LABELS: tuple[str, ...] = ("low", "medium", "high")
NUTRITION_LABELS: tuple[str, ...] = ("normal", "MAM", "SAM")
NCD_LABELS: tuple[str, ...] = ("no", "yes")


def probability_margin(probabilities: Sequence[float]) -> float:
    """Margin between the top-1 and top-2 class probabilities.

    For binary output the margin is ``|p - 0.5| * 2`` so it always falls in
    ``[0, 1]``.
    """
    probs = [float(p) for p in probabilities]
    if not probs:
        return 0.0
    if len(probs) == 1:
        return probs[0]
    if len(probs) == 2:
        return abs(probs[0] - 0.5) * 2.0
    ordered = sorted(probs, reverse=True)
    return max(0.0, min(1.0, ordered[0] - ordered[1]))


def confidence_from_margin(probabilities: Sequence[float]) -> float:
    """Confidence score derived from the probability margin.

    Returns a value in ``[0, 1]`` where 1.0 means the model is maximally
    confident about its top class.
    """
    margin = probability_margin(probabilities)
    if margin >= 0.9:
        return 1.0
    if margin <= 0.0:
        return 0.0
    return round(margin, 4)


def top_label(probabilities: Sequence[float], labels: Sequence[str]) -> str:
    """Return the label with the highest probability."""
    probs = [float(p) for p in probabilities]
    if not probs:
        raise ValueError("empty probability vector")
    idx = max(range(len(probs)), key=lambda i: probs[i])
    return str(labels[idx])


def class_index_to_label(index: int, labels: Sequence[str] = MATERNAL_RISK_LABELS) -> str:
    """Map a model output index to its label (bounds-checked)."""
    if not 0 <= index < len(labels):
        raise IndexError(f"class index {index} out of range for {len(labels)} labels")
    return str(labels[index])
