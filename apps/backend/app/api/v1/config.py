from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.admin import PHC, Block, District, State, SubCenter, Village
from app.models.config import AppConfig
from app.models.user import ASHAProfile, Role, User
from app.schemas.admin import VillageCreate
from app.schemas.common import MessageResponse
from app.schemas.config import ConfigUpdateRequest, ConfigUpdateResponse

router = APIRouter()

ADMIN_ONLY = require_roles(Role.ADMIN)


@router.put("/app", response_model=ConfigUpdateResponse)
async def update_app_config(
    payload: ConfigUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(ADMIN_ONLY),
):
    items: list[AppConfig] = []
    for entry in payload.configs:
        row = (
            await db.execute(select(AppConfig).where(AppConfig.config_key == entry.config_key))
        ).scalar_one_or_none()
        if row is None:
            row = AppConfig(
                config_key=entry.config_key,
                config_value=entry.config_value,
                description=entry.description,
                is_public=entry.is_public,
                scope="app",
                created_by=user.id,
            )
            db.add(row)
        else:
            if "config_value" in entry.model_fields_set:
                row.config_value = entry.config_value
            if "description" in entry.model_fields_set:
                row.description = entry.description
            if "is_public" in entry.model_fields_set:
                row.is_public = entry.is_public
            row.version = (row.version or 1) + 1
        items.append(row)
    await db.commit()

    return {
        "updated": len(items),
        "items": [
            {
                "config_key": row.config_key,
                "config_value": row.config_value,
                "scope": row.scope,
                "is_public": row.is_public,
                "version": row.version,
            }
            for row in items
        ],
    }


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


@router.get("/my-region")
async def my_region(db: AsyncSession = Depends(get_db_session), user: User = Depends(get_current_user)):
    """The signed-in worker's own geography, in one round trip.

    The offline-first mobile forms need the state / district / village selects
    (and the PHC they imply) without a chain of cascading calls: an ASHA gets
    her assigned state, district, PHC and her catchment villages; anyone
    without a personal village (admin, supervisor) gets their PHC's villages.
    The phone caches the response after login so the fields still work with no
    signal.
    """
    state = await db.get(State, user.state_id) if user.state_id else None
    district = await db.get(District, user.district_id) if user.district_id else None
    phc = await db.get(PHC, user.phc_id) if user.phc_id else None

    village_ids: list[str] = [user.village_id] if user.village_id else []
    profile = (
        await db.execute(select(ASHAProfile).where(ASHAProfile.user_id == user.id))
    ).scalar_one_or_none()
    for vid in (profile.catchment_villages or []) if profile and profile.catchment_villages else []:
        if vid and vid not in village_ids:
            village_ids.append(vid)

    villages: list[dict] = []
    # Flattened with the district id so the client can cascade
    # state -> district -> village offline without the four-hop lookup.
    base = (
        select(Village, District.id.label("district_id"))
        .join(SubCenter, SubCenter.id == Village.sub_center_id)
        .join(PHC, PHC.id == SubCenter.phc_id)
        .join(Block, Block.id == PHC.block_id)
        .join(District, District.id == Block.district_id)
        .where(Village.is_active.is_(True))
        .order_by(Village.name)
    )
    if village_ids:
        result = await db.execute(base.where(Village.id.in_(village_ids)))
        villages = [{**row[0].to_dict(), "district_id": str(row[1])} for row in result.all()]
    elif user.phc_id:
        result = await db.execute(base.where(PHC.id == user.phc_id))
        villages = [{**row[0].to_dict(), "district_id": str(row[1])} for row in result.all()]

    return {
        "state": state.to_dict() if state else None,
        "district": district.to_dict() if district else None,
        "phc": phc.to_dict() if phc else None,
        "villages": villages,
    }
