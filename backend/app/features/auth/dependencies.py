import json
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import redis_client
from app.features.admin.models import LocoAdmin
from app.features.employees.models import Employee, Designation

# OAuth2 scheme for the Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)


async def get_current_user(
    request: Request,
    response: Response,
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> Employee:
    """
    Dependency to get the current authenticated user.
    Supports Bearer token in Authorization header and session cookies.
    Validates session against Redis, nonce against employees table, and
    enforces that only employee-scoped JWTs (session_type='employee') are accepted.
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

        # Server-side session type enforcement: only employee JWTs allowed here
        session_type = payload.get("session_type", "employee")
        if session_type != "employee":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin sessions cannot access employee resources. Please use the Employees Login Portal.",
            )

        # Validate against Redis session
        session_key = f"session:{ticket_number}:employee"
        stored_token = await redis_client.get(session_key)
        if not stored_token or stored_token != final_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid",
            )

        # Extend session lifetime on activity (Sliding Expiration)
        await redis_client.expire(session_key, settings.SESSION_EXPIRE_SECONDS)

        # Extend browser cookies' lifetime (Sliding Expiration)
        response.set_cookie(
            key="session_id_strict",
            value=final_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_STRICT,
            samesite="strict",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )
        response.set_cookie(
            key="session_id_embed",
            value=final_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_EMBED,
            samesite="none",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )
        # Add 'Partitioned' attribute for CHIPS support
        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

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

    # Nonce validation: employee JWT nonce must match employees.nonce
    token_nonce = payload.get("nonce", "")
    if not token_nonce or token_nonce != user.nonce:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is no longer valid. Please log in again.",
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


async def require_admin(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> Employee:
    """
    Admin dependency. Validates admin-scoped JWT (session_type='admin'),
    checks nonce against loco_admin.nonce, and enforces setup completion.
    Admin JWTs are issued exclusively by /admin/login — completely separate
    from employee JWTs issued by /auth/login.
    """
    final_token = token
    if not final_token:
        final_token = request.cookies.get("admin_session_id_strict")
    if not final_token:
        final_token = request.cookies.get("admin_session_id_embed")

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

        # Server-side session type enforcement: only admin JWTs allowed here
        session_type = payload.get("session_type", "employee")
        if session_type != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employee sessions cannot access admin resources. Please use the Admin portal.",
            )

        # Validate against Redis admin session
        session_key = f"session:{ticket_number}:admin"
        stored_token = await redis_client.get(session_key)
        if not stored_token or stored_token != final_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin session expired or invalid",
            )

        # Extend admin session lifetime (Sliding Expiration)
        await redis_client.expire(session_key, settings.SESSION_EXPIRE_SECONDS)

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Fetch loco_admin record and validate nonce
    admin_res = await db.execute(
        select(LocoAdmin).where(LocoAdmin.ticket_number == ticket_number)
    )
    admin_record = admin_res.scalar_one_or_none()
    user = None

    if not admin_record and ticket_number == settings.DEFAULT_ADMIN_TICKET:
        raw_redis_info = await redis_client.get("default_admin:info")
        if raw_redis_info:
            redis_data = json.loads(raw_redis_info)
            token_nonce = payload.get("nonce", "")
            if token_nonce and token_nonce == redis_data.get("nonce"):
                admin_record = LocoAdmin(
                    ticket_number=settings.DEFAULT_ADMIN_TICKET,
                    password=redis_data["password_hash"],
                    nonce=redis_data["nonce"],
                    is_default=True,
                    must_change_password=True,
                    employee_portal_enabled=False,
                )
                user = Employee(
                    ticket_number=settings.DEFAULT_ADMIN_TICKET,
                    name="System Administrator",
                    email=settings.DEFAULT_ADMIN_EMAIL,
                    designation_id=1,
                    nonce=redis_data["nonce"],
                )

    if not admin_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Administrative access required.",
        )

    # Nonce validation: admin JWT nonce must match loco_admin.nonce
    token_nonce = payload.get("nonce", "")
    if not token_nonce or token_nonce != admin_record.nonce:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session is no longer valid. Please log in again.",
        )

    # Security Guard: If default admin or mandatory setup pending, block access to operational endpoints
    if admin_record.must_change_password or admin_record.is_default:
        path = request.url.path
        if not (path.endswith("/admin/change-password") or path.endswith("/auth/logout")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mandatory initial administrator setup required before accessing dashboard.",
            )

    if user is None:
        # Fetch and return the employee record for current admin (for compatibility)
        result = await db.execute(
            select(Employee)
            .options(joinedload(Employee.designation).joinedload(Designation.category))
            .where(Employee.ticket_number == ticket_number)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin employee record not found",
            )
        # Set PG audit context session variable
        await db.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true)"),
            {"user_id": str(user.ticket_number)}
        )

    return user


async def get_current_user_or_admin(
    request: Request,
    response: Response,
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> Employee:
    """
    Dependency that accepts either a valid employee session or a valid admin session.
    """
    final_token = token
    if not final_token:
        final_token = request.cookies.get("session_id_strict") or request.cookies.get("session_id_embed")
    if not final_token:
        final_token = request.cookies.get("admin_session_id_strict") or request.cookies.get("admin_session_id_embed")

    if not final_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(final_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        session_type = payload.get("session_type", "employee")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if session_type == "admin":
        return await require_admin(request, token, db)
    else:
        return await get_current_user(request, response, token, db)


async def require_supervisor_or_admin(
    request: Request,
    user: Annotated[Employee, Depends(get_current_user_or_admin)],
    db: AsyncSession = Depends(get_db),
) -> Employee:
    if user.designation and user.designation.category_id == 1:
        return user
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == user.ticket_number))
    if admin_res.scalar_one_or_none():
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions. Supervisor or Administrative access required.",
    )


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[Employee, Depends(get_current_user)]
SupervisorUser = Annotated[Employee, Depends(require_supervisor)]
AdminUser = Annotated[Employee, Depends(require_admin)]
AnyUser = Annotated[Employee, Depends(get_current_user_or_admin)]
SupervisorOrAdminUser = Annotated[Employee, Depends(require_supervisor_or_admin)]
