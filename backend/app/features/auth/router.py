import secrets
import json

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status, BackgroundTasks
from jose import jwt
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.redis import redis_client
from app.core.security import create_access_token, get_password_hash, verify_password
from app.features.auth.dependencies import CurrentUser
from app.features.auth.schemas import (
    LoginRequest, 
    UserRegister,
    VerifyOTPRequest,
    RegisterEmailRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResendOTPRequest
)
from app.features.employees.models import Employee
from app.core.email import send_otp_email

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
        "email": current_user.email,
    }


@router.post("/login")
async def login(
    login_data: LoginRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
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

    # If Email OTP is enabled, handle OTP routing
    if settings.ENABLE_EMAIL_OTP == 1:
        # Graceful check for users without an email registered
        if not user.email:
            return {"email_required": True, "ticket_number": user.ticket_number}
        
        # Generate 6-digit OTP
        otp = f"{secrets.randbelow(900000) + 100000}"
        otp_key = f"otp:login:{user.ticket_number}"
        
        # Store in Redis
        await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
        
        # Send Email asynchronously
        background_tasks.add_task(send_otp_email, user.email, otp, "Login")
        
        return {
            "otp_required": True, 
            "ticket_number": user.ticket_number, 
            "email": user.email,
            "expire_seconds": settings.OTP_EXPIRE_SECONDS
        }

    # Standard direct authentication flow (OTP disabled)
    access_token = create_access_token(subject=user.ticket_number)

    # Store session in Redis
    session_key = f"session:{user.ticket_number}"
    await redis_client.set(session_key, access_token, ex=1800)  # 30 mins

    # Dual-Cookie Auth Shield
    response.set_cookie(
        key="session_id_strict",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=1800,  # 30 mins
    )
    response.set_cookie(
        key="session_id_embed",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=1800,
    )

    # Manually add 'Partitioned' attribute for CHIPS support
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


@router.post("/register")
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Check if user already exists
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == user_data.ticket_number)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already registered",
        )

    # Check if email is already registered
    email_result = await db.execute(
        select(Employee).where(Employee.email == user_data.email)
    )
    if email_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # If Email OTP is enabled, store registration payload in Redis and send OTP
    if settings.ENABLE_EMAIL_OTP == 1:
        # Generate 6-digit OTP
        otp = f"{secrets.randbelow(900000) + 100000}"
        
        # Save temp registration data
        reg_dict = {
            "name": user_data.name,
            "designation_id": user_data.designation_id,
            "email": user_data.email,
            "password": get_password_hash(user_data.password)
        }
        
        await redis_client.set(f"temp_reg:{user_data.ticket_number}", json.dumps(reg_dict), ex=settings.REGISTRATION_SESSION_EXPIRE_SECONDS)
        await redis_client.set(f"otp:reg:{user_data.ticket_number}", otp, ex=settings.OTP_EXPIRE_SECONDS)
        
        # Send OTP email
        background_tasks.add_task(send_otp_email, user_data.email, otp, "Registration")
        
        return {
            "otp_required": True, 
            "ticket_number": user_data.ticket_number, 
            "email": user_data.email,
            "expire_seconds": settings.OTP_EXPIRE_SECONDS
        }

    # Standard registration flow (OTP disabled)
    new_user = Employee(
        ticket_number=user_data.ticket_number,
        name=user_data.name,
        designation_id=user_data.designation_id,
        email=user_data.email,
        password=get_password_hash(user_data.password),
        nonce=secrets.token_hex(16),
    )
    db.add(new_user)
    await db.commit()
    return {"message": "User registered successfully"}


@router.post("/register-email")
async def register_email(
    reg_email_data: RegisterEmailRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if settings.ENABLE_EMAIL_OTP == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email OTP verification is disabled"
        )
        
    ticket_number = reg_email_data.ticket_number
    email = reg_email_data.email

    # Check if user exists
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if email is already taken
    email_check = await db.execute(
        select(Employee).where(Employee.email == email)
    )
    if email_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered by another employee",
        )

    # Save to temp email and generate OTP
    email_key = f"temp_email:{ticket_number}"
    otp_key = f"otp:email_reg:{ticket_number}"
    
    otp = f"{secrets.randbelow(900000) + 100000}"
    
    await redis_client.set(email_key, email, ex=settings.REGISTRATION_SESSION_EXPIRE_SECONDS)
    await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
    
    # Send email
    background_tasks.add_task(send_otp_email, email, otp, "Email Registration")
    
    return {
        "message": "Verification code sent to your email", 
        "otp_required": True,
        "expire_seconds": settings.OTP_EXPIRE_SECONDS
    }


