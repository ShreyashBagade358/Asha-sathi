from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.other_domain import ABHACreate, ABHAResponse
from app.services.abdm import ABDMGateway
from app.services.audit import log_action

router = APIRouter()

gateway = ABDMGateway()


class HealthRecordPush(BaseModel):
    abha_record_id: str
    record_type: str
    document: dict


class ConsentRequest(BaseModel):
    abha_record_id: str
    hiu_id: str
    purpose_code: str
    hi_types: list[str]
    permission_days: int = 90


@router.post("/abha/create", response_model=ABHAResponse)
async def create_abha(
    payload: ABHACreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Create an ABHA address. Uses ABDM gateway mock; real integration requires ABDM creds."""
    # TODO(ABDM): call gateway with real credentials once available
    await gateway.health_id_phone_verification(payload.linked_mobile or "")
    from app.core.security import generate_secure_id
    from app.models.abha import ABHARecord

    record = ABHARecord(
        beneficiary_id=payload.beneficiary_id,
        abha_number=generate_secure_id("ABHA"),
        abha_address=generate_secure_id("abha"),
        creation_method=payload.creation_method,
        linked_mobile=payload.linked_mobile,
        linked_email=payload.linked_email,
        kyc_status="created",
    )
    db.add(record)
    await db.flush()
    await log_action(db, user.id, "abha_created", "abha_record", record.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/abha/link")
async def link_abha(
    abha_number: str,
    linked_mobile: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    """Link an existing ABHA to a beneficiary. Mock gateway response."""
    txn = await gateway.generate_mobile_link_token(abha_number, linked_mobile)
    await log_action(
        db, user.id, "abha_link_initiated", "abha_record", abha_number, new_values={"mobile": linked_mobile}
    )
    await db.commit()
    return {"status": "link_initiated", "txn": txn, "mock": True}


@router.get("/abha/{record_id}/status")
async def get_abha_status(
    record_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    from app.core.exceptions import NotFoundError
    from app.models.abha import ABHARecord

    record = await db.get(ABHARecord, record_id)
    if not record:
        raise NotFoundError("ABHA record not found")
    gateway_status = await gateway.get_health_id_status(record.abha_number)
    return {"record": record.to_dict(), "gateway": gateway_status, "mock": True}


@router.post("/health-records/push")
async def push_health_records(
    payload: HealthRecordPush,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    from app.core.security import generate_secure_id
    from app.models.abha import HealthRecord

    document_id = generate_secure_id("DOC")
    push = await gateway.push_health_records(document_id, payload.document)
    record = HealthRecord(
        abha_record_id=payload.abha_record_id,
        record_type=payload.record_type,
        document_id=document_id,
        document_json=payload.document,
        status="pushed",
    )
    db.add(record)
    await db.flush()
    await log_action(
        db, user.id, "health_record_pushed", "health_record", record.id, new_values={"document_id": document_id}
    )
    await db.commit()
    return {"status": "pushed", "document_id": document_id, "gateway": push, "mock": True}


@router.get("/health-records/pull")
async def pull_health_records(
    document_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    from app.core.exceptions import NotFoundError
    from app.models.abha import HealthRecord

    result = await db.execute(select(HealthRecord).where(HealthRecord.document_id == document_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("Health record not found")
    gateway_data = await gateway.get_health_records(document_id)
    return {"record": record.to_dict(), "gateway": gateway_data, "mock": True}


@router.post("/consent/request")
async def request_consent(
    payload: ConsentRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    from app.core.security import generate_secure_id
    from app.models.abha import ConsentArtifact

    resp = await gateway.create_consent_request(payload.model_dump())
    artifact = ConsentArtifact(
        artifact_id=generate_secure_id("CA"),
        abha_record_id=payload.abha_record_id,
        hiu_id=payload.hiu_id,
        purpose_codes={"purpose": [payload.purpose_code]},
        hi_types=payload.hi_types,
        status="REQUESTED",
    )
    db.add(artifact)
    await db.flush()
    await log_action(
        db, user.id, "consent_requested", "consent_artifact", artifact.artifact_id, new_values=payload.model_dump()
    )
    await db.commit()
    return {"status": "requested", "artifact_id": artifact.artifact_id, "gateway": resp, "mock": True}
