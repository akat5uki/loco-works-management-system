from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.loco_encoder import LocoNumberStr, encode_loco_number, decode_loco_number
from app.features.auth.dependencies import CurrentUser, SupervisorUser
from app.features.bookings.models import BookingTask, LocoBooking
from app.features.employees.models import Employee
from app.features.jobs.models import Job
from app.features.locos.models import Loco
from app.features.realtime.router import broadcast_event

router = APIRouter()


class TaskCreateInput(BaseModel):
    task_description: str


class JobBookingInput(BaseModel):
    job_id: int
    tasks: List[TaskCreateInput]


class BookingCreateBatch(BaseModel):
    loco_number: LocoNumberStr
    date_time: datetime
    shift: int          # now supplied by the user, not inferred from loco
    bookings: List[JobBookingInput]


class SingleTaskAddInput(BaseModel):
    loco_number: LocoNumberStr
    date_time: datetime
    job_id: int
    task_description: str


class SingleJobAddInput(BaseModel):
    loco_number: LocoNumberStr
    date_time: datetime
    job_id: int
    shift: int


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking: BookingCreateBatch,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    if booking.shift not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid shift. Only Shift 1 and Shift 2 are allowed."
        )

    loco_number_int = encode_loco_number(booking.loco_number)

    from zoneinfo import ZoneInfo
    from datetime import datetime
    local_tz = ZoneInfo("Asia/Kolkata")
    today_local = datetime.now(local_tz).date()
    
    dt = booking.date_time
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    input_date = dt.astimezone(local_tz).date()
    
    days_diff = (input_date - today_local).days
    if days_diff < 0 or days_diff > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is only allowed for the current day and next day."
        )

    # Verify loco exists
    result = await db.execute(
        select(Loco).where(Loco.loco_number == loco_number_int)
    )
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Locomotive #{booking.loco_number} not found."
        )

    # Block bookings for despatched locos
    if db_loco.despatched:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Locomotive #{booking.loco_number} has been despatched and cannot accept new bookings."
        )

    # Check if a booking already exists for this loco on the same date + shift
    from zoneinfo import ZoneInfo
    local_tz = ZoneInfo("Asia/Kolkata")
    dt = booking.date_time
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    input_date = dt.astimezone(local_tz).date()

    existing_query = (
        select(LocoBooking)
        .where(
            LocoBooking.loco_number == loco_number_int,
            func.date(func.timezone("Asia/Kolkata", LocoBooking.date_time)) == input_date,
            LocoBooking.shift == booking.shift,
        )
    )
    existing_result = await db.execute(existing_query)
    existing_bookings = existing_result.scalars().all()
    if existing_bookings:
        # Edit Mode: delete old records; BookingTasks cascade automatically
        for b in existing_bookings:
            await db.delete(b)
        await db.flush()

    created_bookings = []
    for job_booking in booking.bookings:
        new_booking = LocoBooking(
            loco_number=loco_number_int,
            date_time=booking.date_time,
            job_id=job_booking.job_id,
            ticket_number=current_user.ticket_number,
            designation_id=current_user.designation_id,
            shift=booking.shift,
        )
        db.add(new_booking)
        created_bookings.append(new_booking)

        for task_in in job_booking.tasks:
            db_task = BookingTask(
                loco_number=loco_number_int,
                date_time=booking.date_time,
                job_id=job_booking.job_id,
                task_description=task_in.task_description,
            )
            db.add(db_task)

    await db.commit()

    await broadcast_event(
        "booking_created",
        {
            "loco_number": booking.loco_number,
            "jobs_count": len(booking.bookings),
        },
    )

    return {"message": f"Successfully created {len(created_bookings)} bookings"}


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def add_booking_task(
    task_in: SingleTaskAddInput,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    loco_number_int = encode_loco_number(task_in.loco_number)
    query = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == task_in.date_time,
        LocoBooking.job_id == task_in.job_id
    )
    result = await db.execute(query)
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Parent job booking not found")
    
    db_task = BookingTask(
        loco_number=loco_number_int,
        date_time=task_in.date_time,
        job_id=task_in.job_id,
        task_description=task_in.task_description
    )
    db.add(db_task)
    await db.commit()
    return {"message": "Task added successfully", "task_id": db_task.task_id}


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def add_job_booking(
    job_in: SingleJobAddInput,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    if job_in.shift not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid shift. Only Shift 1 and Shift 2 are allowed."
        )

    loco_number_int = encode_loco_number(job_in.loco_number)

    from zoneinfo import ZoneInfo
    from datetime import datetime
    local_tz = ZoneInfo("Asia/Kolkata")
    today_local = datetime.now(local_tz).date()
    
    dt = job_in.date_time
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    input_date = dt.astimezone(local_tz).date()
    
    days_diff = (input_date - today_local).days
    if days_diff < 0 or days_diff > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is only allowed for the current day and next day."
        )

    query = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == job_in.date_time,
        LocoBooking.job_id == job_in.job_id
    )
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This job is already booked for this locomotive at this time.")
    
    new_booking = LocoBooking(
        loco_number=loco_number_int,
        date_time=job_in.date_time,
        job_id=job_in.job_id,
        ticket_number=current_user.ticket_number,
        designation_id=current_user.designation_id,
        shift=job_in.shift
    )
    db.add(new_booking)
    await db.commit()
    return {"message": "Job added successfully"}


