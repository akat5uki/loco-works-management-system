import json
from datetime import datetime, timedelta, time, date
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import redis_client
from app.features.auth.dependencies import CurrentUser, SupervisorUser
from app.core.loco_encoder import LocoNumberStr, encode_loco_number, decode_loco_number
from app.features.employees.models import Employee, Designation, EmployeeCategory
from app.features.bookings.models import LocoBooking, BookingTask
from app.features.employee_bookings.models import (
    EmployeeAvailability,
    EmployeeBooking,
    EmployeeNotification,
    LocoBookingRemarks,
)
from app.features.realtime.router import broadcast_event

router = APIRouter()

# Input Schemas
class AvailabilityUpdatePayload(BaseModel):
    date_str: str  # YYYY-MM-DD
    shift: int
    ticket_numbers: List[int]

class BookingSavePayload(BaseModel):
    date_str: str  # YYYY-MM-DD
    shift: int
    loco_number: LocoNumberStr
    supervisor_ticket_number: int  # for SSE to book JE/SSE
    staff_ticket_numbers: List[int] = []  # for JE/SSE to book staff
    forward: bool = False
    phase: Optional[int] = None

class LockPayload(BaseModel):
    date_str: str
    shift: int

class TaskRemarkPayload(BaseModel):
    task_id: int
    completed: bool
    remarks: str

class JobRemarkPayload(BaseModel):
    job_id: int
    completed: bool
    remarks: str
    task_remarks: List[TaskRemarkPayload] = []

class NewTaskPayload(BaseModel):
    job_id: int
    task_description: str

class RemarksSubmitPayload(BaseModel):
    loco_number: LocoNumberStr
    date_str: str  # YYYY-MM-DD
    shift: int
    job_remarks: List[JobRemarkPayload]
    new_jobs: List[int] = []  # carry forward new jobs to next shift
    new_tasks: List[NewTaskPayload] = []  # carry forward new tasks to next shift


# Helpers
def parse_local_date(date_str: str) -> datetime:
    local_tz = ZoneInfo("Asia/Kolkata")
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dt_local = datetime.combine(dt.date(), time.min, tzinfo=local_tz)
    return dt_local.astimezone(ZoneInfo("UTC"))

def get_next_shift_dt_shift(current_date_str: str, current_shift: int) -> tuple[datetime, int, date]:
    local_tz = ZoneInfo("Asia/Kolkata")
    dt = datetime.strptime(current_date_str, "%Y-%m-%d")
    if current_shift == 1:
        dt_next = datetime.combine(dt.date(), time.min, tzinfo=local_tz)
        return dt_next.astimezone(ZoneInfo("UTC")), 2, dt.date()
    else:
        next_day = dt + timedelta(days=1)
        dt_next = datetime.combine(next_day.date(), time.min, tzinfo=local_tz)
        return dt_next.astimezone(ZoneInfo("UTC")), 1, next_day.date()


# 1. Availability Endpoints
@router.get("/availabilities")
async def get_availabilities(date_str: str, shift: int, db: AsyncSession = Depends(get_db)):
    local_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    # Query absences (employees stored in EmployeeAvailability are absent)
    query = select(EmployeeAvailability.ticket_number).where(
        and_(
            func.date(func.timezone("Asia/Kolkata", EmployeeAvailability.date_time)) == local_date,
            EmployeeAvailability.shift == shift,
        )
    )
    result = await db.execute(query)
    absent_tickets = set(result.scalars().all())
    
    # Query all active employees
    all_emp_query = select(Employee.ticket_number)
    all_emp_res = await db.execute(all_emp_query)
    all_tickets = all_emp_res.scalars().all()
    
    # Available = All - Absent
    available_tickets = [t for t in all_tickets if t not in absent_tickets]
    return {"available_tickets": available_tickets}


