import json
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

try:
    import numpy as np
    import onnxruntime as ort
except ImportError:  # pragma: no cover - only in envs without onnxruntime
    np = None  # type: ignore[assignment]
    ort = None  # type: ignore[assignment]

logger = get_logger("ml_service")

_DEFAULT_REGISTRY = Path(__file__).resolve().parents[3] / "ml-training" / "artifacts"
# Bundled copy shipped inside the backend image — apps/ml-training/artifacts is
# gitignored and outside the Docker build context, so the deployed container
# would otherwise fall back to rule-based heuristics.
_BUNDLED_REGISTRY = Path(__file__).resolve().parents[2] / "ml_artifacts"

# logical model name -> (metadata directory, onnx file relative to the registry root)
_MODEL_SPECS: dict[str, tuple[str, str]] = {
    "maternal_risk": ("maternal", "onnx/maternal_v1.onnx"),
    "child_growth": ("child", "onnx/child_v1.onnx"),
    "ncd_diabetes": ("ncd", "onnx/ncd_diabetes_v1.onnx"),
    "ncd_hypertension": ("ncd", "onnx/ncd_hypertension_v1.onnx"),
}

# mirrors ml-training feature engineering CATEGORY_CODES
_CATEGORY_CODES: dict[str, dict[str, int]] = {
    "sex": {"M": 0, "F": 1},
    "breastfeeding": {"exclusive": 0, "mixed": 1, "none": 2},
    "physical_activity": {"low": 0, "moderate": 1, "high": 2},
}

_CHILD_LABEL_MAP = {
    "SAM": "severe_acute_malnutrition",
    "MAM": "moderate_acute_malnutrition",
    "normal": "normal",
}


