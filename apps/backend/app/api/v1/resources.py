from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_roles
from app.core.exceptions import NotFoundError
from app.models.admin import PHC, Block
from app.models.resource import ResourceAllocation
from app.models.user import Role, User
from app.schemas.resource import ResourceAllocationCreate, ResourceAllocationResponse

router = APIRouter()

ADMIN_ONLY = require_roles(Role.ADMIN)


async def _resolve_district(db: AsyncSession, phc: PHC, district_id: str | None) -> str | None:
    if district_id is not None:
        return district_id
    return (
        await db.execute(
            select(Block.district_id).select_from(PHC).join(Block, PHC.block_id == Block.id).where(PHC.id == phc.id)
        )
    ).scalar_one_or_none()


def _to_response(allocation: ResourceAllocation, phc_name: str) -> ResourceAllocationResponse:
    return ResourceAllocationResponse(
        id=allocation.id,
        phc_id=allocation.phc_id,
        phc_name=phc_name,
        resource_type=allocation.resource_type,
        quantity=allocation.quantity,
        notes=allocation.notes,
        district_id=allocation.district_id,
        created_at=allocation.created_at,
    )


@router.post("/allocations", status_code=201, response_model=ResourceAllocationResponse)
async def create_allocation(
    payload: ResourceAllocationCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(ADMIN_ONLY),
):
    phc = await db.get(PHC, payload.phc_id)
    if not phc:
        raise NotFoundError("PHC not found")

    district_id = await _resolve_district(db, phc, payload.district_id)
    allocation = ResourceAllocation(
        district_id=district_id,
        phc_id=phc.id,
        resource_type=payload.resource_type,
        quantity=payload.quantity,
        notes=payload.notes,
        created_by=user.id,
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return _to_response(allocation, phc.name)


@router.get("/allocations", response_model=list[ResourceAllocationResponse])
async def list_allocations(
    district_id: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(ADMIN_ONLY),
):
    effective_district = district_id or user.district_id
    stmt = select(ResourceAllocation, PHC.name.label("phc_name")).join(
        PHC, ResourceAllocation.phc_id == PHC.id
    )
    if effective_district:
        stmt = stmt.where(ResourceAllocation.district_id == effective_district)
    stmt = stmt.order_by(ResourceAllocation.created_at.desc(), ResourceAllocation.id.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()
    return [_to_response(allocation, phc_name) for allocation, phc_name in rows]