@router.post("/availabilities")
async def update_availabilities(
    payload: AvailabilityUpdatePayload,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    parsed_date = parse_local_date(payload.date_str)
    local_date = datetime.strptime(payload.date_str, "%Y-%m-%d").date()
    
    # Fetch all employees to find who is absent
    all_emp_query = select(Employee.ticket_number)
    all_emp_res = await db.execute(all_emp_query)
    all_tickets = all_emp_res.scalars().all()
    
    # Absent = All - Available (payload.ticket_numbers)
    available_set = set(payload.ticket_numbers)
    absent_tickets = [t for t in all_tickets if t not in available_set]
    
    # 1. Delete existing absences for this date and shift
    delete_query = delete(EmployeeAvailability).where(
        and_(
            func.date(func.timezone("Asia/Kolkata", EmployeeAvailability.date_time)) == local_date,
            EmployeeAvailability.shift == payload.shift,
        )
    )
    await db.execute(delete_query)
    
    # 2. Insert new absences
    for ticket in absent_tickets:
        db.add(
            EmployeeAvailability(
                date_time=parsed_date,
                shift=payload.shift,
                ticket_number=ticket,
            )
        )
    
    try:
        await db.commit()
        return {"message": "Availability updated successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update availability: {e}")


# 2. Available Locos Endpoint
@router.get("/locos")
async def get_available_locos(date_str: str, shift: int, db: AsyncSession = Depends(get_db)):
    local_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    # Fetch distinct loco numbers booked in loco_bookings for this date and shift
    query = (
        select(LocoBooking.loco_number)
        .where(
            and_(
                func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == local_date,
                LocoBooking.shift == shift,
            )
        )
        .distinct()
    )
    result = await db.execute(query)
    locos = result.scalars().all()
    return {"locos": [decode_loco_number(l) for l in locos]}


# 3. Lock Endpoints
@router.post("/bookings/lock")
async def acquire_lock(payload: LockPayload, current_user: SupervisorUser):
    lock_key = f"lock:employee-booking:{payload.date_str}:{payload.shift}"
    
    # Try to set lock
    user_info = json.dumps({"ticket_number": current_user.ticket_number, "name": current_user.name})
    success = await redis_client.set(lock_key, user_info, ex=30, nx=True)
    
    if not success:
        current_lock = await redis_client.get(lock_key)
        if current_lock:
            try:
                owner = json.loads(current_lock)
                if owner.get("ticket_number") == current_user.ticket_number:
                    # Renew lock
                    await redis_client.set(lock_key, user_info, ex=30)
                    return {"status": "success", "message": "Lock renewed"}
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"This editing window is currently locked by {owner.get('name')} (Ticket #{owner.get('ticket_number')}).",
                    )
            except json.JSONDecodeError:
                pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This editing window is currently locked by another supervisor.",
        )
        
    return {"status": "success", "message": "Lock acquired"}


@router.post("/bookings/unlock")
async def release_lock(payload: LockPayload, current_user: SupervisorUser):
    lock_key = f"lock:employee-booking:{payload.date_str}:{payload.shift}"
    current_lock = await redis_client.get(lock_key)
    if current_lock:
        try:
            owner = json.loads(current_lock)
            if owner.get("ticket_number") == current_user.ticket_number:
                await redis_client.delete(lock_key)
                return {"status": "success", "message": "Lock released"}
        except json.JSONDecodeError:
            pass
    return {"status": "success", "message": "No lock to release"}


