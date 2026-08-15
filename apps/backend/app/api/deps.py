from collections.abc import Awaitable, Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import PermissionDeniedError, UnauthorizedError
from app.core.security import decode_token
from app.models.user import Role, User

bearer_scheme = HTTPBearer(auto_error=False)

ADMIN_ROLES = {Role.ANM, Role.MOIC, Role.BPM, Role.DPM, Role.STATE_ADMIN, Role.SUPER_ADMIN}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise UnauthorizedError("Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise UnauthorizedError("Invalid or expired token")
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Token missing subject")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    return user


async def get_db_session(db: AsyncSession = Depends(get_db)) -> AsyncSession:
    return db


def require_roles(*roles: Role) -> Callable[..., Awaitable[User]]:
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in {r.value for r in roles}:
            raise PermissionDeniedError(f"Requires one of roles: {', '.join(r.value for r in roles)}")
        return user

    return checker


get_current_asha = require_roles(Role.ASHA)
get_current_admin = require_roles(*ADMIN_ROLES)
