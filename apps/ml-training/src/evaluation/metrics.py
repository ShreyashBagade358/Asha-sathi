"""Metric computation and reporting helpers.

Classification metrics cover accuracy / precision / recall / F1 (per class,
macro and weighted) plus ROC-AUC. Regression helpers (MAE / RMSE / R2) are
provided for the z-score regression variant used by some child-growth models.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional, Sequence

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
    roc_auc_score,
)


def classification_metrics(
    y_true: Sequence,
    y_pred: Sequence,
    y_proba: Optional[np.ndarray] = None,
    labels: Optional[Sequence] = None,
    task: str = "multiclass",
) -> dict[str, Any]:
    """Compute a full classification metric summary.

    Args:
        y_true: ground-truth labels.
        y_pred: predicted labels.
        y_proba: predicted probabilities (required for AUC).
        labels: class labels in the probability-column order.
        task: ``"multiclass"`` or ``"binary"``.
    """
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(
            precision_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "recall_weighted": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
    }

    report = classification_report(
        y_true, y_pred, labels=labels, output_dict=True, zero_division=0
    )
    per_class: dict[str, dict[str, float]] = {}
    for key, value in report.items():
        if isinstance(value, dict) and "precision" in value:
            per_class[str(key)] = {
                "precision": float(value["precision"]),
                "recall": float(value["recall"]),
                "f1": float(value["f1-score"]),
                "support": float(value["support"]),
            }
    metrics["per_class"] = per_class

    if y_proba is not None:
        proba = np.asarray(y_proba)
        try:
            if task == "binary":
                auc = roc_auc_score(y_true, proba)
                metrics["roc_auc"] = float(auc)
            else:
                auc = roc_auc_score(y_true, proba, multi_class="ovr", average="macro")
                metrics["roc_auc_ovr_macro"] = float(auc)
        except ValueError:
            # AUC is undefined when a class is missing from the sample.
            metrics["roc_auc"] = None

    return metrics


def regression_metrics(y_true: Sequence, y_pred: Sequence) -> dict[str, float]:
    """Regression metrics for continuous outputs (e.g. z-score regression)."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def save_metrics(metrics: dict[str, Any], path: str | Path) -> Path:
    """Persist a metric dict as JSON (NaN -> null)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metrics, indent=2, default=_json_default), encoding="utf-8")
    return path


def _json_default(value: Any) -> Any:
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return str(value)


def print_summary(metrics: dict[str, Any]) -> None:
    """Human-readable summary of a metric dict to stdout."""
    lines: list[str] = []
    if "accuracy" in metrics:
        lines.append(f"Accuracy : {metrics['accuracy']:.4f}")
        lines.append(f"F1 macro : {metrics['f1_macro']:.4f}")
        lines.append(f"F1 weighted : {metrics['f1_weighted']:.4f}")
        auc = metrics.get("roc_auc_ovr_macro", metrics.get("roc_auc"))
        if auc is not None:
            lines.append(f"ROC-AUC  : {auc:.4f}")
    if "per_class" in metrics:
        for cls, values in metrics["per_class"].items():
            lines.append(
                f"  {cls:<12} P={values['precision']:.3f} R={values['recall']:.3f} "
                f"F1={values['f1']:.3f} n={values['support']:.0f}"
            )
    if "mae" in metrics:
        lines.append(f"MAE  : {metrics['mae']:.4f}")
        lines.append(f"RMSE : {metrics['rmse']:.4f}")
    print("\n".join(lines))
