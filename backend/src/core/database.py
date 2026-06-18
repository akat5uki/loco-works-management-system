from contextvars import ContextVar

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings

primary_engine = create_async_engine(settings.DATABASE_PRIMARY_URL, echo=False)
replica_engine = create_async_engine(settings.DATABASE_REPLICA_URL, echo=False)

AsyncSessionLocalPrimary = async_sessionmaker(
    primary_engine, expire_on_commit=False, class_=AsyncSession
)
AsyncSessionLocalReplica = async_sessionmaker(
    replica_engine, expire_on_commit=False, class_=AsyncSession
)


class Base(DeclarativeBase):
    pass


# ContextVar to determine which database to route to. Defaults to replica (False).
route_to_primary: ContextVar[bool] = ContextVar("route_to_primary", default=False)


async def get_db():
    if route_to_primary.get():
        async with AsyncSessionLocalPrimary() as session:
            yield session
    else:
        try:
            async with AsyncSessionLocalReplica() as session:
                # Try a simple query to verify the replica is working
                await session.execute("SELECT 1")
                yield session
        except Exception:
            # Fallback to primary if replica fails
            async with AsyncSessionLocalPrimary() as session:
                yield session
