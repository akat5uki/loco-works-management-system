from redis.asyncio import Redis, Sentinel

from app.core.config import settings

# Sentinel configuration
if settings.REDIS_SENTINELS:
    sentinels = [
        (s.split(":")[0], int(s.split(":")[1]))
        for s in settings.REDIS_SENTINELS.split(",")
    ]
    sentinel = Sentinel(
        sentinels, sentinel_kwargs={"password": settings.REDIS_PASSWORD}
    )
    redis_client: Redis = sentinel.master_for(
        settings.REDIS_MASTER_SET,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
        socket_timeout=10.0,
    )
else:
    redis_client: Redis = Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_timeout=10.0,
    )
