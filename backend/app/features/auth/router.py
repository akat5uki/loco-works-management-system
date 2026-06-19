import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from jose import jwt
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.redis import redis_client
from app.core.security import create_access_token, get_password_hash, verify_password
from app.features.auth.dependencies import CurrentUser
from app.features.auth.schemas import LoginRequest, Token, UserRegister
from app.features.employees.models import Employee

router = APIRouter()


@router.get("/me")
async def get_me(current_user: CurrentUser):
    return {
        "ticket_number": current_user.ticket_number,
        "name": current_user.name,
        "designation_id": current_user.designation_id,
        "designation_name": current_user.designation.designation_name if current_user.designation else None,
        "category_name": current_user.designation.category.category_name if current_user.designation and current_user.designation.category else None,
        "is_supervisor": current_user.designation
        and current_user.designation.category_id == 1,
    }


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == login_data.ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect ticket number or password",
        )
    access_token = create_access_token(subject=user.ticket_number)

    # Store session in Redis
    session_key = f"session:{user.ticket_number}"
    await redis_client.set(session_key, access_token, ex=1800)  # 30 mins

    # Dual-Cookie Auth Shield
    # 1. Strict session for standalone browser tabs (CSRF protection)
    response.set_cookie(
        key="session_id_strict",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=1800,  # 30 mins
    )
    # 2. Embed session for iframes (Partitioned via CHIPS for cross-site embedding)
    response.set_cookie(
        key="session_id_embed",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=1800,
    )

    # Manually add 'Partitioned' attribute for CHIPS support (requires Python 3.14 for native support)
    for i, (header_name, header_value) in enumerate(response.raw_headers):
        if header_name == b"set-cookie" and b"session_id_embed" in header_value:
            if b"Partitioned" not in header_value:
                response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(request: Request, response: Response):
    # Try to clear session from Redis if cookies exist
    token = request.cookies.get("session_id_strict") or request.cookies.get("session_id_embed")
    if token:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            ticket_number_raw = payload.get("sub")
            if ticket_number_raw:
                session_key = f"session:{ticket_number_raw}"
                await redis_client.delete(session_key)
        except Exception:
            pass

    # Clear both standalone and embedded sessions in browser
    response.delete_cookie(
        key="session_id_strict", path="/", httponly=True, secure=True, samesite="strict"
    )
    response.delete_cookie(
        key="session_id_embed", path="/", httponly=True, secure=True, samesite="none"
    )

    # Add Partitioned attribute to deletion cookie for CHIPS compliance
    for i, (header_name, header_value) in enumerate(response.raw_headers):
        if header_name == b"set-cookie" and b"session_id_embed" in header_value:
            if b"Partitioned" not in header_value:
                response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

    return {"message": "Logged out successfully"}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == user_data.ticket_number)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already registered",
        )

    new_user = Employee(
        ticket_number=user_data.ticket_number,
        name=user_data.name,
        designation_id=user_data.designation_id,
        password=get_password_hash(user_data.password),
        nonce=secrets.token_hex(16),
    )
    db.add(new_user)
    await db.commit()
    return {"message": "User registered successfully"}
