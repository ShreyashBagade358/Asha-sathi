"""Training for the child growth / nutrition classifier (3-class XGBoost).

The primary model is a 3-class classifier (normal / MAM / SAM). WHO z-score
regression values are *not* learned here - they are computed deterministically
from the embedded WHO LMS tables (see ``child_growth.predict``), which keeps
the exported ONNX artefact small and auditable.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from xgboost import XGBClassifier

from src.config import ModelConfig
from src.evaluation.metrics import classification_metrics, print_summary, save_metrics
from src.features.engineering import feature_engineering_child

NUTRITION_LABELS = ["normal", "MAM", "SAM"]


def train_child_growth_model(
    X: pd.DataFrame,
    y: pd.Series,
    preprocessor=None,
    config: Optional[ModelConfig] = None,
    verbose: bool = True,
) -> tuple[Pipeline, dict]:
    """Train the 3-class child nutrition classifier.

    Returns ``(model, metrics)`` and persists artefacts to
    ``artifacts/child/``.
    """
    cfg = config or ModelConfig()
    cfg.ensure_dirs()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=cfg.test_size, random_state=cfg.random_state, stratify=y
    )

    le = LabelEncoder()
    y_train_enc = le.fit_transform(y_train)
    y_test_enc = le.transform(y_test)

    if preprocessor is None:
        feature_set = feature_engineering_child(X.assign(nutrition_status=y))
        preprocessor = feature_set.preprocessor

    X_train_pre = preprocessor.fit_transform(X_train)
    X_test_pre = preprocessor.transform(X_test)

    weights = compute_class_weight(
        "balanced", classes=np.unique(y_train_enc), y=y_train_enc
    )

    clf = XGBClassifier(
        objective="multi:softprob",
        num_class=len(le.classes_),
        n_estimators=cfg.n_estimators,
        max_depth=cfg.max_depth,
        learning_rate=cfg.learning_rate,
        subsample=cfg.subsample,
        colsample_bytree=cfg.colsample_bytree,
        random_state=cfg.random_state,
        n_jobs=-1,
        eval_metric="mlogloss",
        early_stopping_rounds=cfg.early_stopping_rounds,
    )
    clf.fit(
        X_train_pre,
        y_train_enc,
        sample_weight=weights[y_train_enc],
        eval_set=[(X_test_pre, y_test_enc)],
        verbose=False,
    )

    model = Pipeline([("preprocess", preprocessor), ("clf", clf)])
    model.labels_ = np.asarray(le.classes_, dtype=str)  # type: ignore[attr-defined]

    y_pred_enc = clf.predict(X_test_pre)
    y_proba = clf.predict_proba(X_test_pre)
    y_pred = le.inverse_transform(y_pred_enc)

    metrics = classification_metrics(
        y_test, y_pred, y_proba=y_proba, labels=le.classes_, task="multiclass"
    )
    metrics["model"] = "child_growth"
    metrics["version"] = cfg.model_version
    metrics["n_train"] = int(len(y_train))
    metrics["n_test"] = int(len(y_test))
    metrics["classes"] = list(le.classes_)

    save_metrics(metrics, cfg.reports_dir / "child_metrics.json")
    _save_artefacts(model, feature_names=list(X.columns), cfg=cfg)

    if verbose:
        print("[child] summary")
        print_summary(metrics)
    return model, metrics


def _save_artefacts(model: Pipeline, feature_names: list[str], cfg: ModelConfig) -> None:
    out_dir = cfg.artifacts_dir / "child"
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / f"model_{cfg.model_version}.joblib"
    joblib.dump(model, model_path)
    metadata = {
        "version": cfg.model_version,
        "features": feature_names,
        "classes": [str(c) for c in model.labels_],
        "model_path": str(model_path),
        "framework": "xgboost",
        "task": "multiclass",
        "objective": "multi:softprob",
    }
    (out_dir / f"metadata_{cfg.model_version}.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
