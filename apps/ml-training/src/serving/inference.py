"""FastAPI-lite inference serving for ASHA Sathi ML models.

:class:`ModelRegistry` loads all quantized ONNX models once at startup and
exposes typed predict methods. ``create_app()`` builds the FastAPI app with:

* ``POST /predict/maternal``
* ``POST /predict/child``
* ``POST /predict/ncd``
* ``GET  /health``

FastAPI is an optional dependency; the registry itself works standalone.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import numpy as np
import onnxruntime

from src.config import ModelConfig
from src.features.engineering import CATEGORY_CODES

# ml-common provides typed feature specs; use it when available on the path.
try:  # pragma: no cover - optional dependency
    from ml_common.feature_spec import (
        ChildFeatures,
        MaternalFeatures,
        NCDFeatures,
    )

    _ML_COMMON_AVAILABLE = True
except ImportError:  # pragma: no cover
    _ML_COMMON_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field

    _FASTAPI_AVAILABLE = True
except ImportError:  # pragma: no cover
    _FASTAPI_AVAILABLE = False

MATERNAL_LABELS = ["high", "low", "medium"]
CHILD_LABELS = ["MAM", "SAM", "normal"]

_FEATURE_NAMES = {
    "maternal": [
        "age", "gravida", "parity", "gestational_weeks", "bp_systolic",
        "bp_diastolic", "hemoglobin", "blood_sugar", "bmi",
        "previous_csection", "previous_pph", "previous_preterm",
        "previous_stillbirth", "htn", "diabetes", "heart_disease",
        "kidney_disease", "anc_visits_attended", "pmsma_attended",
    ],
    "child": [
        "age_months", "sex", "weight_kg", "height_cm", "muac_mm",
        "birth_weight_kg", "gestation_weeks", "breastfeeding",
        "complementary_feeding", "diarrhea_episodes", "immunization_complete",
    ],
    "ncd": [
        "age", "sex", "bmi", "waist_cm", "tobacco_use", "alcohol_use",
        "physical_activity", "family_history_diabetes",
        "family_history_hypertension", "known_diabetes", "known_hypertension",
        "bp_systolic", "bp_diastolic", "blood_sugar_random",
    ],
}


class ModelRegistry:
    """Loads ONNX models once and exposes predict methods over them."""

    def __init__(self, onnx_dir: Optional[Path] = None, model_version: str = "v1"):
        self.onnx_dir = Path(onnx_dir) if onnx_dir else ModelConfig().onnx_dir
        self.model_version = model_version
        self.sessions: dict[str, onnxruntime.InferenceSession] = {}
        self.models: dict[str, dict[str, Any]] = {}
        self._prefer_quantized = True

    # ------------------------------------------------------------------ setup

    def load_all(self) -> dict[str, str]:
        """Load every expected model. Missing models are recorded, not fatal."""
        candidates = {
            "maternal": ("maternal", 3),
            "child": ("child", 3),
            "ncd_diabetes": ("ncd_diabetes", 2),
            "ncd_hypertension": ("ncd_hypertension", 2),
        }
        for name, (basename, _outputs) in candidates.items():
            model_path = self._resolve(basename)
            if model_path is None:
                self.models[name] = {"status": "not_found"}
                continue
            session = onnxruntime.InferenceSession(str(model_path))
            input_meta = session.get_inputs()[0]
            self.sessions[name] = session
            self.models[name] = {
                "status": "loaded",
                "path": str(model_path),
                "input": input_meta.name,
                "input_dtype": input_meta.type,
                "outputs": [o.name for o in session.get_outputs()],
            }
        return {name: self.models[name]["status"] for name in self.models}

    def _resolve(self, basename: str) -> Optional[Path]:
        candidates = [
            self.onnx_dir / f"{basename}_{self.model_version}_quantized.onnx",
            self.onnx_dir / f"{basename}_{self.model_version}.onnx",
        ]
        if not self._prefer_quantized:
            candidates.reverse()
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    # --------------------------------------------------------------- predict

    def predict_maternal(self, features: dict[str, Any]) -> dict[str, Any]:
        row = _feature_row(features, "maternal")
        proba = self._proba("maternal", row)
        labels = _sorted_labels(MATERNAL_LABELS, proba.shape[-1])
        idx = int(np.argmax(proba[0]))
        return {
            "risk_level": labels[idx],
            "probabilities": {l: float(p) for l, p in zip(labels, proba[0])},
            "confidence": _margin_confidence(proba[0]),
        }

    def predict_child(self, features: dict[str, Any]) -> dict[str, Any]:
        row = _feature_row(features, "child")
        proba = self._proba("child", row)
        labels = _sorted_labels(CHILD_LABELS, proba.shape[-1])
        idx = int(np.argmax(proba[0]))
        z_scores: dict[str, Optional[float]] = {}
        if _ML_COMMON_AVAILABLE:
            try:
                child = ChildFeatures(**{k: v for k, v in features.items() if v is not None})
                z_scores = child.compute_z_scores()
            except Exception:  # pragma: no cover
                z_scores = {}
        return {
            "z_scores": z_scores,
            "nutrition_status": labels[idx],
            "probabilities": {l: float(p) for l, p in zip(labels, proba[0])},
            "confidence": _margin_confidence(proba[0]),
        }

    def predict_ncd(self, features: dict[str, Any]) -> dict[str, Any]:
        row = _feature_row(features, "ncd")
        result: dict[str, Any] = {}
        for key in ("ncd_diabetes", "ncd_hypertension"):
            if key not in self.sessions:
                result[key.replace("ncd_", "") + "_risk"] = None
                continue
            session = self.sessions[key]
            out = session.run(None, {session.get_inputs()[0].name: row})[-1]
            positive = float(out[0, 1]) if out.ndim == 2 and out.shape[1] > 1 else float(out[0])
            result[key.replace("ncd_", "") + "_risk"] = round(positive, 6)
        return result

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "model_version": self.model_version,
            "models": {name: meta.get("status") for name, meta in self.models.items()},
        }

    def _proba(self, name: str, row: np.ndarray) -> np.ndarray:
        """Run an ONNX session and return the probability row."""
        if name not in self.sessions:
            raise RuntimeError(f"Model not loaded: {name}")
        session = self.sessions[name]
        out = session.run(None, {session.get_inputs()[0].name: row})[-1]
        if out.ndim == 1:
            out = out.reshape(1, -1)
        if out.shape[1] > 1:
            # Tree-ensemble converters may return raw scores; softmax them so
            # probabilities sum to ~1.
            exp = np.exp(out - out.max(axis=1, keepdims=True))
            proba = exp / exp.sum(axis=1, keepdims=True)
        else:
            proba = np.hstack([1.0 - out, out])
        return proba


def _sorted_labels(labels: list[str], size: int) -> list[str]:
    """Return label names aligned to ONNX softmax column order (sorted)."""
    ordered = sorted(labels)
    return ordered[:size]


def _feature_row(features: dict[str, Any], domain: str) -> np.ndarray:
    """Build a float32 feature row from raw JSON values.

    String categoricals are mapped to their numeric codes (see
    ``src.features.engineering.CATEGORY_CODES``) so the row can be fed
    directly to the ONNX model.
    """
    names = _FEATURE_NAMES[domain]
    row = []
    for name in names:
        value = features.get(name)
        if name in CATEGORY_CODES:
            mapping = CATEGORY_CODES[name]
            key = str(value).strip() if value is not None else ""
            row.append(float(mapping.get(key, 0.0)))
            continue
        if isinstance(value, bool):
            row.append(1.0 if value else 0.0)
            continue
        if isinstance(value, str):
            row.append(1.0 if str(value).strip().lower() in {"1", "true", "yes", "y"} else 0.0)
            continue
        if value is None:
            value = 0.0
        row.append(float(value))
    return np.asarray([row], dtype=np.float32)


def _margin_confidence(proba: np.ndarray) -> float:
    probs = np.asarray(proba, dtype=float)
    if probs.size == 2:
        return float(np.clip(abs(probs[0] - 0.5) * 2.0, 0.0, 1.0))
    top = probs.max()
    second = np.partition(probs, -2)[-2] if probs.size > 1 else 0.0
    return float(np.clip(top - second, 0.0, 1.0))


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.load_all()
    return _registry


def create_app() -> Any:
    """Build the FastAPI application (FastAPI must be installed)."""
    if not _FASTAPI_AVAILABLE:  # pragma: no cover
        raise RuntimeError(
            "FastAPI is not installed. Install extra: pip install '.[serving]'"
        )

    app = FastAPI(title="ASHA Sathi ML Serving", version="1.0.0")
    registry = get_registry()

    class MaternalRequest(BaseModel):
        data: dict[str, Any] = Field(..., description="Maternal ANC features")

    class ChildRequest(BaseModel):
        data: dict[str, Any] = Field(..., description="Child growth features")

    class NcdRequest(BaseModel):
        data: dict[str, Any] = Field(..., description="NCD screening features")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return registry.health()

    @app.post("/predict/maternal")
    def predict_maternal(req: MaternalRequest) -> dict[str, Any]:
        try:
            return registry.predict_maternal(req.data)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/predict/child")
    def predict_child(req: ChildRequest) -> dict[str, Any]:
        try:
            return registry.predict_child(req.data)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/predict/ncd")
    def predict_ncd(req: NcdRequest) -> dict[str, Any]:
        try:
            return registry.predict_ncd(req.data)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return app


# Module-level `app` for `uvicorn src.serving.inference:app`.
app = create_app() if _FASTAPI_AVAILABLE else None  # type: ignore[assignment]