def _booking_row_to_dict(row) -> dict:
    return {
        "loco_number": decode_loco_number(row.loco_number),
        "date_time": row.date_time.isoformat() if row.date_time else None,
        "job_id": row.job_id,
        "job_description": row.job_description,
        "task_id": row.task_id,
        "task_description": row.task_description,
        "ticket_number": row.ticket_number,
        "employee_name": row.employee_name,
        "shift": row.shift,
    }


def _base_booking_query():
    """Shared SELECT … FROM … JOIN … that both list endpoints reuse."""
    return (
        select(
            LocoBooking.loco_number,
            LocoBooking.date_time,
            LocoBooking.job_id,
            LocoBooking.shift,
            Job.job_description,
            BookingTask.task_id,
            BookingTask.task_description,
            LocoBooking.ticket_number,
            Employee.name.label("employee_name"),
        )
        .join(Job, LocoBooking.job_id == Job.job_id)
        .outerjoin(
            BookingTask,
            and_(
                LocoBooking.loco_number == BookingTask.loco_number,
                LocoBooking.date_time == BookingTask.date_time,
                LocoBooking.job_id == BookingTask.job_id,
            ),
        )
        .join(Employee, LocoBooking.ticket_number == Employee.ticket_number)
        .order_by(LocoBooking.date_time.desc())
    )


@router.get("/")
async def get_bookings(
    current_user: CurrentUser,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tz: str = "Asia/Kolkata",
    db: AsyncSession = Depends(get_db)
):
    """Return bookings, optionally filtered by start_date and end_date."""
    query = _base_booking_query()
    if start_date:
        query = query.where(func.date(func.timezone(tz, LocoBooking.date_time)) >= start_date)
    if end_date:
        query = query.where(func.date(func.timezone(tz, LocoBooking.date_time)) <= end_date)
    result = await db.execute(query)
    return [_booking_row_to_dict(row) for row in result.all()]


@router.get("/loco/{loco_number}")
async def get_loco_history(
    loco_number: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return the full job history for a single locomotive, newest first."""
    loco_number_int = encode_loco_number(loco_number)
    query = _base_booking_query().where(
        LocoBooking.loco_number == loco_number_int
    )
    result = await db.execute(query)
    rows = result.all()
    if not rows:
        # Verify loco even exists
        loco_check = await db.execute(
            select(Loco).where(Loco.loco_number == loco_number_int)
        )
        if not loco_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Locomotive not found")
    return [_booking_row_to_dict(row) for row in rows]


@router.delete("/{loco_number}/{date_time}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loco_booking_batch(
    loco_number: str,
    date_time: datetime,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    loco_number_int = encode_loco_number(loco_number)
    query = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == date_time
    )
    result = await db.execute(query)
    bookings = result.scalars().all()
    if not bookings:
        raise HTTPException(status_code=404, detail="Bookings not found")
    for booking in bookings:
        await db.delete(booking)
    await db.commit()


@router.delete("/{loco_number}/{date_time}/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_booking(
    loco_number: str,
    date_time: datetime,
    job_id: int,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    loco_number_int = encode_loco_number(loco_number)
    query = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == date_time,
        LocoBooking.job_id == job_id
    )
    result = await db.execute(query)
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.delete(booking)
    await db.commit()

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking_task(
    task_id: int,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    query = select(BookingTask).where(BookingTask.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()

class TaskUpdateInput(BaseModel):
    task_description: str

@router.put("/tasks/{task_id}")
async def update_booking_task(
    task_id: int,
    task_in: TaskUpdateInput,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    query = select(BookingTask).where(BookingTask.task_id == task_id)
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.task_description = task_in.task_description
    await db.commit()
    return {"message": "Task updated successfully"}

class JobUpdateInput(BaseModel):
    new_job_id: int

@router.put("/{loco_number}/{date_time}/{job_id}")
async def update_job_booking(
    loco_number: str,
    date_time: datetime,
    job_id: int,
    job_in: JobUpdateInput,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db)
):
    loco_number_int = encode_loco_number(loco_number)
    # This is tricky because job_id is part of the primary key.
    # The safest way is to insert a new LocoBooking and its tasks, then delete the old one.
    query = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == date_time,
        LocoBooking.job_id == job_id
    )
    result = await db.execute(query)
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if target job already exists
    check_q = select(LocoBooking).where(
        LocoBooking.loco_number == loco_number_int,
        LocoBooking.date_time == date_time,
        LocoBooking.job_id == job_in.new_job_id
    )
    check_res = await db.execute(check_q)
    if check_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This job is already booked for this loco at this time.")

    tasks_query = select(BookingTask).where(
        BookingTask.loco_number == loco_number_int,
        BookingTask.date_time == date_time,
        BookingTask.job_id == job_id
    )
    tasks_res = await db.execute(tasks_query)
    tasks = tasks_res.scalars().all()

    new_booking = LocoBooking(
        loco_number=loco_number_int,
        date_time=booking.date_time,
        job_id=job_in.new_job_id,
        ticket_number=booking.ticket_number,
        designation_id=booking.designation_id,
        shift=booking.shift
    )
    db.add(new_booking)
    await db.flush()

    for t in tasks:
        new_task = BookingTask(
            loco_number=loco_number_int,
            date_time=new_booking.date_time,
            job_id=new_booking.job_id,
            task_description=t.task_description
        )
        db.add(new_task)

    await db.delete(booking)
    await db.commit()
    return {"message": "Job updated successfully"}
