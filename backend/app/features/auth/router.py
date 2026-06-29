import secrets
import json

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status, BackgroundTasks
from jose import jwt
from app.core.config import settings
from sqlalchemy import or_
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
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResendOTPRequest,
    EmployeeChangePasswordRequest
)
from datetime import datetime, timedelta, timezone
from app.features.employees.models import Employee
from app.features.admin.models import LocoAdmin, RegistrationRequest
from app.core.email import send_otp_email, send_registration_notification_email

router = APIRouter()


@router.get("/me")
async def get_me(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    # get_current_user only passes session_type="employee" JWTs, so this is always an employee session
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == current_user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()
    return {
        "ticket_number": current_user.ticket_number,
        "name": current_user.name,
        "designation_id": current_user.designation_id,
        "designation_name": current_user.designation.designation_name if current_user.designation else None,
        "category_name": current_user.designation.category.category_name if current_user.designation and current_user.designation.category else None,
        "is_supervisor": current_user.designation and current_user.designation.category_id == 1,
        "is_admin": admin_info is not None,
        "employee_portal_enabled": admin_info.employee_portal_enabled if admin_info else None,
        "session_type": "employee",
        "email": current_user.email,
    }


@router.post("/login")
async def login(
    login_data: LoginRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Prevent Default System Administrator account from logging in via Employees Login Portal
    if login_data.ticket_number == settings.DEFAULT_ADMIN_TICKET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Default System Administrator account cannot sign in via the Employees Login Portal. Please access the Administrative Portal.",
        )

    result = await db.execute(
        select(Employee).where(Employee.ticket_number == login_data.ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user:
        reg_res = await db.execute(
            select(RegistrationRequest).where(RegistrationRequest.ticket_number == login_data.ticket_number).order_by(RegistrationRequest.created_at.desc())
        )
        pending_req = reg_res.scalars().first()
        if pending_req:
            if pending_req.status == "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your registration request (Code: {pending_req.reg_code}) is pending Admin verification. Please present your verification code to Admin."
                )
            elif pending_req.status == "REJECTED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your registration request was rejected by Admin. Reason: {pending_req.remarks or 'N/A'}"
                )

    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect ticket number or password",
        )

    # Security: Block administrator accounts without employee portal access from Employees Login Portal.
    # Admins with employee_portal_enabled=True may log in here (they have a real employee password set).
    admin_check = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == user.ticket_number))
    admin_record = admin_check.scalar_one_or_none()
    if admin_record and not admin_record.employee_portal_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts must sign in via the Admin portal, not the Employees Login Portal.",
        )

    # If Email OTP is enabled, handle OTP routing
    if settings.ENABLE_EMAIL_OTP == 1:
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
    access_token = create_access_token(
        subject=user.ticket_number,
        nonce=user.nonce,
        session_type="employee",
    )

    # Store session in Redis under employee-scoped key
    session_key = f"session:{user.ticket_number}:employee"
    await redis_client.set(session_key, access_token, ex=settings.SESSION_EXPIRE_SECONDS)

    # Dual-Cookie Auth Shield
    response.set_cookie(
        key="session_id_strict",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE_STRICT,
        samesite="strict",
        max_age=settings.SESSION_EXPIRE_SECONDS,
    )
    response.set_cookie(
        key="session_id_embed",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE_EMBED,
        samesite="none",
        max_age=settings.SESSION_EXPIRE_SECONDS,
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
            session_type = payload.get("session_type", "employee")
            if ticket_number_raw:
                # Delete the correct scoped session key
                session_key = f"session:{ticket_number_raw}:{session_type}"
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


async def generate_unique_reg_code(db: AsyncSession) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(12))
        res = await db.execute(select(RegistrationRequest).where(RegistrationRequest.reg_code == code))
        if not res.scalar_one_or_none():
            return code


