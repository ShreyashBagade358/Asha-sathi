"""Training for the two NCD risk classifiers (diabetes + hypertension)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_class_weight
from xgboost import XGBClassifier

from src.config import ModelConfig
from src.evaluation.metrics import classification_metrics, print_summary, save_metrics
from src.features.engineering import feature_engineering_ncd

NCD_TARGETS = ["diabetes_risk", "hypertension_risk"]


def _train_binary(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    preprocessor,
    cfg: ModelConfig,
    name: str,
) -> Pipeline:
    y_train_enc = y_train.astype(int).to_numpy()
    y_test_enc = y_test.astype(int).to_numpy()

    weights = compute_class_weight(
        "balanced", classes=np.array([0, 1]), y=y_train_enc
    )

    clf = XGBClassifier(
        objective="binary:logistic",
        n_estimators=cfg.n_estimators,
        max_depth=cfg.max_depth,
        learning_rate=cfg.learning_rate,
        subsample=cfg.subsample,
        colsample_bytree=cfg.colsample_bytree,
        random_state=cfg.random_state,
        n_jobs=-1,
        eval_metric="logloss",
        early_stopping_rounds=cfg.early_stopping_rounds,
    )

    X_train_pre = preprocessor.fit_transform(X_train)
    X_test_pre = preprocessor.transform(X_test)
    clf.fit(
        X_train_pre,
        y_train_enc,
        sample_weight=weights[y_train_enc],
        eval_set=[(X_test_pre, y_test_enc)],
        verbose=False,
    )

    model = Pipeline([("preprocess", preprocessor), ("clf", clf)])
    model.labels_ = np.array(["no", "yes"])  # type: ignore[attr-defined]

    y_pred_enc = clf.predict(X_test_pre)
    y_proba = clf.predict_proba(X_test_pre)[:, 1]

    metrics = classification_metrics(
        y_test_enc, y_pred_enc, y_proba=y_proba, labels=[0, 1], task="binary"
    )
    metrics["model"] = name
    metrics["version"] = cfg.model_version
    metrics["n_train"] = int(len(y_train))
    metrics["n_test"] = int(len(y_test))
    save_metrics(metrics, cfg.reports_dir / f"{name}_metrics.json")
    return model


def train_ncd_models(
    X: pd.DataFrame,
    y_diabetes: pd.Series,
    y_hypertension: pd.Series,
    preprocessor=None,
    config: Optional[ModelConfig] = None,
    verbose: bool = True,
) -> dict[str, Pipeline]:
    """Train diabetes and hypertension binary classifiers.

    Returns ``{"diabetes": Pipeline, "hypertension": Pipeline}`` and persists
    artefacts to ``artifacts/ncd/``.
    """
    cfg = config or ModelConfig()
    cfg.ensure_dirs()

    if preprocessor is None:
        df = X.assign(diabetes_risk=y_diabetes, hypertension_risk=y_hypertension)
        preprocessor = feature_engineering_ncd(df).preprocessor

    diabetes_model = _train_binary(
        *train_test_split(
            X, y_diabetes, test_size=cfg.test_size, random_state=cfg.random_state, stratify=y_diabetes
        ),
        preprocessor,
        cfg,
        "diabetes",
    )

    hypertension_model = _train_binary(
        *train_test_split(
            X, y_hypertension, test_size=cfg.test_size, random_state=cfg.random_state, stratify=y_hypertension
        ),
        preprocessor,
        cfg,
        "hypertension",
    )

    _save_artefacts(
        {"diabetes": diabetes_model, "hypertension": hypertension_model},
        feature_names=list(X.columns),
        cfg=cfg,
    )

    if verbose:
        print("[ncd] diabetes")
        print_summary(_load_metrics(cfg, "diabetes"))
        print("[ncd] hypertension")
        print_summary(_load_metrics(cfg, "hypertension"))

    return {"diabetes": diabetes_model, "hypertension": hypertension_model}


def _load_metrics(cfg: ModelConfig, name: str) -> dict:
    import json as _json

    path = cfg.reports_dir / f"{name}_metrics.json"
    if path.exists():
        return _json.loads(path.read_text(encoding="utf-8"))
    return {}


def _save_artefacts(
    models: dict[str, Pipeline], feature_names: list[str], cfg: ModelConfig
) -> None:
    out_dir = cfg.artifacts_dir / "ncd"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, model in models.items():
        joblib.dump(model, out_dir / f"model_{name}_{cfg.model_version}.joblib")
    metadata = {
        "version": cfg.model_version,
        "features": feature_names,
        "models": list(models),
        "task": "binary",
        "framework": "xgboost",
    }
    (out_dir / f"metadata_{cfg.model_version}.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
