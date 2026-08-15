from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.config import settings
from app.ml.service import ml_service
from app.models.ai import AIPrediction
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.other_domain import (
    AIPredictionResponse,
    ChildGrowthRequest,
    MaternalRiskRequest,
    ModelInfo,
    NCDRiskRequest,
)
from app.services.audit import log_action

router = APIRouter()


async def _store_prediction(
    db: AsyncSession,
    user: User,
    model_name: str,
    version: str,
    beneficiary_id: str,
    features: dict,
    result: dict,
) -> AIPrediction:
    prediction = AIPrediction(
        beneficiary_id=beneficiary_id,
        model_name=model_name,
        model_version=version,
        input_features=features,
        prediction=result.get("prediction"),
        confidence=result.get("confidence"),
        explanation=result.get("explanation"),
        triggered_by=user.id,
    )
    db.add(prediction)
    await db.flush()
    await log_action(
        db,
        user.id,
        "ai_prediction",
        "ai_prediction",
        prediction.id,
        new_values={"model": model_name, "result": result.get("prediction")},
    )
    await db.commit()
    await db.refresh(prediction)
    return prediction


@router.post("/maternal-risk/predict", response_model=AIPredictionResponse)
async def predict_maternal_risk(
    payload: MaternalRiskRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    features = payload.model_dump()
    result = await ml_service.predict_maternal_risk(features)
    return await _store_prediction(
        db, user, "maternal_risk", result["version"], payload.beneficiary_id, features, result
    )


@router.post("/child-growth/predict", response_model=AIPredictionResponse)
async def predict_child_growth(
    payload: ChildGrowthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    features = payload.model_dump()
    result = await ml_service.predict_child_growth(features)
    return await _store_prediction(
        db, user, "child_growth", result["version"], payload.beneficiary_id, features, result
    )


@router.post("/ncd-risk/predict", response_model=AIPredictionResponse)
async def predict_ncd_risk(
    payload: NCDRiskRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    features = payload.model_dump()
    result = await ml_service.predict_ncd_risk(features)
    return await _store_prediction(db, user, "ncd_risk", result["version"], payload.beneficiary_id, features, result)


@router.get("/models", response_model=list[ModelInfo])
async def list_models(user: User = Depends(get_current_user)):
    versions = settings.model_versions
    return [ModelInfo(name=name, version=version, status="available") for name, version in versions.items()]


@router.post("/chat")
async def chat(message: str, user: User = Depends(get_current_user)):
    """Mock LLM chat that answers ASHA protocol questions with canned responses."""
    text = (message or "").lower()
    if any(k in text for k in ["anc", "antenatal"]):
        reply = "ANC visits should happen in the 1st trimester (within 12 weeks), then as per protocol - at least 4 visits. Advise iron-folic acid, TT immunization and a facility-based delivery plan."  # noqa: E501
    elif any(k in text for k in ["immuniz", "vaccin"]):
        reply = "Immunization follows the NIP schedule: BCG+OPV0 at birth, Penta+OPV+Rotavirus at 6/10/14 weeks, MR at 9-12 months, booster at 16-24 months."  # noqa: E501
    elif any(k in text for k in ["pnc", "postnatal"]):
        reply = "PNC visits: day 3, day 7, day 14, day 21 and day 42 after delivery. Check mother's vitals, bleeding, breast feeding and newborn danger signs."  # noqa: E501
    else:
        reply = "I can help with questions about ANC, PNC, immunization, NCD screening and family planning as per MoHFW guidelines."  # noqa: E501
    return {"message": reply, "mock": True, "source": "asha_sathi_chat_bot"}


@router.post("/acknowledge/{prediction_id}", response_model=MessageResponse)
async def acknowledge_prediction(
    prediction_id: str,
    action_taken: str = "",
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    prediction = await db.get(AIPrediction, prediction_id)
    if not prediction:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Prediction not found")
    prediction.acknowledged = True
    prediction.acknowledged_by = user.id
    prediction.action_taken = action_taken
    await db.commit()
    return MessageResponse(message="Prediction acknowledged")
