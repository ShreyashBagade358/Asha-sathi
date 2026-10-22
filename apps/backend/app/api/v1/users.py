from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, require_roles
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import generate_asha_password, get_password_hash
from app.models.admin import PHC, District, State
from app.models.user import ASHAProfile, Role, User
from app.schemas.common import MessageResponse, PaginatedResponse, paginate
from app.schemas.user import AvatarResponse, UserCreate, UserCreateResponse, UserResponse, UserUpdate
from app.services import images
from app.services import storage as storage_svc
from app.services.audit import log_action

router = APIRouter()

ADMIN_ONLY = require_roles(Role.ADMIN)


def _check_avatar_owner(user: User, user_id: str) -> None:
    """`require_roles` cannot express "self or admin", so enforce it here."""
    if user.id != user_id and user.role != Role.ADMIN.value:
        raise PermissionDeniedError("Only this user or an admin may manage this avatar")


async def _with_geo(db: AsyncSession, user: User) -> UserResponse:
    resp = UserResponse.model_validate(user)
    if user.state_id:
        state = await db.get(State, user.state_id)
        resp.state_name = state.name if state else None
    if user.district_id:
        district = await db.get(District, user.district_id)
        resp.district_name = district.name if district else None
    if user.phc_id:
        phc = await db.get(PHC, user.phc_id)
        resp.phc_name = phc.name if phc else None
    return resp


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
    filters = []
    if q:
        filters.append(or_(User.full_name.ilike(f"%{q}%"), User.phone.ilike(f"%{q}%")))
    if role:
        filters.append(User.role == role)
    if state_id:
        filters.append(User.state_id == state_id)
    total = (await db.execute(select(func.count()).select_from(select(User).where(*filters).subquery()))).scalar_one()
    joined = (
        select(
            User,
            State.name.label("state_name"),
            District.name.label("district_name"),
            PHC.name.label("phc_name"),
        )
        .select_from(User)
        .outerjoin(State, User.state_id == State.id)
        .outerjoin(District, User.district_id == District.id)
        .outerjoin(PHC, User.phc_id == PHC.id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for user, state_name, district_name, phc_name in (await db.execute(joined)).all():
        resp = UserResponse.model_validate(user)
        resp.state_name = state_name
        resp.district_name = district_name
        resp.phc_name = phc_name
        items.append(resp)
    return paginate(items, total, page, page_size)


@router.post("", response_model=UserCreateResponse, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    existing = (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none()
    if existing:
        raise ConflictError("User with this phone already exists")
    # Every new account gets a usable credential: the caller's own password if
    # they supplied one, otherwise a generated one. Returned here in plaintext
    # for the one and only time — only the bcrypt hash is stored.
    password = payload.password or generate_asha_password(payload.phone)
    user = User(**payload.model_dump(exclude={"password"}))
    user.hashed_password = get_password_hash(password)
    db.add(user)
    await db.flush()
    if payload.role == Role.ASHA.value:
        profile = ASHAProfile(user_id=user.id, asha_id=f"ASHA-{user.id[:8].upper()}")
        db.add(profile)
    await log_action(
        db, user.id, "user_created", "user", user.id, new_values=payload.model_dump(exclude={"password"})
    )
    await db.commit()
    await db.refresh(user)
    created = await _with_geo(db, user)
    return UserCreateResponse(**created.model_dump(), password=password)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(ADMIN_ONLY),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    return await _with_geo(db, user)


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
    return await _with_geo(db, user)


@router.post("/{user_id}/avatar", response_model=AvatarResponse)
async def upload_avatar(
    user_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    _check_avatar_owner(user, user_id)
    target = await db.get(User, user_id)
    if not target:
        raise NotFoundError("User not found")
    data, ext = await images.read_image(file)
    avatar_url = await storage_svc.upload(
        f"avatars/{user_id}.{ext}",
        data,
        content_type=file.content_type or "image/jpeg",
        bucket="avatars",
    )
    target.avatar_url = avatar_url
    await log_action(db, user.id, "avatar_uploaded", "user", user_id, new_values={"avatar_url": avatar_url})
    await db.commit()
    return AvatarResponse(avatar_url=avatar_url)


@router.delete("/{user_id}/avatar", response_model=MessageResponse)
async def delete_avatar(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
):
    _check_avatar_owner(user, user_id)
    target = await db.get(User, user_id)
    if not target:
        raise NotFoundError("User not found")
    if target.avatar_url:
        parsed = storage_svc.bucket_and_path_from_url(target.avatar_url)
        if parsed:
            storage_svc.delete(parsed[1], bucket=parsed[0])
    target.avatar_url = None
    await log_action(db, user.id, "avatar_deleted", "user", user_id)
    await db.commit()
    return MessageResponse(message="Avatar removed")


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
        Role.ADMIN.value: ["*"],
    }
    return {"user_id": user.id, "role": user.role, "permissions": role_permissions.get(user.role, [])}
