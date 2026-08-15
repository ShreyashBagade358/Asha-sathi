"""Orchestrates the full ASHA Sathi ML pipeline.

Flow: prepare_data -> train_maternal -> train_child -> train_ncd -> evaluate
-> export_onnx. Each stage is callable directly and registered with DVC
(see ``dvc.yaml``).

Run everything:

    python -m src.training.pipeline --stage all

or a single stage:

    python -m src.training.pipeline --stage prepare_data
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from src.config import ModelConfig
from src.data.loaders import (
    generate_synthetic_child,
    generate_synthetic_maternal,
    generate_synthetic_ncd,
    load_child_dataset,
    load_maternal_dataset,
    load_ncd_dataset,
)
from src.evaluation.metrics import print_summary
from src.export.onnx_exporter import export_to_onnx, quantize_onnx, verify_onnx
from src.features.engineering import (
    CATEGORY_CODES,
    feature_engineering_child,
    feature_engineering_maternal,
    feature_engineering_ncd,
)
from src.models.child_growth.train import train_child_growth_model
from src.models.maternal_risk.train import train_maternal_model
from src.models.ncd_risk.train import train_ncd_models

MODEL_FILES = {
    "maternal": ("maternal", f"model_{{}}.joblib"),
    "child": ("child", f"model_{{}}.joblib"),
    "ncd_diabetes": ("ncd", f"model_diabetes_{{}}.joblib"),
    "ncd_hypertension": ("ncd", f"model_hypertension_{{}}.joblib"),
}

SAMPLE_RECORDS = {
    "maternal": {
        "age": 27,
        "gravida": 2,
        "parity": 1,
        "gestational_weeks": 26,
        "bp_systolic": 118,
        "bp_diastolic": 76,
        "hemoglobin": 11.2,
        "blood_sugar": 98,
        "bmi": 24.1,
        "previous_csection": False,
        "previous_pph": False,
        "previous_preterm": False,
        "previous_stillbirth": False,
        "htn": False,
        "diabetes": False,
        "heart_disease": False,
        "kidney_disease": False,
        "anc_visits_attended": 3,
        "pmsma_attended": True,
    },
    "child": {
        "age_months": 18,
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
    },
    "ncd": {
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
    },
}


def stage_prepare_data(cfg: ModelConfig) -> None:
    """Generate the three processed datasets (deterministic, seeded)."""
    cfg.ensure_dirs()
    cfg.raw_data_dir.mkdir(parents=True, exist_ok=True)

    datasets = {
        "maternal": generate_synthetic_maternal(5000, seed=cfg.random_state),
        "child": generate_synthetic_child(5000, seed=cfg.random_state),
        "ncd": generate_synthetic_ncd(5000, seed=cfg.random_state),
    }
    for name, df in datasets.items():
        df.to_parquet(cfg.processed_data_dir / f"{name}.parquet", index=False)
        df.to_csv(cfg.raw_data_dir / f"{name}.csv", index=False)
        print(f"[prepare] {name}: {len(df)} rows -> {name}.parquet")


def stage_train_maternal(cfg: ModelConfig) -> None:
    df = load_maternal_dataset(cfg.processed_data_dir / "maternal.parquet")
    fs = feature_engineering_maternal(df)
    model, metrics = train_maternal_model(fs.X, fs.y, preprocessor=fs.preprocessor, config=cfg)
    print(f"[train_maternal] accuracy={metrics['accuracy']:.3f} f1={metrics['f1_macro']:.3f}")


def stage_train_child(cfg: ModelConfig) -> None:
    df = load_child_dataset(cfg.processed_data_dir / "child.parquet")
    fs = feature_engineering_child(df)
    model, metrics = train_child_growth_model(fs.X, fs.y, preprocessor=fs.preprocessor, config=cfg)
    print(f"[train_child] accuracy={metrics['accuracy']:.3f} f1={metrics['f1_macro']:.3f}")


def stage_train_ncd(cfg: ModelConfig) -> None:
    df = load_ncd_dataset(cfg.processed_data_dir / "ncd.parquet")
    fs = feature_engineering_ncd(df)
    train_ncd_models(
        fs.X,
        df["diabetes_risk"],
        df["hypertension_risk"],
        preprocessor=fs.preprocessor,
        config=cfg,
    )
    print("[train_ncd] complete")


def stage_evaluate(cfg: ModelConfig) -> None:
    """Consolidate metrics and fail loudly if quality gates are missed."""
    report: dict = {"model_version": cfg.model_version, "models": {}}
    for name in ("maternal", "child", "diabetes", "hypertension"):
        path = cfg.reports_dir / f"{name}_metrics.json"
        if not path.exists():
            print(f"[evaluate] WARNING: missing metrics for {name}", file=sys.stderr)
            continue
        metrics = json.loads(path.read_text(encoding="utf-8"))
        report["models"][name] = metrics
        _check_thresholds(name, metrics, cfg)

    (cfg.reports_dir / "final_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(f"[evaluate] final report -> {cfg.reports_dir / 'final_report.json'}")


def _check_thresholds(name: str, metrics: dict, cfg: ModelConfig) -> None:
    accuracy = metrics.get("accuracy")
    f1 = metrics.get("f1_macro") or metrics.get("f1_weighted")
    auc = metrics.get("roc_auc_ovr_macro", metrics.get("roc_auc"))
    problems = []
    if accuracy is not None and accuracy < cfg.accuracy_min:
        problems.append(f"accuracy {accuracy:.3f} < {cfg.accuracy_min}")
    if f1 is not None and f1 < cfg.f1_min:
        problems.append(f"f1 {f1:.3f} < {cfg.f1_min}")
    if auc is not None and auc < cfg.roc_auc_min:
        problems.append(f"roc_auc {auc:.3f} < {cfg.roc_auc_min}")
    if problems:
        raise RuntimeError(f"[evaluate] {name} FAILED quality gates: {', '.join(problems)}")


def stage_export_onnx(cfg: ModelConfig) -> None:
    """Export trained joblib pipelines to (quantized) ONNX and verify them."""
    import joblib

    cfg.onnx_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"version": cfg.model_version, "models": {}}

    for key, (subdir, pattern) in MODEL_FILES.items():
        source = cfg.artifacts_dir / subdir / pattern.format(cfg.model_version)
        metadata_path = cfg.artifacts_dir / subdir / f"metadata_{cfg.model_version}.json"
        if not source.exists():
            print(f"[export] SKIP {key}: {source} not found", file=sys.stderr)
            continue

        metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
        model = joblib.load(source)
        feature_names = metadata.get("features") or SAMPLE_RECORDS.get(key.split("_")[0], {}).keys()

        onnx_path = cfg.onnx_dir / f"{key}_{cfg.model_version}.onnx"
        quant_path = cfg.onnx_dir / f"{key}_{cfg.model_version}_quantized.onnx"
        export_to_onnx(model, list(feature_names), onnx_path, model_name=key)
        quantize_onnx(onnx_path, quant_path)

        # Runtime verification with a plausible sample input.
        domain = key.split("_")[0]
        sample = SAMPLE_RECORDS.get(domain, SAMPLE_RECORDS["maternal"])
        sample_input = _feature_vector(sample, list(feature_names))
        outputs = verify_onnx(quant_path, sample_input)
        manifest["models"][key] = {
            "onnx": str(onnx_path),
            "quantized": str(quant_path),
            "output_shapes": [list(np.asarray(o).shape) for o in outputs],
        }
        print(f"[export] {key}: {quant_path} verified")

    (cfg.onnx_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def _feature_vector(sample: dict, feature_names: list[str]) -> np.ndarray:
    """Build a float32 row from a sample dict (strings->codes, booleans->0/1)."""
    row = []
    for name in feature_names:
        value = sample.get(name)
        if name in CATEGORY_CODES:
            key = str(value).strip() if value is not None else ""
            row.append(float(CATEGORY_CODES[name].get(key, 0.0)))
            continue
        if value is None:
            value = 0.0
        row.append(float(value) if not isinstance(value, bool) else (1.0 if value else 0.0))
    return np.asarray([row], dtype=np.float32)


def run_full_pipeline(cfg: Optional[ModelConfig] = None) -> dict:
    """Run every stage in order and return the final report dict."""
    cfg = cfg or ModelConfig()
    cfg.ensure_dirs()
    cfg.save()

    stage_prepare_data(cfg)
    stage_train_maternal(cfg)
    stage_train_child(cfg)
    stage_train_ncd(cfg)
    stage_evaluate(cfg)
    stage_export_onnx(cfg)

    report_path = cfg.reports_dir / "final_report.json"
    if report_path.exists():
        return json.loads(report_path.read_text(encoding="utf-8"))
    return {"status": "ok"}


_STAGES = {
    "prepare_data": stage_prepare_data,
    "train_maternal": stage_train_maternal,
    "train_child": stage_train_child,
    "train_ncd": stage_train_ncd,
    "evaluate": stage_evaluate,
    "export_onnx": stage_export_onnx,
}


def main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="ASHA Sathi ML pipeline")
    parser.add_argument(
        "--stage",
        choices=[*_STAGES.keys(), "all"],
        default="all",
        help="Stage to run (default: all)",
    )
    parser.add_argument("--model-version", default=None, help="Override model version")
    args = parser.parse_args(argv)

    cfg = ModelConfig(model_version=args.model_version) if args.model_version else ModelConfig()
    if args.stage == "all":
        run_full_pipeline(cfg)
    else:
        cfg.ensure_dirs()
        _STAGES[args.stage](cfg)


if __name__ == "__main__":
    main()
