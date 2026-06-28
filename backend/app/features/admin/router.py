import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import String, cast, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.email import send_registration_notification_email
from app.core.redis import redis_client
from app.core.security import create_access_token, get_password_hash, verify_password
from app.features.admin.models import LocoAdmin, RegistrationRequest
from app.features.admin.schemas import (
    AddAdminRequest,
    AdminChangePasswordRequest,
    AdminLoginRequest,
    ExtendValidityRequest,
    LocoAdminRead,
    RegistrationActionRequest,
    RegistrationRequestRead,
)
from app.features.auth.dependencies import AdminUser
from app.features.employees.models import Designation, Employee

router = APIRouter()


async def seed_default_admin_if_needed(db: AsyncSession):
    """Ensure a default admin account exists in employees and loco_admin tables."""
    result = await db.execute(select(LocoAdmin))
    admin = result.scalar_one_or_none()
    if not admin:
        default_ticket = 9999
        # Check if employee 9999 exists
        emp_res = await db.execute(select(Employee).where(Employee.ticket_number == default_ticket))
        emp = emp_res.scalar_one_or_none()
        if not emp:
            emp = Employee(
                ticket_number=default_ticket,
                name="System Administrator",
                designation_id=1,  # SSE Supervisor
                email="admin@locoworks.local",
                password=get_password_hash("AdminPassword123!"),
                nonce=secrets.token_hex(16),
            )
            db.add(emp)
            await db.flush()
        
        loco_admin = LocoAdmin(
            ticket_number=default_ticket,
            is_default=True,
            must_change_password=True,
        )
        db.add(loco_admin)
        await db.commit()


@router.post("/login")
async def admin_login(
    login_data: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    await seed_default_admin_if_needed(db)

    # 1. Check employee credentials
    result = await db.execute(select(Employee).where(Employee.ticket_number == login_data.ticket_number))
    user = result.scalar_one_or_none()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin ticket number or password",
        )

    # 2. Verify admin privilege
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()
    if not admin_info:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Account does not have Administrative privileges.",
        )

    access_token = create_access_token(subject=user.ticket_number)
    session_key = f"session:{user.ticket_number}"
    await redis_client.set(session_key, access_token, ex=settings.SESSION_EXPIRE_SECONDS)

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

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": admin_info.must_change_password,
        "is_default_admin": admin_info.is_default,
    }


@router.post("/change-password")
async def admin_change_password(
    data: AdminChangePasswordRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    current_user.password = get_password_hash(data.new_password)
    
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == current_user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()
    if admin_info:
        admin_info.must_change_password = False

    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/registration-requests", response_model=List[RegistrationRequestRead])
async def list_registration_requests(
    current_user: AdminUser,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    # Check for expired pending requests and update status
    now = datetime.now(timezone.utc)
    expired_res = await db.execute(
        select(RegistrationRequest).where(
            RegistrationRequest.status == "PENDING",
            RegistrationRequest.valid_until < now
        )
    )
    expired_items = expired_res.scalars().all()
    if expired_items:
        for item in expired_items:
            item.status = "EXPIRED"
            item.remarks = "Validity period of 7 days expired without admin approval."
        await db.commit()

    query = select(RegistrationRequest).options(
        joinedload(RegistrationRequest.designation).joinedload(Designation.category)
    ).order_by(RegistrationRequest.created_at.desc())

    if status_filter and status_filter.upper() != "ALL":
        query = query.where(RegistrationRequest.status == status_filter.upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                RegistrationRequest.reg_code.ilike(s),
                RegistrationRequest.name.ilike(s),
                cast(RegistrationRequest.ticket_number, String).ilike(s),
                RegistrationRequest.email.ilike(s),
            )
        )

    res = await db.execute(query)
    items = res.scalars().all()

    out = []
    for item in items:
        is_exp = (item.status == "PENDING" and item.valid_until < now) or item.status == "EXPIRED"
        out.append(
            RegistrationRequestRead(
                request_id=item.request_id,
                reg_code=item.reg_code,
                ticket_number=item.ticket_number,
                name=item.name,
                designation_id=item.designation_id,
                designation_name=item.designation.designation_name if item.designation else None,
                category_name=item.designation.category.category_name if item.designation and item.designation.category else None,
                email=item.email,
                status="EXPIRED" if is_exp and item.status == "PENDING" else item.status,
                remarks=item.remarks,
                valid_until=item.valid_until,
                created_at=item.created_at,
                is_expired=is_exp,
            )
        )
    return out


@router.post("/registration-requests/{reg_code}/action")
async def take_registration_action(
    reg_code: str,
    action_data: RegistrationActionRequest,
    background_tasks: BackgroundTasks,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(RegistrationRequest).where(RegistrationRequest.reg_code == reg_code))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=44, detail="Registration request not found")

    act = action_data.action.upper()
    if act == "APPROVE":
        # Check if employee already exists
        emp_check = await db.execute(select(Employee).where(Employee.ticket_number == req.ticket_number))
        if emp_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Employee with this ticket number is already registered")

        new_emp = Employee(
            ticket_number=req.ticket_number,
            name=req.name,
            designation_id=req.designation_id,
            email=req.email,
            password=req.password_hash,
            nonce=secrets.token_hex(16),
        )
        db.add(new_emp)
        req.status = "APPROVED"
        req.remarks = action_data.remarks or "Approved by Admin"
        await db.commit()

        background_tasks.add_task(
            send_registration_notification_email,
            req.email,
            req.name,
            "APPROVED",
            "Congratulations! Your registration request has been verified and approved by the Administrator. You may now log in to the system.",
            req.reg_code
        )
        return {"message": "Registration request approved successfully. Employee account is active."}

    elif act == "REJECT":
        if not action_data.remarks:
            raise HTTPException(status_code=400, detail="Remarks/Reason required for rejection")
        req.status = "REJECTED"
        req.remarks = action_data.remarks
        await db.commit()

        background_tasks.add_task(
            send_registration_notification_email,
            req.email,
            req.name,
            "REJECTED",
            f"Your registration request was rejected by the Administrator. Reason: {action_data.remarks}",
            req.reg_code
        )
        return {"message": "Registration request rejected."}

    elif act == "PENDING":
        req.status = "PENDING"
        req.remarks = action_data.remarks or "Pending verification"
        await db.commit()

        background_tasks.add_task(
            send_registration_notification_email,
            req.email,
            req.name,
            "PENDING (Requires Action)",
            f"Your registration request requires updates or clarifications. Admin remarks: {action_data.remarks or 'Please contact administration.'}",
            req.reg_code
        )
        return {"message": "Registration request set to pending with remarks."}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be APPROVE, REJECT, or PENDING")


