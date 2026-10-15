"""Conflict-aware, idempotent sync logic used by the /sync endpoints.

Kept out of the route module so it can be unit-tested independently and reused by
background/CLI sync processors later.
"""

import logging
from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy import Date, DateTime, Time, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.security import get_password_hash
from app.models.base import BaseModel
from app.models.sync import SyncDevice, SyncOperation
from app.models.user import Role, User

logger = logging.getLogger("asha.sync")


def _coerce_temporal(column_type: Any, value: Any) -> Any:
    """Convert JSON date/datetime/time strings into native Python objects.

    Mobile clients send temporal fields as ISO strings, but asyncpg's codecs
    require real ``date``/``datetime``/``time`` instances and reject strings with
    an opaque ``'str' object has no attribute 'toordinal'`` DataError.
    """
    if value is None or not isinstance(value, str):
        return value

    if isinstance(column_type, DateTime):
        # Date is a subclass of DateTime, so check it first.
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(column_type, Date):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(column_type, Time):
        try:
            return time.fromisoformat(value)
        except ValueError:
            return value
    return value


def _clean_columns(model: type[BaseModel], data: dict[str, Any]) -> dict[str, Any]:
    """Keep only values that map to real model columns (drops client-side fields).

    Keys may be either the column name or the ORM attribute name — they differ
    for ``Beneficiary.metadata_json``, stored as the ``metadata`` column — and
    the result is keyed by attribute name so ``model(**...)`` and
    ``setattr(...)`` land on the actual field. Values for ``Date``/``DateTime``/
    ``Time`` columns are coerced from the ISO strings the clients send into
    native Python objects.
    """
    mapper = model.__mapper__
    by_key: dict[str, tuple[Any, str]] = {}
    for prop in mapper.column_attrs:
        for column in prop.columns:
            by_key.setdefault(column.name, (column, prop.key))
            by_key.setdefault(prop.key, (column, prop.key))
    cleaned: dict[str, Any] = {}
    for key, value in data.items():
        hit = by_key.get(key)
        if hit is None:
            continue
        column, attr_key = hit
        cleaned[attr_key] = _coerce_temporal(column.type, value)
    return cleaned


async def _ensure_patient_login(
    db: AsyncSession, *, phone: str, full_name: str | None, password: str, beneficiary_id: str | None = None
) -> None:
    """Create the patient's sign-in account on first push of their record.

    Idempotent: a replayed create (or a phone that already has an account)
    leaves the existing user untouched instead of failing the whole push —
    except that a pre-link account (created before ``users.beneficiary_id``
    existed) gets its durable link backfilled the first time we see it here.
    """
    existing = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    if existing is not None:
        if beneficiary_id and not existing.beneficiary_id:
            existing.beneficiary_id = beneficiary_id
            await db.flush()
        return
    db.add(
        User(
            role=Role.PATIENT.value,
            phone=phone,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            language="hi",
            beneficiary_id=beneficiary_id,
        )
    )
    await db.flush()


async def _record_snapshot(db: AsyncSession, record: BaseModel | None) -> dict[str, Any] | None:
    """Serialize a record without tripping async SQLAlchemy's lazy-load rules.

    ``BaseModel.to_dict()`` is synchronous and reads every column via ``getattr``.
    Right after a flush, server-generated columns (``updated_at`` uses
    ``onupdate=func.now()``) are expired, so ``getattr`` would emit a lazy SELECT
    from a non-greenlet context and raise ``MissingGreenlet``. Refreshing first
    populates them.
    """
    if record is None:
        return None
    await db.refresh(record)
    return record.to_dict()


