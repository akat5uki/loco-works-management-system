import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.core.config import settings
from app.core.database import route_to_primary
from app.features.auth.router import router as auth_router
from app.features.bookings.router import router as bookings_router
from app.features.employees.router import router as employees_router
from app.features.jobs.router import router as jobs_router
from app.features.locos.router import router as locos_router
from app.features.realtime.router import redis_stream_listener
from app.features.realtime.router import router as realtime_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seeding tasks is no longer needed since the child booking_tasks table is normalized
    pass

    # Start the Redis Stream listener for websockets
    task = asyncio.create_task(redis_stream_listener())
    yield
    task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def db_routing_middleware(request: Request, call_next):
    # Check if request is mutating
    is_mutating = request.method in ["POST", "PUT", "DELETE", "PATCH"]

    # Check for the lag mitigation cookie
    has_lag_cookie = request.cookies.get("write_window_lag") == "1"

    # Route to primary if mutating (writes) or if lag cookie is present
    token = route_to_primary.set(is_mutating or has_lag_cookie)

    try:
        response: Response = await call_next(request)

        if is_mutating and response.status_code < 400:
            # Write succeeded → plant a 2-second lag cookie so the next read
            # is also routed to the primary (read-your-own-writes).
            response.set_cookie(
                key="write_window_lag",
                value="1",
                max_age=2,
                httponly=True,
                samesite="lax",
                secure=False,  # Set True if HTTPS
            )
        elif has_lag_cookie and not is_mutating:
            # Read request consumed the lag cookie → delete it immediately
            # so it doesn't linger past its intended single-use window.
            response.delete_cookie(
                key="write_window_lag",
                httponly=True,
                samesite="lax",
            )

        return response
    finally:
        route_to_primary.reset(token)


app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(locos_router, prefix=f"{settings.API_V1_STR}/locos", tags=["locos"])
app.include_router(jobs_router, prefix=f"{settings.API_V1_STR}/jobs", tags=["jobs"])
app.include_router(
    employees_router, prefix=f"{settings.API_V1_STR}/employees", tags=["employees"]
)
app.include_router(
    bookings_router, prefix=f"{settings.API_V1_STR}/bookings", tags=["bookings"]
)
app.include_router(
    realtime_router, prefix=f"{settings.API_V1_STR}/realtime", tags=["realtime"]
)


@app.get(f"{settings.API_V1_STR}/")
async def root():
    return {"message": "Welcome to Loco Works Management System API"}


@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