@router.post("/verify-otp")
async def verify_otp(
    verify_data: VerifyOTPRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    ticket_number = verify_data.ticket_number
    otp = verify_data.otp
    otp_type = verify_data.type

    if otp_type == "registration":
        otp_key = f"otp:reg:{ticket_number}"
        stored_otp = await redis_client.get(otp_key)
        if not stored_otp or stored_otp != otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP"
            )
        
        # Retrieve temp registration data
        reg_key = f"temp_reg:{ticket_number}"
        reg_data_str = await redis_client.get(reg_key)
        if not reg_data_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration session expired. Please register again."
            )
        
        reg_data = json.loads(reg_data_str)
        
        # Double check user doesn't exist (concurrency check)
        result = await db.execute(
            select(Employee).where(Employee.ticket_number == ticket_number)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already registered",
            )
            
        new_user = Employee(
            ticket_number=ticket_number,
            name=reg_data["name"],
            designation_id=reg_data["designation_id"],
            email=reg_data["email"],
            password=reg_data["password"],
            nonce=secrets.token_hex(16),
        )
        db.add(new_user)
        await db.commit()
        
        # Clean up Redis
        await redis_client.delete(otp_key)
        await redis_client.delete(reg_key)
        
        return {"message": "Email verified and registration completed successfully"}

    elif otp_type == "login":
        otp_key = f"otp:login:{ticket_number}"
        stored_otp = await redis_client.get(otp_key)
        if not stored_otp or stored_otp != otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP"
            )
            
        result = await db.execute(
            select(Employee).where(Employee.ticket_number == ticket_number)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        access_token = create_access_token(subject=user.ticket_number)
        
        # Store session in Redis
        session_key = f"session:{user.ticket_number}"
        await redis_client.set(session_key, access_token, ex=1800)
        
        # Set cookies
        response.set_cookie(
            key="session_id_strict",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=1800,
        )
        response.set_cookie(
            key="session_id_embed",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=1800,
        )
        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")
                    
        # Clean up OTP
        await redis_client.delete(otp_key)
        
        return {"access_token": access_token, "token_type": "bearer"}

    elif otp_type == "email_registration":
        otp_key = f"otp:email_reg:{ticket_number}"
        stored_otp = await redis_client.get(otp_key)
        if not stored_otp or stored_otp != otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP"
            )
            
        # Retrieve temp email
        email_key = f"temp_email:{ticket_number}"
        email = await redis_client.get(email_key)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email registration session expired. Please try again."
            )
            
        result = await db.execute(
            select(Employee).where(Employee.ticket_number == ticket_number)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        # Verify email not already taken
        email_check = await db.execute(
            select(Employee).where(Employee.email == email)
        )
        if email_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered by another employee",
            )
            
        # Update user email
        user.email = email
        await db.commit()
        
        # Complete login
        access_token = create_access_token(subject=user.ticket_number)
        session_key = f"session:{user.ticket_number}"
        await redis_client.set(session_key, access_token, ex=1800)
        
        response.set_cookie(
            key="session_id_strict",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=1800,
        )
        response.set_cookie(
            key="session_id_embed",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=1800,
        )
        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")
                    
        # Clean up Redis
        await redis_client.delete(otp_key)
        await redis_client.delete(email_key)
        
        return {"access_token": access_token, "token_type": "bearer"}

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP type"
        )


@router.post("/forgot-password")
async def forgot_password(
    forgot_data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if settings.ENABLE_EMAIL_OTP == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset is unavailable because Email OTP is disabled."
        )
        
    ticket_number = forgot_data.ticket_number
    
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email registered for this user. Please contact an administrator."
        )
        
    otp = f"{secrets.randbelow(900000) + 100000}"
    otp_key = f"otp:reset:{ticket_number}"
    
    await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
    
    background_tasks.add_task(send_otp_email, user.email, otp, "Password Reset")
    
    return {
        "message": "Password reset verification code sent to your email", 
        "otp_required": True,
        "expire_seconds": settings.OTP_EXPIRE_SECONDS
    }


@router.post("/reset-password")
async def reset_password(
    reset_data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    if settings.ENABLE_EMAIL_OTP == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset is unavailable because Email OTP is disabled."
        )
        
    ticket_number = reset_data.ticket_number
    otp = reset_data.otp
    new_password = reset_data.new_password
    
    otp_key = f"otp:reset:{ticket_number}"
    stored_otp = await redis_client.get(otp_key)
    if not stored_otp or stored_otp != otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user.password = get_password_hash(new_password)
    await db.commit()
    
    await redis_client.delete(otp_key)
    
    return {"message": "Password reset completed successfully"}


@router.post("/resend-otp")
async def resend_otp(
    resend_data: ResendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if settings.ENABLE_EMAIL_OTP == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email OTP verification is disabled"
        )
        
    ticket_number = resend_data.ticket_number
    otp_type = resend_data.type
    
    otp = f"{secrets.randbelow(900000) + 100000}"
    
    if otp_type == "registration":
        reg_key = f"temp_reg:{ticket_number}"
        reg_data_str = await redis_client.get(reg_key)
        if not reg_data_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration session expired. Please register again."
            )
        reg_data = json.loads(reg_data_str)
        email = reg_data["email"]
        
        # Extend registration session in Redis
        await redis_client.set(reg_key, reg_data_str, ex=settings.REGISTRATION_SESSION_EXPIRE_SECONDS)
        
        otp_key = f"otp:reg:{ticket_number}"
        await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
        background_tasks.add_task(send_otp_email, email, otp, "Registration (Resend)")
        
    elif otp_type == "login":
        result = await db.execute(
            select(Employee).where(Employee.ticket_number == ticket_number)
        )
        user = result.scalar_one_or_none()
        if not user or not user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid login context for OTP resend"
            )
        email = user.email
        
        otp_key = f"otp:login:{ticket_number}"
        await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
        background_tasks.add_task(send_otp_email, email, otp, "Login (Resend)")
        
    elif otp_type == "email_registration":
        email_key = f"temp_email:{ticket_number}"
        email = await redis_client.get(email_key)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email registration session expired. Please try again."
            )
            
        # Extend email registration session in Redis
        await redis_client.set(email_key, email, ex=settings.REGISTRATION_SESSION_EXPIRE_SECONDS)
            
        otp_key = f"otp:email_reg:{ticket_number}"
        await redis_client.set(otp_key, otp, ex=settings.OTP_EXPIRE_SECONDS)
        background_tasks.add_task(send_otp_email, email, otp, "Email Registration (Resend)")
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP type"
        )
        
    return {
        "message": "Verification code resent successfully",
        "expire_seconds": settings.OTP_EXPIRE_SECONDS
    }
