import os
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("ml_service")


class MLService:
    """Prediction service.

    TODO: Load ONNX models from the model registry (settings.model_registry_path) once
    models are exported. Currently a transparent rule-based heuristic is used as a fallback
    so the endpoints are functional end-to-end.
    """

    def _load_model(self, name: str) -> Any | None:
        if not settings.model_registry_path or not os.path.isdir(settings.model_registry_path):
            return None
        model_file = os.path.join(settings.model_registry_path, f"{name}.onnx")
        if os.path.exists(model_file):
            try:
                import onnxruntime as ort

                return ort.InferenceSession(model_file)
            except ImportError:
                logger.warning("onnxruntime_not_installed", model=name)
        return None

    def _version(self, name: str) -> str:
        return str(settings.model_versions.get(name, "1.0.0"))

    async def predict_maternal_risk(self, features: dict[str, Any]) -> dict[str, Any]:
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

    async def predict_child_growth(self, features: dict[str, Any]) -> dict[str, Any]:
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

        confidence = 0.9 if status == "normal" else 0.85
        return {
            "model": "child_growth",
            "version": self._version("child_growth"),
            "prediction": {"nutrition_status": status},
            "confidence": confidence,
            "explanation": {"factors": factors, "method": "rule_based_heuristic"},
        }

    async def predict_ncd_risk(self, features: dict[str, Any]) -> dict[str, Any]:
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