@router.post("/registration-requests/{reg_code}/extend-validity")
async def extend_registration_validity(
    reg_code: str,
    ext_data: ExtendValidityRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(RegistrationRequest).where(RegistrationRequest.reg_code == reg_code))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Registration request not found")

    req.valid_until = req.valid_until + timedelta(days=ext_data.additional_days)
    if req.status == "EXPIRED":
        req.status = "PENDING"
    await db.commit()
    return {"message": f"Validity extended by {ext_data.additional_days} days."}


@router.get("/admins", response_model=List[LocoAdminRead])
async def list_admins(current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(LocoAdmin).options(joinedload(LocoAdmin.employee)))
    admins = res.scalars().all()
    return [
        LocoAdminRead(
            ticket_number=a.ticket_number,
            name=a.employee.name if a.employee else f"Admin #{a.ticket_number}",
            email=a.employee.email if a.employee else None,
            is_default=a.is_default,
            must_change_password=a.must_change_password,
            created_at=a.created_at,
        )
        for a in admins
    ]


@router.post("/add-admin")
async def add_admin(
    data: AddAdminRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    emp_res = await db.execute(select(Employee).where(Employee.ticket_number == data.ticket_number))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == data.ticket_number))
    if admin_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee is already an Administrator")

    new_admin = LocoAdmin(
        ticket_number=data.ticket_number,
        is_default=False,
        must_change_password=False,
    )
    db.add(new_admin)
    await db.commit()
    return {"message": f"Granted Administrator privileges to {emp.name} (#{emp.ticket_number})."}


@router.get("/audit-logs")
async def get_audit_logs(
    current_user: AdminUser,
    table_name: Optional[str] = None,
    operation: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Read-only audit log query interface for Admin compliance reporting."""
    sql = "SELECT id, table_name, operation, record_pk, old_data, new_data, changed_by, changed_at FROM public.audit_logs WHERE 1=1"
    params = {}
    if table_name and table_name.lower() != "all":
        sql += " AND LOWER(table_name) = LOWER(:table_name)"
        params["table_name"] = table_name
    if operation and operation.lower() != "all":
        sql += " AND UPPER(operation) = UPPER(:operation)"
        params["operation"] = operation

    sql += " ORDER BY changed_at DESC LIMIT :limit"
    params["limit"] = limit

    res = await db.execute(text(sql), params)
    rows = res.fetchall()

    return [
        {
            "id": r.id,
            "table_name": r.table_name,
            "operation": r.operation,
            "record_pk": r.record_pk,
            "old_data": r.old_data,
            "new_data": r.new_data,
            "changed_by": r.changed_by,
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        }
        for r in rows
    ]

