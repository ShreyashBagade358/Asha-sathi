import random
from datetime import datetime

from app.core.security import generate_secure_id


def generate_hhid(prefix: str = "ASH", state_code: str = "00", seq: int = 0) -> str:
    """Generate a Household ID like ASH-UP-000001."""
    seq_part = str(seq).zfill(6)
    return f"{prefix}-{state_code.upper()}-{seq_part}"


def generate_beneficiary_id() -> str:
    """Beneficiary ID with timestamp + random suffix."""
    ts = datetime.utcnow().strftime("%y%m%d%H%M%S")
    return f"B{ts}{random.randint(1000, 9999)}"


def generate_asha_task_id() -> str:
    return generate_secure_id("TASK")