# 4. Save Bookings
@router.post("/bookings")
async def save_bookings(
    payload: BookingSavePayload,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    parsed_date = parse_local_date(payload.date_str)
    local_date = datetime.strptime(payload.date_str, "%Y-%m-%d").date()
    loco_number_int = encode_loco_number(payload.loco_number)
    
    # Authorization checks
    is_sse = current_user.designation_id == 1  # SSE has designation_id = 1
    is_je = current_user.designation_id == 2   # JE has designation_id = 2
    
    if not is_sse and not is_je:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SSE and JE supervisors can make employee bookings.",
        )

    # Acquire lock validation (make sure they currently hold it)
    lock_key = f"lock:employee-booking:{payload.date_str}:{payload.shift}"
    current_lock = await redis_client.get(lock_key)
    if current_lock:
        owner = json.loads(current_lock)
        if owner.get("ticket_number") != current_user.ticket_number:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot save changes. The editing window is locked by {owner.get('name')}.",
            )

    notifications_to_send = []

    is_phase_2 = False
    if payload.phase == 2:
        is_phase_2 = True
    elif payload.phase == 1:
        is_phase_2 = False
    else:
        is_phase_2 = is_je

    if not is_phase_2:
        # Phase-1: SSE books JE/SSE (Supervisor)
        # Delete existing bookings for this loco, date, shift
        del_query = delete(EmployeeBooking).where(
            and_(
                EmployeeBooking.loco_number == loco_number_int,
                func.date(func.timezone("Asia/Kolkata", EmployeeBooking.date_time)) == local_date,
                EmployeeBooking.shift == payload.shift,
            )
        )
        await db.execute(del_query)
        
        # Add supervisor booking
        new_booking = EmployeeBooking(
            loco_number=loco_number_int,
            date_time=parsed_date,
            shift=payload.shift,
            supervisor_ticket_number=payload.supervisor_ticket_number,
            staff_ticket_number=None,
            is_forwarded=payload.forward,
        )
        db.add(new_booking)
        
        if payload.forward and payload.supervisor_ticket_number != current_user.ticket_number:
            notifications_to_send.append(
                EmployeeNotification(
                    ticket_number=payload.supervisor_ticket_number,
                    message=f"SSE #{current_user.ticket_number} assigned you as supervisor for Loco #{payload.loco_number}.",
                )
            )

    else:
        # Phase-2: Supervisor (JE/SSE) books staff
        # Supervisor can only book if they were assigned as supervisor for this loco
        check_query = select(EmployeeBooking).where(
            and_(
                EmployeeBooking.loco_number == loco_number_int,
                func.date(func.timezone("Asia/Kolkata", EmployeeBooking.date_time)) == local_date,
                EmployeeBooking.shift == payload.shift,
                EmployeeBooking.supervisor_ticket_number == current_user.ticket_number,
            )
        )
        check_res = await db.execute(check_query)
        has_assignment = check_res.scalars().first()
        if not has_assignment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You are not assigned as the supervisor for Loco #{payload.loco_number} in this shift.",
            )
            
        # Delete existing staff assignments under this supervisor for this loco/shift
        del_query = delete(EmployeeBooking).where(
            and_(
                EmployeeBooking.loco_number == loco_number_int,
                func.date(func.timezone("Asia/Kolkata", EmployeeBooking.date_time)) == local_date,
                EmployeeBooking.shift == payload.shift,
                EmployeeBooking.supervisor_ticket_number == current_user.ticket_number,
                EmployeeBooking.staff_ticket_number.is_not(None),
            )
        )
        await db.execute(del_query)
        
        # Add staff assignments
        for staff_ticket in payload.staff_ticket_numbers:
            db.add(
                EmployeeBooking(
                    loco_number=loco_number_int,
                    date_time=parsed_date,
                    shift=payload.shift,
                    supervisor_ticket_number=current_user.ticket_number,
                    staff_ticket_number=staff_ticket,
                    is_forwarded=True,  # Staff assignments are immediately forwarded
                )
            )
            notifications_to_send.append(
                EmployeeNotification(
                    ticket_number=staff_ticket,
                    message=f"Supervisor #{current_user.ticket_number} assigned you to Loco #{payload.loco_number} as staff.",
                )
            )

    # Save notifications
    for n in notifications_to_send:
        db.add(n)
        
    try:
        await db.commit()
        # Broadcast real-time notifications
        for n in notifications_to_send:
            await broadcast_event(
                "employee_notification",
                {"ticket_number": n.ticket_number, "message": n.message},
            )
        return {"message": "Employee bookings saved successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save bookings: {e}")


