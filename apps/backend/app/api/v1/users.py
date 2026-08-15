from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import get_password_hash
from app.models.user import ASHAProfile, Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.audit import log_action

router = APIRouter()

ADMIN_ONLY = require_roles(Role.SUPER_ADMIN, Role.STATE_ADMIN)


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    q: str | None = None,
    role: str | None = None,
    state_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    stmt = select(User)
    if q:
        stmt = stmt.where(or_(User.full_name.ilike(f"%{q}%"), User.phone.ilike(f"%{q}%")))
    if role:
        stmt = stmt.where(User.role == role)
    if state_id:
        stmt = stmt.where(User.state_id == state_id)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = result.scalars().all()
    return paginate([UserResponse.model_validate(u) for u in items], total, page, page_size)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    existing = (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none()
    if existing:
        raise ConflictError("User with this phone already exists")
    user = User(**payload.model_dump(exclude={"password"}))
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
    db.add(user)
    await db.flush()
    if payload.role == Role.ASHA.value:
        profile = ASHAProfile(user_id=user.id, asha_id=f"ASHA-{user.id[:8].upper()}")
        db.add(profile)
    await log_action(db, user.id, "user_created", "user", user.id, new_values=payload.model_dump())
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    data = payload.model_dump(exclude_unset=True)
    await log_action(db, user.id, "user_updated", "user", user.id, old_values=user.to_dict(), new_values=data)
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    user.is_active = False
    await log_action(db, user.id, "user_deactivated", "user", user.id, new_values={"is_active": False})
    await db.commit()
    return MessageResponse(message="User deactivated")


@router.get("/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    role_permissions = {
        Role.ASHA.value: ["register_households", "register_beneficiaries", "anc_pnc", "immunization", "sync_offline"],
        Role.ANM.value: ["verify_records", "approve_claims", "reports"],
        Role.MOIC.value: ["approve_claims", "manage_referrals", "reports"],
        Role.BPM.value: ["block_reports", "approve_claims"],
        Role.DPM.value: ["district_reports", "manage_users"],
        Role.STATE_ADMIN.value: ["manage_users", "state_reports", "manage_config"],
        Role.SUPER_ADMIN.value: ["*"],
    }
    return {"user_id": user.id, "role": user.role, "permissions": role_permissions.get(user.role, [])}
