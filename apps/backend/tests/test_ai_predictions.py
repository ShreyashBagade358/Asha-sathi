"""AI prediction endpoint tests.

Covers the ONNX-backed inference path (models present in the registry) and the
rule-based fallback (models unavailable), plus the model inventory endpoint.
"""

import uuid

import pytest

from app.ml.service import ml_service

pytestmark = pytest.mark.asyncio


def _bid() -> str:
    return f"TEST-{uuid.uuid4().hex[:12]}"


async def test_maternal_risk_predict(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.post(
        "/api/v1/ai/maternal-risk/predict",
        headers=headers,
        json={
            "beneficiary_id": _bid(),
            "age": 42,
            "gravida": 5,
            "parity": 4,
            "gestational_weeks": 30,
            "bp_systolic": 165,
            "bp_diastolic": 102,
            "hemoglobin": 6.5,
            "bmi": 31,
            "previous_csection": True,
            "htn": True,
            "anc_visits_attended": 1,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["model_name"] == "maternal_risk"
    assert body["prediction"]["risk_level"] in {"high", "low", "medium"}
    assert 0.0 <= body["confidence"] <= 1.0
    method = body["explanation"]["method"]
    if ml_service.model_availability()["maternal_risk"]:
        assert method == "onnx"
        assert body["prediction"]["risk_level"] == "high"
    else:
        assert method == "rule_based_heuristic"


async def test_child_growth_predict(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.post(
        "/api/v1/ai/child-growth/predict",
        headers=headers,
        json={
            "beneficiary_id": _bid(),
            "age_months": 18,
            "sex": "M",
            "weight_kg": 6.2,
            "height_cm": 74,
            "muac_mm": 108,
            "birth_weight_grams": 2600,
            "gestation_weeks": 34,
            "breastfeeding": "none",
            "diarrhea_episodes": 3,
            "immunization_complete": False,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["model_name"] == "child_growth"
    assert body["prediction"]["nutrition_status"] in {
        "severe_acute_malnutrition",
        "moderate_acute_malnutrition",
        "underweight",
        "normal",
    }
    method = body["explanation"]["method"]
    if ml_service.model_availability()["child_growth"]:
        assert method == "onnx"
        assert body["prediction"]["nutrition_status"] == "severe_acute_malnutrition"
    else:
        assert method == "rule_based_heuristic"


async def test_ncd_risk_predict(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.post(
        "/api/v1/ai/ncd-risk/predict",
        headers=headers,
        json={
            "beneficiary_id": _bid(),
            "age": 52,
            "sex": "M",
            "height_cm": 172,
            "weight_kg": 100,
            "bmi": 33.9,
            "tobacco_use": True,
            "waist_circumference_cm": 104,
            "physical_activity": "low",
            "family_history_diabetes": True,
            "family_history_hypertension": True,
            "bp_systolic": 145,
            "bp_diastolic": 92,
            "blood_sugar_random": 190,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["model_name"] == "ncd_risk"
    prediction = body["prediction"]
    for key in ("overall_risk", "diabetes_risk", "hypertension_risk"):
        assert prediction[key] in {"low", "moderate", "high"}
    assert isinstance(prediction["cbac_score"], int)
    assert 0.0 <= body["confidence"] <= 1.0
    method = body["explanation"]["method"]
    if ml_service.model_availability()["ncd_risk"]:
        assert method == "onnx"
        assert prediction["diabetes_risk"] == "high"
        assert prediction["hypertension_risk"] == "high"
    else:
        assert method == "rule_based_heuristic"


async def test_models_endpoint_reflects_availability(client, auth_headers):
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.get("/api/v1/ai/models", headers=headers)
    assert resp.status_code == 200, resp.text
    models = {m["name"]: m for m in resp.json()}
    availability = ml_service.model_availability()
    assert set(models) == set(availability)
    for name, available in availability.items():
        assert models[name]["status"] == ("available" if available else "unavailable")


async def test_fallback_to_heuristic_when_model_unavailable(monkeypatch, client, auth_headers):
    forced = {
        "maternal_risk": None,
        "child_growth": None,
        "ncd_diabetes": None,
        "ncd_hypertension": None,
    }
    monkeypatch.setattr(ml_service, "_sessions", forced)
    headers = await auth_headers(phone="9876543210", role="asha")
    resp = await client.post(
        "/api/v1/ai/maternal-risk/predict",
        headers=headers,
        json={"beneficiary_id": _bid(), "age": 42, "gravida": 5, "hemoglobin": 6.5, "bp_systolic": 165},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["explanation"]["method"] == "rule_based_heuristic"
    assert body["prediction"]["risk_level"] == "high"
