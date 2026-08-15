import logging
import random

from app.core.config import settings

logger = logging.getLogger(__name__)

_REDIS_AVAILABLE = True
try:
    import redis.asyncio as aioredis
except Exception:  # pragma: no cover
    _REDIS_AVAILABLE = False

_memory_store: dict[str, str] = {}


class OTPService:
    """Generate and verify OTPs. Uses Redis when available, else an in-memory fallback."""

    @staticmethod
    def _key(phone: str) -> str:
        return f"otp:{phone}"

    @classmethod
    async def create(cls, phone: str) -> str:
        code = f"{random.randint(0, 999999):06d}"
        key = cls._key(phone)
        if _REDIS_AVAILABLE:
            try:
                r = aioredis.from_url(settings.redis_url, decode_responses=True)
                await r.setex(key, settings.otp_expire_minutes * 60, code)
                await r.aclose()
                return code
            except Exception:
                logger.warning("Redis unavailable for OTP create, using in-memory fallback", exc_info=True)
        _memory_store[key] = code
        return code

    @classmethod
    async def verify(cls, phone: str, code: str) -> bool:
        key = cls._key(phone)
        if _REDIS_AVAILABLE:
            try:
                r = aioredis.from_url(settings.redis_url, decode_responses=True)
                stored = await r.get(key)
                if stored is not None:
                    await r.delete(key)
                await r.aclose()
                if stored is not None:
                    return stored == code
            except Exception:
                logger.warning("Redis unavailable for OTP verify, using in-memory fallback", exc_info=True)
        stored = _memory_store.pop(key, None)
        return stored is not None and stored == code
