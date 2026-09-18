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

    @staticmethod
    def _is_bypass(phone: str) -> bool:
        """Dev-only: phone is enrolled in the fixed-OTP login bypass."""
        return settings.app_env == "dev" and phone in settings.dev_bypass_users

    @staticmethod
    def _fixed_code_matches(code: str) -> bool:
        """True if [code] equals the dev fixed OTP, in any sane digit layout."""
        fixed = settings.dev_otp_code
        if not fixed:
            return False
        try:
            return int(code.strip()) == int(fixed)
        except ValueError:
            return False

    @staticmethod
    def bypass_role(phone: str) -> str | None:
        """The role the bypass expects for [phone], if phone is a bypass login."""
        if settings.app_env == "dev":
            return settings.dev_bypass_users.get(phone)
        return None

    @classmethod
    async def create(cls, phone: str) -> str:
        if cls._is_bypass(phone) and settings.dev_otp_code:
            # Bypass login: fixed code, nothing is generated or stored.
            return settings.dev_otp_code
        if settings.app_env == "dev" and settings.dev_otp_code:
            code = settings.dev_otp_code
        else:
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
        code = code.strip()
        # Bypass: enrolled phones authenticate with the fixed code even if no OTP
        # was ever sent/stored, i.e. login does not depend on the OTP lifecycle.
        if cls._is_bypass(phone) and cls._fixed_code_matches(code):
            return True
        if settings.app_env == "dev" and settings.dev_otp_code and cls._fixed_code_matches(code):
            return True
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
