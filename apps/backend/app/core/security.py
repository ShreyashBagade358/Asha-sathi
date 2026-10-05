import random
import secrets
import string
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(subject, "access", delta)


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    delta = expires_delta or timedelta(days=settings.refresh_token_expire_days)
    return _create_token(subject, "refresh", delta)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


def create_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_secure_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def generate_patient_password(phone: str) -> str:
    """Credential for a freshly registered patient.

    Format ``Pat@<last4><4 random>`` (e.g. ``Pat@3216K7m2``): the phone tail lets the
    ASHA worker see which patient the password belongs to, while a random suffix stops
    it being guessable from the phone number alone. Always at least 12 characters.
    """
    suffix = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(4))
    return f"Pat@{phone[-4:]}{suffix}"


def generate_asha_password(phone: str) -> str:
    """Credential handed to a freshly created ASHA worker.

    Format ``Ash@<last4><4 random>`` (e.g. ``Ash@9779K7m2``): same shape as
    :func:`generate_patient_password` but with its own prefix, so a password
    leaked from one account type is not immediately usable against another.
    Always at least 12 characters.
    """
    suffix = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(4))
    return f"Ash@{phone[-4:]}{suffix}"