@router.post("/register")
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Check if user already exists in employees table
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == user_data.ticket_number)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already registered and active",
        )

    # Check if email is already registered in employees table
    email_result = await db.execute(
        select(Employee).where(Employee.email == user_data.email)
    )
    if email_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already active",
        )

    # Check if a pending registration request already exists for this ticket or email
    pending_check = await db.execute(
        select(RegistrationRequest).where(
            or_(
                RegistrationRequest.ticket_number == user_data.ticket_number,
                RegistrationRequest.email == user_data.email
            ),
            RegistrationRequest.status == "PENDING"
        )
    )
    existing_req = pending_check.scalars().first()
    if existing_req:
        return {
            "registration_submitted": True,
            "reg_code": existing_req.reg_code,
            "valid_until": existing_req.valid_until.isoformat(),
            "message": "A registration request is already pending verification."
        }

    # If Email OTP is enabled, store registration payload in Redis and send OTP
    if settings.ENABLE_EMAIL_OTP == 1:
        otp = f"{secrets.randbelow(900000) + 100000}"
        reg_dict = {
            "name": user_data.name,
            "designation_id": user_data.designation_id,
            "email": user_data.email,
            "password": get_password_hash(user_data.password)
        }
        
        await redis_client.set(f"temp_reg:{user_data.ticket_number}", json.dumps(reg_dict), ex=settings.REGISTRATION_SESSION_EXPIRE_SECONDS)
        await redis_client.set(f"otp:reg:{user_data.ticket_number}", otp, ex=settings.OTP_EXPIRE_SECONDS)
        
        background_tasks.add_task(send_otp_email, user_data.email, otp, "Registration")
        
        return {
            "otp_required": True, 
            "ticket_number": user_data.ticket_number, 
            "name": user_data.name,
            "email": user_data.email,
            "expire_seconds": settings.OTP_EXPIRE_SECONDS
        }

    # Standard registration flow (OTP disabled) -> Create RegistrationRequest with validity configured in .env
    reg_code = await generate_unique_reg_code(db)
    valid_until = datetime.now(timezone.utc) + timedelta(days=settings.REGISTRATION_VALIDITY_DAYS)

    reg_req = RegistrationRequest(
        reg_code=reg_code,
        ticket_number=user_data.ticket_number,
        name=user_data.name,
        designation_id=user_data.designation_id,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        status="PENDING",
        valid_until=valid_until,
    )
    db.add(reg_req)
    await db.commit()

    background_tasks.add_task(
        send_registration_notification_email,
        user_data.email,
        user_data.name,
        "SUBMITTED (Pending Verification)",
        f"Your registration request has been submitted successfully. Please present your 12-character verification code ({reg_code}) to the Administrator within 7 days for verification.",
        reg_code
    )

    return {
        "registration_submitted": True,
        "reg_code": reg_code,
        "valid_until": valid_until.isoformat(),
        "message": "Registration submitted successfully. Pending Admin approval."
    }


@router.post("/verify-otp")
async def verify_otp(
    verify_data: VerifyOTPRequest,
    response: Response,
    background_tasks: BackgroundTasks,
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
                detail="User already registered and active",
            )
            
        reg_code = await generate_unique_reg_code(db)
        valid_until = datetime.now(timezone.utc) + timedelta(days=settings.REGISTRATION_VALIDITY_DAYS)

        reg_req = RegistrationRequest(
            reg_code=reg_code,
            ticket_number=ticket_number,
            name=reg_data["name"],
            designation_id=reg_data["designation_id"],
            email=reg_data["email"],
            password_hash=reg_data["password"],
            status="PENDING",
            valid_until=valid_until,
        )
        db.add(reg_req)
        await db.commit()
        
        background_tasks.add_task(
            send_registration_notification_email,
            reg_data["email"],
            reg_data["name"],
            "SUBMITTED (Pending Verification)",
            f"Your registration request has been submitted successfully. Please present your 12-character verification code ({reg_code}) to the Administrator within 7 days for verification.",
            reg_code
        )
        
        # Clean up Redis
        await redis_client.delete(otp_key)
        await redis_client.delete(reg_key)
        
        return {
            "registration_submitted": True,
            "reg_code": reg_code,
            "name": reg_data.get("name", ""),
            "valid_until": valid_until.isoformat(),
            "message": "Email verified and registration request submitted successfully. Pending Admin approval."
        }

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
            
        access_token = create_access_token(
            subject=user.ticket_number,
            nonce=user.nonce,
            session_type="employee",
        )
        
        # Store session in Redis under employee-scoped key
        session_key = f"session:{user.ticket_number}:employee"
        await redis_client.set(session_key, access_token, ex=settings.SESSION_EXPIRE_SECONDS)
        
        # Set cookies
        response.set_cookie(
            key="session_id_strict",
            value=access_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_STRICT,
            samesite="strict",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )
        response.set_cookie(
            key="session_id_embed",
            value=access_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_EMBED,
            samesite="none",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )
        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")
                    
        # Clean up OTP
        await redis_client.delete(otp_key)
        
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


@router.post("/change-password")
async def change_employee_password(
    pwd_data: EmployeeChangePasswordRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Employee).where(Employee.ticket_number == current_user.ticket_number)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee user record not found"
        )
        
    if not verify_password(pwd_data.current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
        
    user.password = get_password_hash(pwd_data.new_password)
    await db.commit()
    return {"message": "Employee password updated successfully"}

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
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP type"
        )
        
    return {
        "message": "Verification code resent successfully",
        "expire_seconds": settings.OTP_EXPIRE_SECONDS
    }