class MLService:
    """Prediction service backed by exported ONNX models with a rule-based fallback.

    Models are loaded lazily from ``settings.model_registry_path`` (falling back to
    ``apps/ml-training/artifacts``). When a model or onnxruntime is unavailable the
    transparent rule-based heuristic answers instead, so endpoints stay functional.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, Any] = {}
        self._metadata_cache: dict[str, dict[str, Any]] = {}

    def _registry_root(self) -> Path:
        if settings.model_registry_path:
            return Path(settings.model_registry_path)
        # Prefer the local training output when present (dev machines), else the
        # copy bundled into the Docker image at apps/backend/ml_artifacts.
        if (_DEFAULT_REGISTRY / "onnx").is_dir():
            return _DEFAULT_REGISTRY
        return _BUNDLED_REGISTRY

    def _session(self, name: str) -> Any | None:
        if name in self._sessions:
            return self._sessions[name]
        session = None
        if ort is None:
            logger.warning("onnxruntime_not_installed", model=name)
        else:
            _, relative = _MODEL_SPECS[name]
            path = self._registry_root() / relative
            if path.is_file():
                try:
                    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
                    logger.info("onnx_model_loaded", model=name, path=str(path))
                except Exception as exc:  # noqa: BLE001
                    logger.warning("onnx_model_load_failed", model=name, error=str(exc))
            else:
                logger.warning("onnx_model_missing", model=name, path=str(path))
        self._sessions[name] = session
        return session

    def _metadata(self, domain: str) -> dict[str, Any]:
        if domain not in self._metadata_cache:
            path = self._registry_root() / domain / "metadata_v1.json"
            self._metadata_cache[domain] = json.loads(path.read_text())
        return self._metadata_cache[domain]

    @staticmethod
    def _num(value: Any) -> float:
        if value is None:
            return float("nan")
        if isinstance(value, bool):
            return 1.0 if value else 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return float("nan")

    @classmethod
    def _code(cls, feature: str, value: Any) -> float:
        if value is None:
            return float("nan")
        if isinstance(value, bool):
            return 1.0 if value else 0.0
        if isinstance(value, (int, float)):
            return float(value)
        mapping = _CATEGORY_CODES.get(feature, {})
        text = str(value).strip()
        if text in mapping:
            return float(mapping[text])
        lowered = {k.lower(): v for k, v in mapping.items()}
        if text.lower() in lowered:
            return float(lowered[text.lower()])
        return float("nan")

    @staticmethod
    def _bmi_from(features: dict[str, Any]) -> float:
        direct = features.get("bmi")
        if direct is not None:
            return MLService._num(direct)
        height = features.get("height_cm")
        weight = features.get("weight_kg")
        if height and weight:
            metres = float(height) / 100.0
            if metres > 0:
                return float(weight) / (metres * metres)
        return float("nan")

    def _run_model(self, name: str, values: dict[str, float]) -> tuple[int, list[float]] | None:
        session = self._session(name)
        if session is None or np is None:
            return None
        try:
            meta = self._metadata(_MODEL_SPECS[name][0])
            row = np.array([[self._num(values.get(f)) for f in meta["features"]]], dtype=np.float32)
            label, probabilities = session.run(None, {session.get_inputs()[0].name: row})
            idx = int(np.asarray(label).reshape(-1)[0])
            probs = [float(p) for p in np.asarray(probabilities, dtype=float).reshape(-1)]
            return idx, probs
        except Exception as exc:  # noqa: BLE001
            logger.warning("onnx_inference_failed", model=name, error=str(exc))
            return None

    def model_availability(self) -> dict[str, bool]:
        return {
            "maternal_risk": self._session("maternal_risk") is not None,
            "child_growth": self._session("child_growth") is not None,
            "ncd_risk": self._session("ncd_diabetes") is not None and self._session("ncd_hypertension") is not None,
        }

    def _version(self, name: str) -> str:
        return str(settings.model_versions.get(name, "1.0.0"))

    # ------------------------------------------------------------------
    # Maternal risk
    # ------------------------------------------------------------------

    def _maternal_rules(self, features: dict[str, Any]) -> tuple[float, list[str]]:
        age = features.get("age") or 0
        gravida = features.get("gravida") or 1
        previous_csection = bool(features.get("previous_csection"))
        previous_miscarriages = features.get("previous_miscarriages") or 0
        hemoglobin = features.get("hemoglobin")
        bp_systolic = features.get("bp_systolic")
        multiple_pregnancy = bool(features.get("multiple_pregnancy"))

        score = 0.0
        factors: list[str] = []
        if age < 18 or age > 35:
            score += 2
            factors.append("extreme_maternal_age")
        if gravida >= 4:
            score += 1
            factors.append("grand_multipara")
        if previous_csection:
            score += 2
            factors.append("previous_csection")
        if previous_miscarriages and previous_miscarriages >= 2:
            score += 1
            factors.append("recurrent_miscarriages")
        if hemoglobin is not None and hemoglobin < 7:
            score += 2
            factors.append("severe_anemia")
        elif hemoglobin is not None and hemoglobin < 11:
            score += 1
            factors.append("anemia")
        if bp_systolic is not None and bp_systolic >= 140:
            score += 2
            factors.append("hypertension")
        if multiple_pregnancy:
            score += 2
            factors.append("multiple_pregnancy")
        return score, factors

    def _predict_maternal_onnx(self, features: dict[str, Any]) -> dict[str, Any] | None:
        lmp_days = features.get("lmp_days_ago")
        gestational_weeks = features.get("gestational_weeks")
        if gestational_weeks is None and lmp_days:
            gestational_weeks = float(lmp_days) / 7.0
        values = {
            "age": self._num(features.get("age")),
            "gravida": self._num(features.get("gravida")),
            "parity": self._num(features.get("parity")),
            "gestational_weeks": self._num(gestational_weeks),
            "bp_systolic": self._num(features.get("bp_systolic")),
            "bp_diastolic": self._num(features.get("bp_diastolic")),
            "hemoglobin": self._num(features.get("hemoglobin")),
            "blood_sugar": self._num(features.get("blood_sugar")),
            "bmi": self._bmi_from(features),
            "previous_csection": self._num(features.get("previous_csection")),
            "previous_pph": self._num(features.get("previous_pph")),
            "previous_preterm": self._num(features.get("previous_preterm")),
            "previous_stillbirth": self._num(features.get("previous_stillbirth")),
            "htn": self._num(features.get("htn")),
            "diabetes": self._num(features.get("diabetes")),
            "heart_disease": self._num(features.get("heart_disease")),
            "kidney_disease": self._num(features.get("kidney_disease")),
            "anc_visits_attended": self._num(features.get("anc_visits_attended")),
            "pmsma_attended": self._num(features.get("pmsma_attended")),
        }
        run = self._run_model("maternal_risk", values)
        if run is None:
            return None
        idx, probs = run
        classes = self._metadata("maternal")["classes"]
        if not 0 <= idx < len(classes):
            return None
        level = classes[idx]
        confidence = probs[idx] if idx < len(probs) else 0.0
        _, factors = self._maternal_rules(features)
        return {
            "model": "maternal_risk",
            "version": self._version("maternal_risk"),
            "prediction": {"risk_level": level, "risk_score": round(confidence, 4)},
            "confidence": round(confidence, 4),
            "explanation": {
                "method": "onnx",
                "model_file": _MODEL_SPECS["maternal_risk"][1],
                "probabilities": {c: round(p, 4) for c, p in zip(classes, probs, strict=False)},
                "risk_factors": factors,
            },
        }

    async def predict_maternal_risk(self, features: dict[str, Any]) -> dict[str, Any]:
        result = self._predict_maternal_onnx(features)
        if result is not None:
            return result

        score, factors = self._maternal_rules(features)
        if score >= 5:
            level = "high"
        elif score >= 2:
            level = "medium"
        else:
            level = "low"
        return {
            "model": "maternal_risk",
            "version": self._version("maternal_risk"),
            "prediction": {"risk_level": level, "risk_score": score},
            "confidence": min(0.95, 0.5 + score * 0.08),
            "explanation": {"risk_factors": factors, "method": "rule_based_heuristic"},
        }

    # ------------------------------------------------------------------
    # Child growth
    # ------------------------------------------------------------------

    def _child_rules(self, features: dict[str, Any]) -> tuple[str, list[str]]:
        age_months = features.get("age_months")
        weight_kg = features.get("weight_kg")
        height_cm = features.get("height_cm")
        muac_mm = features.get("muac_mm")

        status = "normal"
        factors: list[str] = []
        if muac_mm is not None:
            if muac_mm < 115:
                status = "severe_acute_malnutrition"
                factors.append("muac_under_115mm")
            elif muac_mm < 125:
                status = "moderate_acute_malnutrition"
                factors.append("muac_under_125mm")
        if weight_kg is not None and age_months is not None:
            expected = 3.5 + age_months * 0.45
            z_approx = (weight_kg - expected) / (expected * 0.15)
            if z_approx < -2:
                if status == "normal":
                    status = "underweight"
                factors.append("weight_z_approx_below_minus_2")
        if height_cm is not None and weight_kg is not None and height_cm > 0:
            bmi = weight_kg / ((height_cm / 100) ** 2)
            if bmi < 14:
                factors.append("low_bmi")
        return status, factors

    def _predict_child_onnx(self, features: dict[str, Any]) -> dict[str, Any] | None:
        birth_weight_kg = features.get("birth_weight_kg")
        if birth_weight_kg is None and features.get("birth_weight_grams"):
            birth_weight_kg = float(features["birth_weight_grams"]) / 1000.0
        values = {
            "age_months": self._num(features.get("age_months")),
            "sex": self._code("sex", features.get("sex")),
            "weight_kg": self._num(features.get("weight_kg")),
            "height_cm": self._num(features.get("height_cm")),
            "muac_mm": self._num(features.get("muac_mm")),
            "birth_weight_kg": self._num(birth_weight_kg),
            "gestation_weeks": self._num(features.get("gestation_weeks")),
            "breastfeeding": self._code("breastfeeding", features.get("breastfeeding")),
            "complementary_feeding": self._num(features.get("complementary_feeding")),
            "diarrhea_episodes": self._num(features.get("diarrhea_episodes")),
            "immunization_complete": self._num(features.get("immunization_complete")),
        }
        run = self._run_model("child_growth", values)
        if run is None:
            return None
        idx, probs = run
        classes = self._metadata("child")["classes"]
        if not 0 <= idx < len(classes):
            return None
        raw_label = classes[idx]
        confidence = probs[idx] if idx < len(probs) else 0.0
        _, factors = self._child_rules(features)
        return {
            "model": "child_growth",
            "version": self._version("child_growth"),
            "prediction": {"nutrition_status": _CHILD_LABEL_MAP.get(raw_label, raw_label)},
            "confidence": round(confidence, 4),
            "explanation": {
                "method": "onnx",
                "model_file": _MODEL_SPECS["child_growth"][1],
                "model_label": raw_label,
                "probabilities": {c: round(p, 4) for c, p in zip(classes, probs, strict=False)},
                "factors": factors,
            },
        }

    async def predict_child_growth(self, features: dict[str, Any]) -> dict[str, Any]:
        result = self._predict_child_onnx(features)
        if result is not None:
            return result

        status, factors = self._child_rules(features)
        confidence = 0.9 if status == "normal" else 0.85
        return {
            "model": "child_growth",
            "version": self._version("child_growth"),
            "prediction": {"nutrition_status": status},
            "confidence": confidence,
            "explanation": {"factors": factors, "method": "rule_based_heuristic"},
        }

    # ------------------------------------------------------------------
    # NCD risk (diabetes + hypertension models)
    # ------------------------------------------------------------------

    def _ncd_cbac(self, features: dict[str, Any]) -> tuple[int, list[str]]:
        age = features.get("age") or 0
        tobacco = bool(features.get("tobacco_use"))
        alcohol = bool(features.get("alcohol_use"))
        waist = features.get("waist_circumference_cm")
        fam_dm = bool(features.get("family_history_diabetes"))
        fam_htn = bool(features.get("family_history_hypertension"))
        bp_sys = features.get("bp_systolic")
        sugar = features.get("blood_sugar_random")

        score = 0
        factors: list[str] = []
        if age >= 30:
            score += 1
        if age >= 40:
            score += 1
        if tobacco:
            score += 1
            factors.append("tobacco_use")
        if alcohol:
            score += 1
            factors.append("alcohol_use")
        if waist is not None:
            if waist >= 90:
                score += 1
                factors.append("abdominal_obesity")
        if fam_dm:
            score += 1
            factors.append("family_history_diabetes")
        if fam_htn:
            score += 1
            factors.append("family_history_hypertension")
        if bp_sys is not None and bp_sys >= 140:
            score += 2
            factors.append("high_bp")
        if sugar is not None and sugar >= 200:
            score += 2
            factors.append("high_random_sugar")
        elif sugar is not None and sugar >= 140:
            score += 1
            factors.append("elevated_random_sugar")
        return score, factors

    def _predict_ncd_onnx(self, features: dict[str, Any]) -> dict[str, Any] | None:
        values = {
            "age": self._num(features.get("age")),
            "sex": self._code("sex", features.get("sex")),
            "bmi": self._bmi_from(features),
            "waist_cm": self._num(features.get("waist_circumference_cm")),
            "tobacco_use": self._num(features.get("tobacco_use")),
            "alcohol_use": self._num(features.get("alcohol_use")),
            "physical_activity": self._code("physical_activity", features.get("physical_activity")),
            "family_history_diabetes": self._num(features.get("family_history_diabetes")),
            "family_history_hypertension": self._num(features.get("family_history_hypertension")),
            "known_diabetes": self._num(features.get("known_diabetes")),
            "known_hypertension": self._num(features.get("known_hypertension")),
            "bp_systolic": self._num(features.get("bp_systolic")),
            "bp_diastolic": self._num(features.get("bp_diastolic")),
            "blood_sugar_random": self._num(features.get("blood_sugar_random")),
        }
        diabetes_run = self._run_model("ncd_diabetes", values)
        hypertension_run = self._run_model("ncd_hypertension", values)
        if diabetes_run is None or hypertension_run is None:
            return None

        def binary_level(run: tuple[int, list[float]]) -> tuple[str, float]:
            idx, probs = run
            level = "high" if idx == 1 else "low"
            confidence = probs[idx] if 0 <= idx < len(probs) else 0.0
            return level, confidence

        diabetes_risk, diabetes_conf = binary_level(diabetes_run)
        hypertension_risk, hypertension_conf = binary_level(hypertension_run)
        score, factors = self._ncd_cbac(features)
        if "high" in (diabetes_risk, hypertension_risk):
            overall = "high"
        elif score >= 2:
            overall = "moderate"
        else:
            overall = "low"
        return {
            "model": "ncd_risk",
            "version": self._version("ncd_risk"),
            "prediction": {
                "overall_risk": overall,
                "diabetes_risk": diabetes_risk,
                "hypertension_risk": hypertension_risk,
                "cbac_score": score,
            },
            "confidence": round((diabetes_conf + hypertension_conf) / 2, 4),
            "explanation": {
                "method": "onnx",
                "model_files": [_MODEL_SPECS["ncd_diabetes"][1], _MODEL_SPECS["ncd_hypertension"][1]],
                "probabilities": {
                    "diabetes_positive": round(diabetes_run[1][1], 4),
                    "hypertension_positive": round(hypertension_run[1][1], 4),
                },
                "risk_factors": factors,
            },
        }

    async def predict_ncd_risk(self, features: dict[str, Any]) -> dict[str, Any]:
        result = self._predict_ncd_onnx(features)
        if result is not None:
            return result

        score, factors = self._ncd_cbac(features)
        bp_sys = features.get("bp_systolic")
        sugar = features.get("blood_sugar_random")
        diabetes_risk = "high" if (sugar or 0) >= 200 else ("moderate" if score >= 3 else "low")
        hypertension_risk = "high" if (bp_sys or 0) >= 140 else ("moderate" if score >= 3 else "low")
        overall = "high" if score >= 4 else ("moderate" if score >= 2 else "low")
        return {
            "model": "ncd_risk",
            "version": self._version("ncd_risk"),
            "prediction": {
                "overall_risk": overall,
                "diabetes_risk": diabetes_risk,
                "hypertension_risk": hypertension_risk,
                "cbac_score": score,
            },
            "confidence": min(0.9, 0.5 + score * 0.05),
            "explanation": {"risk_factors": factors, "method": "rule_based_heuristic"},
        }


ml_service = MLService()
