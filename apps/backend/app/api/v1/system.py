import time
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.beneficiary import Beneficiary
from app.models.maternal import Pregnancy
from app.models.user import User

router = APIRouter()

API_VERSION = "1.0.0"


def _started_at(request: Request) -> datetime:
    value = getattr(request.app.state, "started_at", None)
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            value = None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value
    return datetime.now(UTC)


async def _database_status(db: AsyncSession) -> dict:
    started = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {"status": "ok", "latency_ms": latency_ms}
    except Exception:
        return {"status": "error", "latency_ms": int((time.perf_counter() - started) * 1000)}


def _models_status() -> dict:
    try:
        from app.ml.service import ml_service

        availability = ml_service.model_availability()
        return {
            "available": sum(1 for available in availability.values() if available),
            "total": len(availability),
        }
    except Exception:
        return {"available": 0, "total": 0}


async def _counts_status(db: AsyncSession) -> dict:
    try:
        users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        ashas = (
            await db.execute(select(func.count()).select_from(User).where(User.role == "asha"))
        ).scalar_one()
        beneficiaries = (await db.execute(select(func.count()).select_from(Beneficiary))).scalar_one()
        pregnancies = (await db.execute(select(func.count()).select_from(Pregnancy))).scalar_one()
        return {
            "users": int(users),
            "asha_workers": int(ashas),
            "beneficiaries": int(beneficiaries),
            "pregnancies": int(pregnancies),
        }
    except Exception:
        return {
            "users": 0,
            "asha_workers": 0,
            "beneficiaries": 0,
            "pregnancies": 0,
            "status": "error",
        }


@router.get("/status")
async def system_status(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
):
    now = datetime.now(UTC)
    started_at = _started_at(request)
    try:
        uptime_seconds = max(int((now - started_at).total_seconds()), 0)
    except Exception:
        uptime_seconds = 0

    return {
        "api": {
            "status": "ok",
            "version": getattr(request.app, "version", None) or API_VERSION,
            "started_at": started_at.isoformat(),
            "uptime_seconds": uptime_seconds,
        },
        "database": await _database_status(db),
        "models": _models_status(),
        "counts": await _counts_status(db),
    }
