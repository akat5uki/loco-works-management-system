import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import String, cast, func, or_, text
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
    AdminSetEmployeePasswordRequest,
    ExtendValidityRequest,
    LocoAdminRead,
    RegistrationActionRequest,
    RegistrationRequestRead,
)
from app.features.auth.dependencies import AdminUser
from app.features.employees.models import Designation, Employee, EmployeeCategory

router = APIRouter()


async def seed_default_admin_if_needed(db: AsyncSession):
    """
    Ensure a default system administrator account exists in Redis ONLY on clean initial deployment
    when no administrator accounts exist in the loco_admin table in PostgreSQL.
    No records are created in employees or loco_admin tables in PostgreSQL.
    """
    admin_res = await db.execute(select(LocoAdmin))
    if admin_res.first() is not None:
        await redis_client.delete("default_admin:info")
        return

    redis_info = await redis_client.get("default_admin:info")
    if not redis_info:
        default_ticket = settings.DEFAULT_ADMIN_TICKET
        info = {
            "ticket_number": default_ticket,
            "password_hash": get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            "nonce": secrets.token_hex(16),
            "is_default": True,
            "must_change_password": True,
        }
        await redis_client.set("default_admin:info", json.dumps(info))


@router.get("/me")
async def get_admin_me(current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == current_user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()

    is_default = admin_info.is_default if admin_info else True
    must_change = admin_info.must_change_password if admin_info else True
    portal_enabled = admin_info.employee_portal_enabled if admin_info else False

    return {
        "ticket_number": current_user.ticket_number,
        "name": current_user.name,
        "email": current_user.email,
        "is_admin": True,
        "is_default": is_default,
        "must_change_password": must_change,
        "employee_portal_enabled": portal_enabled,
        "session_type": "admin",
    }


@router.post("/login")
async def admin_login(
    login_data: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    await seed_default_admin_if_needed(db)

    is_temp_default = False
    admin_ticket = login_data.ticket_number
    admin_nonce = ""
    must_change_password = False
    is_default_admin = False

    if login_data.ticket_number == settings.DEFAULT_ADMIN_TICKET:
        admin_res_check = await db.execute(select(LocoAdmin))
        if admin_res_check.first() is None:
            raw_redis_info = await redis_client.get("default_admin:info")
            if raw_redis_info:
                redis_data = json.loads(raw_redis_info)
                if verify_password(login_data.password, redis_data["password_hash"]):
                    is_temp_default = True
                    admin_ticket = redis_data["ticket_number"]
                    admin_nonce = redis_data["nonce"]
                    must_change_password = True
                    is_default_admin = True
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect admin ticket number or password",
                    )

    if not is_temp_default:
        # 1. Verify admin privilege and dedicated admin password from loco_admin table
        admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == login_data.ticket_number))
        admin_info = admin_res.scalar_one_or_none()
        if not admin_info:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Account does not have Administrative privileges.",
            )

        if not verify_password(login_data.password, admin_info.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect admin ticket number or password",
            )
        admin_ticket = admin_info.ticket_number
        admin_nonce = admin_info.nonce
        must_change_password = admin_info.must_change_password
        is_default_admin = admin_info.is_default

    access_token = create_access_token(
        subject=admin_ticket,
        nonce=admin_nonce,
        session_type="admin",
    )
    session_key = f"session:{admin_ticket}:admin"
    await redis_client.set(session_key, access_token, ex=settings.SESSION_EXPIRE_SECONDS)

    response.set_cookie(
        key="admin_session_id_strict",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE_STRICT,
        samesite="strict",
        max_age=settings.SESSION_EXPIRE_SECONDS,
    )
    response.set_cookie(
        key="admin_session_id_embed",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE_EMBED,
        samesite="none",
        max_age=settings.SESSION_EXPIRE_SECONDS,
    )

    for i, (header_name, header_value) in enumerate(response.raw_headers):
        if header_name == b"set-cookie" and b"admin_session_id_embed" in header_value:
            if b"Partitioned" not in header_value:
                response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": must_change_password,
        "is_default_admin": is_default_admin,
    }


