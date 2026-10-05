"""
Shared Python Data Models & Type Specifications for ASHA Sathi Platform
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ASHA = "asha"
    PHC_ADMIN = "phc_admin"
    PATIENT = "patient"
    DISTRICT_ADMIN = "district_admin"
    STATE_ADMIN = "state_admin"
    SUPER_ADMIN = "super_admin"


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class ChildHealthStatus(str, Enum):
    NORMAL = "normal"
    MODERATE_UNDERWEIGHT = "moderate_underweight"
    SEVERELY_MALNOURISHED = "severely_malnourished"
    AT_RISK = "at_risk"


class ReferralUrgency(str, Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class ReferralStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class UserBase(BaseModel):
    id: str
    phone: str
    full_name: str
    role: UserRole
    is_active: bool = True


class BeneficiaryBase(BaseModel):
    id: str
    household_id: Optional[str] = None
    full_name: str
    gender: str
    date_of_birth: str
    phone: Optional[str] = None
    abha_id: Optional[str] = None
    is_pregnant: bool = False


class SyncOperationModel(BaseModel):
    id: str
    entity_type: str
    operation: str
    payload: Dict[str, Any]
    client_timestamp: str


class SyncBatchRequestModel(BaseModel):
    device_id: str
    last_watermark: str
    operations: List[SyncOperationModel]
