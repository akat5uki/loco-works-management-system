from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import redis_client
from app.features.employees.models import Employee, Designation

# OAuth2 scheme for the Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)


async def get_current_user(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> Employee:
    """
    Dependency to get the current authenticated user.
    Supports Bearer token in Authorization header and session cookies.
    Also validates session against Redis.
    """

    # 1. Try to get token from Authorization header (provided by oauth2_scheme)
    # 2. If not found, try session_id_strict cookie
    # 3. If still not found, try session_id_embed cookie

    final_token = token
    if not final_token:
        final_token = request.cookies.get("session_id_strict")
    if not final_token:
        final_token = request.cookies.get("session_id_embed")

    if not final_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            final_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        ticket_number_raw = payload.get("sub")
        if ticket_number_raw is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        ticket_number = int(ticket_number_raw)

        # Validate against Redis session
        session_key = f"session:{ticket_number}"
        stored_token = await redis_client.get(session_key)
        if not stored_token or stored_token != final_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid",
            )

        # Extend session lifetime on activity (Sliding Expiration)
        await redis_client.expire(session_key, 1800)

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    result = await db.execute(
        select(Employee)
        .options(joinedload(Employee.designation).joinedload(Designation.category))
        .where(Employee.ticket_number == ticket_number)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Set PG audit context session variable
    await db.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": str(user.ticket_number)}
    )

    return user


def require_supervisor(current_user: Annotated[Employee, Depends(get_current_user)]):
    if not current_user.designation or current_user.designation.category_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Supervisor access required.",
        )
    return current_user


# Type alias for cleaner dependency injection
CurrentUser = Annotated[Employee, Depends(get_current_user)]
SupervisorUser = Annotated[Employee, Depends(require_supervisor)]