async def _find_idempotent(db: AsyncSession, client_request_id: str) -> SyncOperation | None:
    from sqlalchemy import select

    stmt = select(SyncOperation).where(SyncOperation.client_request_id == client_request_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def apply_operation(
    db: AsyncSession,
    *,
    user_id: str,
    device_id: str | None,
    entity: str,
    operation: str,
    record_id: str,
    version: int,
    data: dict[str, Any],
    client_request_id: str | None,
    model_registry: dict[str, type[BaseModel]],
) -> dict[str, Any]:
    """Apply a single operation inside its own savepoint and return a result dict.

    Idempotent: if ``client_request_id`` was already processed, the stored result
    is replayed without re-applying the change.
    """
    model = model_registry.get(entity)
    if model is None:
        return {
            "client_request_id": client_request_id,
            "entity": entity,
            "operation": operation,
            "status": "failed",
            "error": "unknown_entity",
        }

    sync_op: SyncOperation | None = None
    if client_request_id:
        sync_op = await _find_idempotent(db, client_request_id)
        if sync_op is not None and sync_op.status:
            # Replay the already-computed result exactly. ``sync_op.response`` is
            # the whole stored envelope, so the client-facing "record" must be
            # unwrapped from it - otherwise a retry after a dropped connection
            # hands the mobile client the envelope instead of the record and it
            # would apply nonsense to its local row.
            stored = sync_op.response or {}
            return {
                "client_request_id": client_request_id,
                "entity": sync_op.entity_type,
                "operation": sync_op.operation,
                "status": sync_op.status,
                "server_id": stored.get("server_id"),
                "version": stored.get("version") or (sync_op.version or 1),
                "record": stored.get("record"),
                "conflict_reason": stored.get("conflict_reason"),
                "error": stored.get("error"),
            }

    try:
        async with db.begin_nested():
            record: BaseModel | None = await db.get(model, record_id)

            if operation == "create":
                if record is not None:
                    result = {
                        "client_request_id": client_request_id,
                        "entity": entity,
                        "operation": operation,
                        "status": "success",
                        "server_id": record.id,
                        "version": int(record.version or 1),
                        "record": await _record_snapshot(db, record),
                    }
                else:
                    # The patient's login password travels with the record:
                    # the mobile app generates it at save time (possibly
                    # offline), shows it once, and the account is created here
                    # on first push. _clean_columns drops it - users keep their
                    # own hashed_password column.
                    login_password = data.get("password") if entity == "beneficiaries" else None
                    values = _clean_columns(model, data)
                    values.pop("created_at", None)
                    values.pop("updated_at", None)
                    values.pop("deleted_at", None)
                    values["id"] = record_id
                    values.setdefault("version", 1)
                    # A beneficiary pushed from the field belongs to the worker
                    # who created it - that link is what resolves the patient's
                    # PHC. The client may send registered_by explicitly, but a
                    # missing value must never produce an orphan record.
                    if entity == "beneficiaries" and not values.get("registered_by"):
                        values["registered_by"] = user_id
                    record = model(**values)
                    db.add(record)
                    await db.flush()
                    if login_password and values.get("phone"):
                        await _ensure_patient_login(
                            db,
                            phone=values["phone"],
                            full_name=values.get("full_name"),
                            password=login_password,
                            beneficiary_id=record.id,
                        )
                    result = {
                        "client_request_id": client_request_id,
                        "entity": entity,
                        "operation": operation,
                        "status": "success",
                        "server_id": record.id,
                        "version": int(record.version or 1),
                        "record": await _record_snapshot(db, record),
                    }

            elif operation == "update":
                updates = _clean_columns(model, data)
                updates.pop("id", None)
                updates.pop("created_at", None)
                updates.pop("version", None)
                if record is None:
                    # Client edited a record whose create was never pushed.
                    updates.pop("updated_at", None)
                    updates.pop("deleted_at", None)
                    updates["id"] = record_id
                    updates.setdefault("version", max(version, 1))
                    record = model(**updates)
                    db.add(record)
                    await db.flush()
                else:
                    server_version = int(record.version or 1)
                    if version < server_version:
                        # Stale write: persist nothing and report the server row.
                        # Do NOT return here - the idempotency ledger entry below
                        # must still be written so the conflict is counted and a
                        # retry replays the same response.
                        await db.flush()
                        result = {
                            "client_request_id": client_request_id,
                            "entity": entity,
                            "operation": operation,
                            "status": "conflict",
                            "server_id": record.id,
                            "version": server_version,
                            "record": await _record_snapshot(db, record),
                            "conflict_reason": (
                                f"stale_version: client version {version} < server version {server_version}"
                            ),
                        }
                    else:
                        for key, value in updates.items():
                            setattr(record, key, value)
                        record.version = max(server_version, version) + 1
                        await db.flush()
                        result = {
                            "client_request_id": client_request_id,
                            "entity": entity,
                            "operation": operation,
                            "status": "success",
                            "server_id": record.id,
                            "version": int(record.version or 1),
                            "record": await _record_snapshot(db, record),
                        }

            elif operation == "delete":
                if record is None:
                    result = {
                        "client_request_id": client_request_id,
                        "entity": entity,
                        "operation": operation,
                        "status": "success",
                        "server_id": record_id,
                        "version": None,
                        "record": None,
                    }
                else:
                    # Soft-delete where a status/active flag exists (beneficiaries,
                    # referrals, etc.). Hard delete otherwise.
                    if "status" in {c.name for c in model.__table__.columns} and entity == "beneficiaries":
                        record.status = "inactive"  # type: ignore[attr-defined]
                    elif "is_active" in {c.name for c in model.__table__.columns}:
                        record.is_active = False
                    else:
                        await db.delete(record)
                    await db.flush()
                    result = {
                        "client_request_id": client_request_id,
                        "entity": entity,
                        "operation": operation,
                        "status": "success",
                        "server_id": record_id,
                        "version": None,
                        "record": (
                            await _record_snapshot(db, record)
                            if "status" in {c.name for c in model.__table__.columns}
                            else None
                        ),
                    }

            else:
                raise ValidationError(f"Unsupported operation '{operation}'")

    except Exception as exc:  # noqa: BLE001
        logger.exception("sync push failed for %s/%s", entity, operation)
        if not client_request_id:
            raise
        return {
            "client_request_id": client_request_id,
            "entity": entity,
            "operation": operation,
            "status": "failed",
            "error": f"{type(exc).__name__}: {exc}"[:500],
        }

    # Record the idempotency entry (so retries replay instead of re-applying).
    if sync_op is None and client_request_id:
        sync_op = SyncOperation(
            client_request_id=client_request_id,
            user_id=user_id,
            device_id=device_id,
            entity_type=entity,
            entity_id=record_id,
            operation=operation,
            request={"operation": operation, "version": version},
            response=result,
            status=result["status"],
            version=result.get("version") or 1,
        )
        db.add(sync_op)

    return result


async def upsert_batch(
    db: AsyncSession,
    entity: str,
    records: list[dict[str, Any]],
    model_registry: dict[str, type[BaseModel]],
) -> dict[str, int]:
    """Versionless upsert used by legacy senders (web dashboard / older clients).

    New mobile clients should send explicit ``operations`` instead so conflicts
    can be detected per-record.
    """
    from sqlalchemy import select

    model = model_registry.get(entity)
    if model is None:
        return {"pushed": 0}
    pushed = updated = 0
    for payload in records:
        record_id = payload.get("id")
        if not record_id:
            continue
        values = _clean_columns(model, payload)
        values.pop("created_at", None)
        values.pop("updated_at", None)
        values.pop("deleted_at", None)
        values.pop("version", None)
        existing: BaseModel | None = (
            await db.execute(select(model).where(model.id == record_id))
        ).scalar_one_or_none()
        if existing is None:
            values["id"] = record_id
            values.setdefault("version", 1)
            db.add(model(**values))
            pushed += 1
        else:
            for key, value in values.items():
                if key != "id":
                    setattr(existing, key, value)
            existing.version = int(existing.version or 1) + 1
            updated += 1
    await db.flush()
    return {"pushed": pushed, "updated": updated}


async def touch_device(
    db: AsyncSession,
    *,
    user_id: str,
    device_id: str | None,
    app_version: str | None = None,
    platform: str | None = None,
) -> None:
    """Register/refresh this device for the authenticated user."""
    from sqlalchemy import select

    if not device_id:
        return
    row = (
        await db.execute(select(SyncDevice).where(SyncDevice.device_id == device_id))
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None:
        db.add(
            SyncDevice(
                device_id=device_id,
                user_id=user_id,
                app_version=app_version,
                platform=platform,
                last_seen_at=now,
                last_sync_at=now,
            )
        )
    else:
        row.user_id = user_id
        row.app_version = app_version or row.app_version
        row.platform = platform or row.platform
        row.is_active = True
        row.last_seen_at = now
        row.last_sync_at = now