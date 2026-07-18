from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings

_engine = create_async_engine(get_settings().DATABASE_URL, pool_pre_ping=True)
_SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _SessionLocal() as session:
        yield session
