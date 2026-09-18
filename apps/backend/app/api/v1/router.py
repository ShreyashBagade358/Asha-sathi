from fastapi import APIRouter

from app.api.v1 import (
    abdm,
    ai,
    ashas,
    audit,
    auth,
    beneficiaries,
    children,
    config,
    consent,
    dashboard,
    deaths,
    diseases,
    eligible_couples,
    households,
    ncd,
    notifications,
    pregnancies,
    referrals,
    reporting,
    sanitize,
    sync,
    users,
    vaccination,
    verification,
)
from app.core.config import settings

api_router = APIRouter(prefix=settings.api_v1_prefix)

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(ashas.router, prefix="/ashas", tags=["ashas"])
api_router.include_router(households.router, prefix="/households", tags=["households"])
api_router.include_router(beneficiaries.router, prefix="/beneficiaries", tags=["beneficiaries"])
api_router.include_router(pregnancies.router, prefix="/pregnancies", tags=["pregnancies"])
api_router.include_router(children.router, prefix="/children", tags=["children"])
api_router.include_router(eligible_couples.router, prefix="/eligible-couples", tags=["eligible couples"])
api_router.include_router(ncd.router, prefix="/ncd", tags=["ncd"])
api_router.include_router(diseases.router, prefix="/diseases", tags=["diseases"])
api_router.include_router(deaths.router, prefix="/deaths", tags=["deaths"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(vaccination.router, prefix="/vaccination", tags=["vaccination"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(referrals.router, prefix="/referrals", tags=["referrals"])
api_router.include_router(reporting.router, prefix="/reports", tags=["reporting"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(abdm.router, prefix="/abdm", tags=["abdm"])
api_router.include_router(sanitize.router, prefix="/sanitize", tags=["sanitize"])
