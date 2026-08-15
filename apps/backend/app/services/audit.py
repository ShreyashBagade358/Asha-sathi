from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    status: str = "success",
    error_message: str | None = None,
    **extra: Any,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        old_values=old_values,
        new_values=new_values,
        changed_fields=sorted(set((old_values or {}).keys()) | set((new_values or {}).keys())),
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
        status=status,
        error_message=error_message,
        **extra,
    )
    db.add(entry)
    await db.flush()
    return entry
