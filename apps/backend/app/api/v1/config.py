from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.config import AppConfig
from app.models.user import User
from app.schemas.admin import VillageCreate
from app.schemas.common import MessageResponse

router = APIRouter()


@router.get("/app", response_model=MessageResponse)
async def public_app_config(db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    await db.execute(select(AppConfig).where(AppConfig.is_public.is_(True)))
    return MessageResponse(message="public config loaded")


@router.get("/app/full")
async def full_app_config(db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    result = await db.execute(select(AppConfig).order_by(AppConfig.config_key))
    rows = result.scalars().all()
    return {
        "app_name": "ASHA Sathi API",
        "items": [
            {
                "config_key": row.config_key,
                "config_value": row.config_value,
                "scope": row.scope,
                "is_public": row.is_public,
                "version": row.version,
            }
            for row in rows
        ],
    }


@router.get("/states")
async def list_states(db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    result = await db.execute(select(State).where(State.is_active.is_(True)).order_by(State.name))
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/states/{state_id}/districts")
async def list_districts(
    state_id: str, db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)
):
    state = await db.get(State, state_id)
    if not state:
        raise NotFoundError("State not found")
    result = await db.execute(select(District).where(District.state_id == state_id, District.is_active.is_(True)))
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/districts/{district_id}/blocks")
async def list_blocks(
    district_id: str, db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)
):
    result = await db.execute(select(Block).where(Block.district_id == district_id, Block.is_active.is_(True)))
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/blocks/{block_id}/phcs")
async def list_phcs(block_id: str, db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    result = await db.execute(select(PHC).where(PHC.block_id == block_id, PHC.is_active.is_(True)))
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/phc/{phc_id}")
async def get_phc(phc_id: str, db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    phc = await db.get(PHC, phc_id)
    if not phc:
        raise NotFoundError("PHC not found")
    data = phc.to_dict()
    sub_centers = (await db.execute(select(SubCenter).where(SubCenter.phc_id == phc_id))).scalars().all()
    data["sub_centers"] = [sc.to_dict() for sc in sub_centers]
    return data


@router.get("/phc/{phc_id}/villages")
async def list_phc_villages(
    phc_id: str, db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)
):
    phc = await db.get(PHC, phc_id)
    if not phc:
        raise NotFoundError("PHC not found")
    sc_ids = list((await db.execute(select(SubCenter.id).where(SubCenter.phc_id == phc_id))).scalars().all())
    if not sc_ids:
        return []
    result = await db.execute(select(Village).where(Village.sub_center_id.in_(sc_ids), Village.is_active.is_(True)))
    return [row.to_dict() for row in result.scalars().all()]


@router.post("/phc/{phc_id}/villages", status_code=201)
async def create_phc_village(
    phc_id: str,
    payload: VillageCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    phc = await db.get(PHC, phc_id)
    if not phc:
        raise NotFoundError("PHC not found")

    sub_center_id = payload.sub_center_id
    if sub_center_id:
        sub_center = await db.get(SubCenter, sub_center_id)
        if not sub_center or sub_center.phc_id != phc_id:
            raise ValidationError("Sub-center does not belong to this PHC")
    else:
        sub_center_id = (
            await db.execute(select(SubCenter.id).where(SubCenter.phc_id == phc_id).order_by(SubCenter.name))
        ).scalar_one_or_none()
        if not sub_center_id:
            raise ValidationError("PHC has no sub-center; create a sub-center first")

    existing_name = (
        await db.execute(
            select(Village.id).where(Village.name == payload.name, Village.sub_center_id == sub_center_id)
        )
    ).scalar_one_or_none()
    if existing_name:
        raise ConflictError("Village already exists in this sub-center")

    code = payload.code or ""
    if not code:
        count = (await db.execute(select(func.count(Village.id)))).scalar_one()
        base = phc.code.upper()[:4]
        candidate = f"{base}-VLG{count + 1:03d}"
        while (
            await db.execute(select(Village.id).where(Village.code == candidate))
        ).scalar_one_or_none():
            count += 1
            candidate = f"{base}-VLG{count + 1:03d}"
        code = candidate

    duplicate_code = (await db.execute(select(Village.id).where(Village.code == code))).scalar_one_or_none()
    if duplicate_code:
        raise ConflictError("Village code already exists")

    village = Village(
        sub_center_id=sub_center_id,
        code=code,
        name=payload.name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        total_households=payload.total_households,
        total_population=payload.total_population,
    )
    db.add(village)
    await db.commit()
    await db.refresh(village)
    return village.to_dict()
