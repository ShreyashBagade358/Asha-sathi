from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger("sync_service")

_MODEL_REGISTRY: dict[str, Any] = {}


def register_models(models: dict[str, Any]) -> None:
    _MODEL_REGISTRY.update(models)


def get_model(table_name: str) -> Any:
    if table_name not in _MODEL_REGISTRY:
        raise KeyError(f"No model registered for table '{table_name}'")
    return _MODEL_REGISTRY[table_name]


async def upsert_batch(db: AsyncSession, table_name: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    """Upsert records into a table using Postgres INSERT ... ON CONFLICT (id) DO UPDATE.

    Falls back to a portable update-or-insert when not on Postgres (e.g. SQLite tests).
    """
    model = get_model(table_name)
    if not records:
        return {"pushed": 0, "updated": 0}

    conflict_cols = [c.name for c in model.__table__.primary_key.columns]

    try:
        stmt = pg_insert(model).values(records)
        update_cols = {
            c.name: getattr(stmt.excluded, c.name) for c in model.__table__.columns if c.name not in conflict_cols
        }
        stmt = stmt.on_conflict_do_update(index_elements=conflict_cols, set_=update_cols)
        await db.execute(stmt)
    except Exception:
        # Portable fallback (SQLite / tests)
        for record in records:
            existing = await db.get(model, record["id"])
            if existing:
                for k, v in record.items():
                    setattr(existing, k, v)
            else:
                db.add(model(**record))
    await db.commit()
    return {"pushed": len(records), "updated": len(records)}