# 5. Get Bookings
@router.get("/bookings")
async def get_bookings(date_str: str, shift: int, db: AsyncSession = Depends(get_db)):
    local_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    query = select(EmployeeBooking).where(
        and_(
            func.date(func.timezone("Asia/Kolkata", EmployeeBooking.date_time)) == local_date,
            EmployeeBooking.shift == shift,
        )
    )
    result = await db.execute(query)
    bookings = result.scalars().all()
    return [
        {
            "booking_id": b.booking_id,
            "loco_number": decode_loco_number(b.loco_number),
            "date_time": b.date_time.isoformat() if b.date_time else None,
            "shift": b.shift,
            "supervisor_ticket_number": b.supervisor_ticket_number,
            "staff_ticket_number": b.staff_ticket_number,
            "is_forwarded": b.is_forwarded,
        }
        for b in bookings
    ]


# 6. Notifications Endpoints
@router.get("/notifications")
async def get_notifications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    query = (
        select(EmployeeNotification)
        .where(EmployeeNotification.ticket_number == current_user.ticket_number)
        .order_by(EmployeeNotification.created_at.desc())
    )
    result = await db.execute(query)
    notifications = result.scalars().all()
    return notifications


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    query = select(EmployeeNotification).where(
        and_(
            EmployeeNotification.notification_id == notification_id,
            EmployeeNotification.ticket_number == current_user.ticket_number,
        )
    )
    result = await db.execute(query)
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


