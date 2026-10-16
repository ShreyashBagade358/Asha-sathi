import json
from collections.abc import AsyncGenerator
from datetime import date, datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _json_default(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def json_dumps(obj):
    """json.dumps that serializes date/datetime values to ISO strings."""
    return json.dumps(obj, default=_json_default)


def _normalize_ssl(url: str) -> tuple[str, dict]:
    """Move libpq-style ``sslmode=`` out of the URL into asyncpg's ``ssl=`` arg.

    Hosted Postgres providers (Neon, Supabase) hand out URLs like
    ``postgresql+asyncpg://user:pass@host/db?sslmode=require``. asyncpg parses
    ``sslmode`` from a DSN string but *rejects* it when SQLAlchemy forwards it
    as a connect kwarg, so we strip the param and set ``ssl`` ourselves.
    """
    if "sslmode=" not in url:
        return url, {}
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    if sslmode in (None, "disable"):
        return cleaned, {}
    # require / prefer / allow / verify-ca / verify-full all need a TLS socket;
    # True uses the system default CA bundle, which is what hosted providers want.
    return cleaned, {"ssl": True}


engine = create_async_engine(
    _normalize_ssl(settings.database_url)[0],
    echo=False,
    pool_pre_ping=True,
    json_serializer=json_dumps,
    connect_args={"prepared_statement_cache_size": 0, **_normalize_ssl(settings.database_url)[1]},
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
