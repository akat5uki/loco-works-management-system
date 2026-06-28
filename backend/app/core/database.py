from contextvars import ContextVar

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

primary_engine = create_async_engine(
    settings.DATABASE_PRIMARY_URL, 
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)
replica_engine = create_async_engine(
    settings.DATABASE_REPLICA_URL, 
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)

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
        async with AsyncSessionLocalReplica() as session:
            yield session