# 7. Views Endpoints (By Loco, By Supervisor, By Staff)
@router.get("/views")
async def get_booking_views(date_str: str, shift: int, db: AsyncSession = Depends(get_db)):
    local_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    
    # Query all bookings joined with Employee names
    # Aliases for joining supervisor and staff
    from sqlalchemy.orm import aliased
    Supervisor = aliased(Employee)
    Staff = aliased(Employee)
    
    query = (
        select(
            EmployeeBooking.loco_number,
            EmployeeBooking.supervisor_ticket_number,
            Supervisor.name.label("supervisor_name"),
            EmployeeBooking.staff_ticket_number,
            Staff.name.label("staff_name"),
            EmployeeBooking.is_forwarded,
        )
        .join(Supervisor, EmployeeBooking.supervisor_ticket_number == Supervisor.ticket_number)
        .outerjoin(Staff, EmployeeBooking.staff_ticket_number == Staff.ticket_number)
        .where(
            and_(
                func.date(func.timezone("Asia/Kolkata", EmployeeBooking.date_time)) == local_date,
                EmployeeBooking.shift == shift,
            )
        )
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    # ── Compiled View 1: BY LOCO ──
    by_loco_dict = {}
    for r in rows:
        loco = decode_loco_number(r.loco_number)
        sup_ticket = r.supervisor_ticket_number
        sup_name = r.supervisor_name
        staff_ticket = r.staff_ticket_number
        staff_name = r.staff_name
        is_f = r.is_forwarded
        
        if loco not in by_loco_dict:
            by_loco_dict[loco] = {"loco_number": loco, "supervisors": {}}
            
        if sup_ticket not in by_loco_dict[loco]["supervisors"]:
            by_loco_dict[loco]["supervisors"][sup_ticket] = {
                "supervisor_ticket_number": sup_ticket,
                "supervisor_name": sup_name,
                "is_forwarded": is_f,
                "staff": [],
            }
            
        if staff_ticket:
            by_loco_dict[loco]["supervisors"][sup_ticket]["staff"].append(
                {"staff_ticket_number": staff_ticket, "staff_name": staff_name}
            )
            
    by_loco = []
    for l_data in by_loco_dict.values():
        by_loco.append(
            {
                "loco_number": l_data["loco_number"],
                "supervisors": list(l_data["supervisors"].values()),
            }
        )
        
    # ── Compiled View 2: BY SUPERVISOR ──
    by_sup_dict = {}
    for r in rows:
        loco = decode_loco_number(r.loco_number)
        sup_ticket = r.supervisor_ticket_number
        sup_name = r.supervisor_name
        staff_ticket = r.staff_ticket_number
        staff_name = r.staff_name
        is_f = r.is_forwarded
        
        if sup_ticket not in by_sup_dict:
            by_sup_dict[sup_ticket] = {
                "supervisor_ticket_number": sup_ticket,
                "supervisor_name": sup_name,
                "locos": {},
            }
            
        if loco not in by_sup_dict[sup_ticket]["locos"]:
            by_sup_dict[sup_ticket]["locos"][loco] = {
                "loco_number": loco,
                "is_forwarded": is_f,
                "staff": [],
            }
            
        if staff_ticket:
            by_sup_dict[sup_ticket]["locos"][loco]["staff"].append(
                {"staff_ticket_number": staff_ticket, "staff_name": staff_name}
            )
            
    by_supervisor = []
    for s_data in by_sup_dict.values():
        by_supervisor.append(
            {
                "supervisor_ticket_number": s_data["supervisor_ticket_number"],
                "supervisor_name": s_data["supervisor_name"],
                "locos": list(s_data["locos"].values()),
            }
        )
        
    # ── Compiled View 3: BY STAFF ──
    by_staff_dict = {}
    for r in rows:
        loco = decode_loco_number(r.loco_number)
        sup_ticket = r.supervisor_ticket_number
        sup_name = r.supervisor_name
        staff_ticket = r.staff_ticket_number
        staff_name = r.staff_name
        
        if not staff_ticket:
            continue
            
        if staff_ticket not in by_staff_dict:
            by_staff_dict[staff_ticket] = {
                "staff_ticket_number": staff_ticket,
                "staff_name": staff_name,
                "assignments": [],
            }
            
        by_staff_dict[staff_ticket]["assignments"].append(
            {
                "loco_number": loco,
                "supervisor_ticket_number": sup_ticket,
                "supervisor_name": sup_name,
            }
        )
        
    by_staff = list(by_staff_dict.values())
    
    return {"by_loco": by_loco, "by_supervisor": by_supervisor, "by_staff": by_staff}


# 8. Remarks & Carry Forward Endpoints
@router.get("/remarks")
async def get_remarks(date_str: str, shift: int, db: AsyncSession = Depends(get_db)):
    local_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    query = select(LocoBookingRemarks).where(
        and_(
            func.date(func.timezone("Asia/Kolkata", LocoBookingRemarks.date_time)) == local_date,
            LocoBookingRemarks.shift == shift,
        )
    )
    result = await db.execute(query)
    remarks = result.scalars().all()
    return [
        {
            "remarks_id": r.remarks_id,
            "loco_number": decode_loco_number(r.loco_number),
            "date_time": r.date_time.isoformat() if r.date_time else None,
            "shift": r.shift,
            "supervisor_ticket_number": r.supervisor_ticket_number,
            "job_id": r.job_id,
            "task_id": r.task_id,
            "remarks": r.remarks,
            "completed": r.completed,
        }
        for r in remarks
    ]


@router.post("/remarks")
async def submit_remarks(
    payload: RemarksSubmitPayload,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    parsed_date = parse_local_date(payload.date_str)
    local_date = datetime.strptime(payload.date_str, "%Y-%m-%d").date()
    next_date, next_shift, next_local_date = get_next_shift_dt_shift(payload.date_str, payload.shift)
    loco_number_int = encode_loco_number(payload.loco_number)
    
    # 1. Save remarks
    # Delete old remarks for this loco/date/shift
    del_query = delete(LocoBookingRemarks).where(
        and_(
            LocoBookingRemarks.loco_number == loco_number_int,
            func.date(func.timezone("Asia/Kolkata", LocoBookingRemarks.date_time)) == local_date,
            LocoBookingRemarks.shift == payload.shift,
        )
    )
    await db.execute(del_query)
    
    for jr in payload.job_remarks:
        # Job general remark
        db.add(
            LocoBookingRemarks(
                loco_number=loco_number_int,
                date_time=parsed_date,
                shift=payload.shift,
                supervisor_ticket_number=current_user.ticket_number,
                job_id=jr.job_id,
                task_id=None,
                remarks=jr.remarks,
                completed=jr.completed,
            )
        )
        
        # Task specific remarks
        for tr in jr.task_remarks:
            db.add(
                LocoBookingRemarks(
                    loco_number=loco_number_int,
                    date_time=parsed_date,
                    shift=payload.shift,
                    supervisor_ticket_number=current_user.ticket_number,
                    job_id=jr.job_id,
                    task_id=tr.task_id,
                    remarks=tr.remarks,
                    completed=tr.completed,
                )
            )
            
    # 2. Automate Carry Forward
    # A. Carried forward incomplete jobs
    for jr in payload.job_remarks:
        if not jr.completed:
            # Check if this job has a booking in next shift
            query_next = select(LocoBooking).where(
                and_(
                    LocoBooking.loco_number == loco_number_int,
                    func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == next_local_date,
                    LocoBooking.shift == next_shift,
                    LocoBooking.job_id == jr.job_id,
                )
            )
            res_next = await db.execute(query_next)
            exists = res_next.scalar_one_or_none()
            
            if not exists:
                # Get details from current booking
                curr_query = select(LocoBooking).where(
                    and_(
                        LocoBooking.loco_number == loco_number_int,
                        func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == local_date,
                        LocoBooking.shift == payload.shift,
                        LocoBooking.job_id == jr.job_id,
                    )
                )
                curr_res = await db.execute(curr_query)
                curr_booking = curr_res.scalar_one_or_none()
                
                # Copy or inherit
                db.add(
                    LocoBooking(
                        loco_number=loco_number_int,
                        date_time=next_date,
                        job_id=jr.job_id,
                        ticket_number=curr_booking.ticket_number if curr_booking else current_user.ticket_number,
                        designation_id=curr_booking.designation_id if curr_booking else current_user.designation_id,
                        shift=next_shift,
                    )
                )
            
            # Carried forward incomplete tasks
            # Find all tasks of this job in current shift
            curr_tasks_query = select(BookingTask).where(
                and_(
                    BookingTask.loco_number == loco_number_int,
                    func.date(func.timezone("Asia/Kolkata", BookingTask.date_time)) == local_date,
                    BookingTask.job_id == jr.job_id,
                )
            )
            curr_tasks_res = await db.execute(curr_tasks_query)
            curr_tasks = curr_tasks_res.scalars().all()
            
            for task in curr_tasks:
                # Check if marked completed
                t_remark = next((tr for tr in jr.task_remarks if tr.task_id == task.task_id), None)
                if not t_remark or not t_remark.completed:
                    # Carry forward to next shift
                    db.add(
                        BookingTask(
                            loco_number=loco_number_int,
                            date_time=next_date,
                            job_id=jr.job_id,
                            task_description=task.task_description + " (Carried Forward)",
                        )
                    )
                    
    # B. Carry forward explicitly selected new jobs
    for nj_id in payload.new_jobs:
        # Check if booking exists
        q_next = select(LocoBooking).where(
            and_(
                LocoBooking.loco_number == loco_number_int,
                func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == next_local_date,
                LocoBooking.shift == next_shift,
                LocoBooking.job_id == nj_id,
            )
        )
        r_next = await db.execute(q_next)
        exists = r_next.scalar_one_or_none()
        if not exists:
            db.add(
                LocoBooking(
                    loco_number=loco_number_int,
                    date_time=next_date,
                    job_id=nj_id,
                    ticket_number=current_user.ticket_number,
                    designation_id=current_user.designation_id,
                    shift=next_shift,
                )
            )
            
    # C. Carry forward explicitly typed new tasks
    for nt in payload.new_tasks:
        # Ensure job booking exists
        q_next = select(LocoBooking).where(
            and_(
                LocoBooking.loco_number == loco_number_int,
                func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == next_local_date,
                LocoBooking.shift == next_shift,
                LocoBooking.job_id == nt.job_id,
            )
        )
        r_next = await db.execute(q_next)
        exists = r_next.scalar_one_or_none()
        if not exists:
            db.add(
                LocoBooking(
                    loco_number=loco_number_int,
                    date_time=next_date,
                    job_id=nt.job_id,
                    ticket_number=current_user.ticket_number,
                    designation_id=current_user.designation_id,
                    shift=next_shift,
                )
            )
        db.add(
            BookingTask(
                loco_number=loco_number_int,
                date_time=next_date,
                job_id=nt.job_id,
                task_description=nt.task_description,
            )
        )

    try:
        await db.commit()
        return {"message": "Remarks saved and carried forward successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit remarks/carry forward: {e}")