@router.post("/change-password")
async def admin_change_password(
    data: AdminChangePasswordRequest,
    current_user: AdminUser,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Handles administrator password update or first-time account migration.
    When logging in with the default admin account, creates a new admin account with the user's ticket number
    and new password, and immediately deletes the default admin account completely.
    """
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == current_user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()
    is_default_flow = False

    if not admin_info and current_user.ticket_number == settings.DEFAULT_ADMIN_TICKET:
        raw_redis_info = await redis_client.get("default_admin:info")
        if raw_redis_info:
            redis_data = json.loads(raw_redis_info)
            if verify_password(data.current_password, redis_data["password_hash"]):
                is_default_flow = True

    if not is_default_flow:
        if not admin_info:
            raise HTTPException(status_code=403, detail="Admin account not found")
        if not verify_password(data.current_password, admin_info.password):
            raise HTTPException(status_code=400, detail="Current password incorrect")
        is_default_flow = admin_info.is_default

    # Check if this is the default admin initial setup migration workflow
    if is_default_flow:
        new_ticket = data.new_ticket_number
        if not new_ticket or new_ticket == settings.DEFAULT_ADMIN_TICKET:
            raise HTTPException(status_code=400, detail="Please enter your new personal employee ticket number")
        # 1. Fetch employee record for new ticket number; determine if pre-existing
        emp_res = await db.execute(select(Employee).where(Employee.ticket_number == new_ticket))
        new_emp = emp_res.scalar_one_or_none()
        # employee_portal_enabled=True only if the employee already existed before admin setup
        employee_portal_enabled = new_emp is not None

        if not new_emp:
            name_val = data.name.strip() if data.name and data.name.strip() else f"Administrator #{new_ticket}"
            email_val = data.email.strip() if data.email and data.email.strip() else f"admin_{new_ticket}@locoworks.com"
            # Security: Employee password is intentionally set to a random unusable value for new employees.
            # Admins authenticate exclusively through the Admin portal (loco_admin.password).
            # They may later set a separate employee password via /admin/set-employee-password (one-time).
            new_emp = Employee(
                ticket_number=new_ticket,
                name=name_val,
                designation_id=1,  # Default Senior Section Engineer / Admin designation
                email=email_val,
                password=get_password_hash(secrets.token_hex(32)),
                nonce=secrets.token_hex(16),
            )
            db.add(new_emp)
            await db.flush()
        else:
            if data.name and data.name.strip():
                new_emp.name = data.name.strip()
            if data.email and data.email.strip():
                new_emp.email = data.email.strip()
            await db.flush()

        # 2. Add new admin record with dedicated admin password and fresh nonce
        new_loco_admin = LocoAdmin(
            ticket_number=new_ticket,
            password=get_password_hash(data.new_password),
            nonce=secrets.token_hex(16),
            is_default=False,
            must_change_password=False,
            employee_portal_enabled=employee_portal_enabled,
        )
        db.add(new_loco_admin)
        await db.flush()

        # 3. Delete temporary default admin info and old legacy records if any
        await redis_client.delete("default_admin:info")
        if admin_info:
            await db.delete(admin_info)
            default_emp_res = await db.execute(select(Employee).where(Employee.ticket_number == settings.DEFAULT_ADMIN_TICKET))
            default_emp = default_emp_res.scalar_one_or_none()
            if default_emp:
                await db.delete(default_emp)

        await db.commit()

        # 4. Issue new JWT access token and session cookies for newly created admin account
        access_token = create_access_token(
            subject=new_ticket,
            nonce=new_loco_admin.nonce,
            session_type="admin",
        )
        session_key = f"session:{new_ticket}:admin"
        await redis_client.set(session_key, access_token, ex=settings.SESSION_EXPIRE_SECONDS)

        # Remove old default admin session
        await redis_client.delete(f"session:{settings.DEFAULT_ADMIN_TICKET}:admin")

        response.set_cookie(
            key="admin_session_id_strict",
            value=access_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_STRICT,
            samesite="strict",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )
        response.set_cookie(
            key="admin_session_id_embed",
            value=access_token,
            httponly=True,
            secure=settings.COOKIE_SECURE_EMBED,
            samesite="none",
            max_age=settings.SESSION_EXPIRE_SECONDS,
        )

        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"admin_session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

        return {
            "message": f"Administrator account #{new_ticket} created successfully. Default admin account removed.",
            "access_token": access_token,
            "new_ticket_number": new_ticket,
        }

    # Regular password change for non-default admins: update LocoAdmin.password
    admin_info.password = get_password_hash(data.new_password)
    # Rotate nonce to invalidate all existing admin sessions on password change
    admin_info.nonce = secrets.token_hex(16)
    admin_info.must_change_password = False

    await db.commit()
    return {"message": "Admin password changed successfully"}


@router.post("/logout")
async def admin_logout(request: Request, response: Response):
    token = request.cookies.get("admin_session_id_strict") or request.cookies.get("admin_session_id_embed")
    if token:
        try:
            from jose import jwt
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            ticket_number_raw = payload.get("sub")
            if ticket_number_raw:
                session_key = f"session:{ticket_number_raw}:admin"
                await redis_client.delete(session_key)
        except Exception:
            pass

    response.delete_cookie(
        key="admin_session_id_strict", path="/", httponly=True, secure=True, samesite="strict"
    )
    response.delete_cookie(
        key="admin_session_id_embed", path="/", httponly=True, secure=True, samesite="none"
    )

    for i, (header_name, header_value) in enumerate(response.raw_headers):
        if header_name == b"set-cookie" and b"admin_session_id_embed" in header_value:
            if b"Partitioned" not in header_value:
                response.raw_headers[i] = (header_name, header_value + b"; Partitioned")

    return {"message": "Admin logged out successfully"}


@router.post("/set-employee-password")
async def admin_set_employee_password(
    data: AdminSetEmployeePasswordRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """
    One-time setup: allows an admin whose employee record was auto-created during setup
    (employee_portal_enabled=False) to set a separate Employee Portal password.
    Once set, this endpoint cannot be used again.
    """
    # Fetch admin record
    admin_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == current_user.ticket_number))
    admin_info = admin_res.scalar_one_or_none()
    if not admin_info:
        raise HTTPException(status_code=403, detail="Admin account not found")

    # One-time only: reject if already enabled
    if admin_info.employee_portal_enabled:
        raise HTTPException(
            status_code=400,
            detail="Employee portal access is already enabled. This is a one-time setup."
        )

    # Confirm admin identity via admin portal password
    if not verify_password(data.admin_password, admin_info.password):
        raise HTTPException(status_code=400, detail="Admin password is incorrect")

    # Validate password confirmation
    if data.new_employee_password != data.confirm_employee_password:
        raise HTTPException(status_code=400, detail="Employee passwords do not match")

    # Update employees.password and rotate employees.nonce
    emp_res = await db.execute(select(Employee).where(Employee.ticket_number == current_user.ticket_number))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee record not found")

    emp.password = get_password_hash(data.new_employee_password)
    emp.nonce = secrets.token_hex(16)  # Rotate nonce to keep employee sessions fresh

    # Mark as enabled — one-time flag
    admin_info.employee_portal_enabled = True

    await db.commit()
    return {"message": "Employee portal access enabled. You can now log in via the Employees Login Portal."}


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
        password=emp.password,
        is_default=False,
        must_change_password=True,
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


# ==============================================================================
# MASTER DATA ADMINISTRATION WIZARD CRUD ENDPOINTS
# Allows system administrators full CRUD access across all operational tables.
# ==============================================================================

@router.get("/master-data/categories")
async def admin_get_categories(current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Retrieve all employee categories for admin wizard management."""
    res = await db.execute(select(EmployeeCategory).order_by(EmployeeCategory.category_id.asc()))
    return res.scalars().all()


@router.post("/master-data/categories")
async def admin_create_category(payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Create a new employee category."""
    category_id = int(payload.get("category_id"))
    category_name = str(payload.get("category_name", "")).strip()
    if not category_name:
        raise HTTPException(status_code=400, detail="Category name is required")
    
    cat = EmployeeCategory(category_id=category_id, category_name=category_name)
    db.add(cat)
    await db.commit()
    return {"message": "Employee category created successfully", "category_id": category_id}


@router.put("/master-data/categories/{category_id}")
async def admin_update_category(category_id: int, payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Update an existing employee category."""
    res = await db.execute(select(EmployeeCategory).where(EmployeeCategory.category_id == category_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if "category_name" in payload:
        cat.category_name = str(payload["category_name"]).strip()
    await db.commit()
    return {"message": "Employee category updated successfully"}


@router.delete("/master-data/categories/{category_id}")
async def admin_delete_category(category_id: int, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Delete an employee category."""
    res = await db.execute(select(EmployeeCategory).where(EmployeeCategory.category_id == category_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return {"message": "Employee category deleted successfully"}


@router.get("/master-data/designations")
async def admin_get_designations(current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Retrieve all designations for admin wizard management."""
    res = await db.execute(select(Designation).order_by(Designation.designation_id.asc()))
    return res.scalars().all()


@router.post("/master-data/designations")
async def admin_create_designation(payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Create a new designation."""
    designation_id = int(payload.get("designation_id"))
    designation_name = str(payload.get("designation_name", "")).strip()
    category_id = int(payload.get("category_id"))
    
    desig = Designation(designation_id=designation_id, designation_name=designation_name, category_id=category_id)
    db.add(desig)
    await db.commit()
    return {"message": "Designation created successfully", "designation_id": designation_id}


@router.put("/master-data/designations/{designation_id}")
async def admin_update_designation(designation_id: int, payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Update an existing designation."""
    res = await db.execute(select(Designation).where(Designation.designation_id == designation_id))
    desig = res.scalar_one_or_none()
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    
    if "designation_name" in payload:
        desig.designation_name = str(payload["designation_name"]).strip()
    if "category_id" in payload:
        desig.category_id = int(payload["category_id"])
    await db.commit()
    return {"message": "Designation updated successfully"}


@router.delete("/master-data/designations/{designation_id}")
async def admin_delete_designation(designation_id: int, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Delete a designation."""
    res = await db.execute(select(Designation).where(Designation.designation_id == designation_id))
    desig = res.scalar_one_or_none()
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    await db.delete(desig)
    await db.commit()
    return {"message": "Designation deleted successfully"}


@router.get("/master-data/employees")
async def admin_get_employees(current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Retrieve all employees in staff directory."""
    res = await db.execute(
        select(Employee, Designation, EmployeeCategory)
        .join(Designation, Employee.designation_id == Designation.designation_id)
        .join(EmployeeCategory, Designation.category_id == EmployeeCategory.category_id)
        .order_by(Employee.ticket_number.asc())
    )
    rows = res.all()
    return [
        {
            "ticket_number": r[0].ticket_number,
            "name": r[0].name,
            "designation_id": r[0].designation_id,
            "designation_name": r[1].designation_name,
            "category_id": r[1].category_id,
            "category_name": r[2].category_name,
            "email": r[0].email,
        }
        for r in rows
    ]


@router.post("/master-data/employees")
async def admin_create_employee(payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Create a new active employee directly."""
    ticket_number = int(payload.get("ticket_number"))
    name = str(payload.get("name", "")).strip()
    designation_id = int(payload.get("designation_id"))
    email = str(payload.get("email", "")).strip()
    password = str(payload.get("password", "abcd")).strip()

    emp_check = await db.execute(select(Employee).where(Employee.ticket_number == ticket_number))
    if emp_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee ticket number already exists")

    new_emp = Employee(
        ticket_number=ticket_number,
        name=name,
        designation_id=designation_id,
        email=email,
        password=get_password_hash(password),
        nonce=secrets.token_hex(16),
    )
    db.add(new_emp)
    await db.commit()
    return {"message": "Employee record created successfully", "ticket_number": ticket_number}


@router.put("/master-data/employees/{ticket_number}")
async def admin_update_employee(ticket_number: int, payload: dict, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Update an existing employee record."""
    res = await db.execute(select(Employee).where(Employee.ticket_number == ticket_number))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if "name" in payload:
        emp.name = str(payload["name"]).strip()
    if "designation_id" in payload:
        emp.designation_id = int(payload["designation_id"])
    if "email" in payload:
        emp.email = str(payload["email"]).strip()
    if "password" in payload and payload["password"]:
        emp.password = get_password_hash(str(payload["password"]))
    await db.commit()
    return {"message": "Employee record updated successfully"}


@router.delete("/master-data/employees/{ticket_number}")
async def admin_delete_employee(ticket_number: int, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Delete an employee record. Ensures last administrator account is protected."""
    res = await db.execute(select(Employee).where(Employee.ticket_number == ticket_number))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if employee is an administrator and protect last admin record
    adm_res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == ticket_number))
    if adm_res.scalar_one_or_none():
        count_res = await db.execute(select(func.count(LocoAdmin.ticket_number)))
        total_admins = count_res.scalar() or 0
        if total_admins <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete employee when they are the only administrator in the loco_admin table."
            )

    await db.delete(emp)
    await db.commit()
    return {"message": "Employee record deleted successfully"}


@router.delete("/admins/{ticket_number}")
async def admin_remove_admin(ticket_number: int, current_user: AdminUser, db: AsyncSession = Depends(get_db)):
    """Revoke Administrator privileges. Prevents deletion if only one administrator exists."""
    res = await db.execute(select(LocoAdmin).where(LocoAdmin.ticket_number == ticket_number))
    adm = res.scalar_one_or_none()
    if not adm:
        raise HTTPException(status_code=404, detail="Admin record not found")

    # Enforce rule: Do not allow deletion in loco_admin table if there is only one row
    count_res = await db.execute(select(func.count(LocoAdmin.ticket_number)))
    total_admins = count_res.scalar() or 0
    if total_admins <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete administrator account when only one row exists in loco_admin table."
        )

    is_def = adm.is_default
    await db.delete(adm)
    if is_def:
        emp_res = await db.execute(select(Employee).where(Employee.ticket_number == ticket_number))
        def_emp = emp_res.scalar_one_or_none()
        if def_emp:
            await db.delete(def_emp)

    await db.commit()
    return {"message": f"Administrator privileges revoked for ticket #{ticket_number}"}



