import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.core.config import settings
from app.core.database import route_to_primary
from app.features.auth.router import router as auth_router
from app.features.bookings.router import router as bookings_router
from app.features.employees.router import router as employees_router
from app.features.jobs.router import router as jobs_router
from app.features.locos.router import router as locos_router
from app.features.realtime.router import redis_stream_listener, chat_pubsub_listener
from app.features.realtime.router import router as realtime_router
from app.features.chat.router import router as chat_router
from app.features.employee_bookings.router import router as employee_bookings_router
from app.features.admin.router import router as admin_router, seed_default_admin_if_needed


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import primary_engine
    from sqlalchemy.ext.asyncio import AsyncSession

    async with AsyncSession(primary_engine) as session:
        await seed_default_admin_if_needed(session)

    # Start background listeners
    stream_task = asyncio.create_task(redis_stream_listener())
    chat_task = asyncio.create_task(chat_pubsub_listener())
    yield
    stream_task.cancel()
    chat_task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS middleware — allow explicitly configured origins only.
# Uses allow_credentials=True to support HTTP-only cookie-based authentication.
# Origins are read from CORS_ALLOWED_ORIGINS in .env (comma-separated).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
                max_age=settings.WRITE_WINDOW_LAG_SECONDS,
                httponly=True,
                samesite="lax",
                secure=settings.COOKIE_SECURE_STRICT,
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
    employee_bookings_router, prefix=f"{settings.API_V1_STR}/bookings/employees", tags=["employee_bookings"]
)
app.include_router(
    realtime_router, prefix=f"{settings.API_V1_STR}/realtime", tags=["realtime"]
)
app.include_router(
    chat_router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"]
)
app.include_router(
    admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"]
)



@app.get(f"{settings.API_V1_STR}/")
async def root():
    """
    Retrieve entrypoint root welcome message.
    """
    return {"message": "Welcome to Loco Works Management System API"}


@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    """
    Check the health status of the application.
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.BACKEND_HOST, port=settings.BACKEND_PORT)
