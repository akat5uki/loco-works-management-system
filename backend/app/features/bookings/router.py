from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
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
    loco_number: int
    date_time: datetime
    bookings: List[JobBookingInput]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking: BookingCreateBatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Fetch the loco to get its shift
    result = await db.execute(
        select(Loco).where(Loco.loco_number == booking.loco_number)
    )
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Locomotive #{booking.loco_number} not found."
        )

    # Check if a booking already exists for this loco on the same day and shift
    input_date = booking.date_time.date()
    existing_query = (
        select(LocoBooking)
        .join(Loco, LocoBooking.loco_number == Loco.loco_number)
        .where(
            LocoBooking.loco_number == booking.loco_number,
            func.date(LocoBooking.date_time) == input_date,
            Loco.shift == db_loco.shift
        )
    )
    existing_result = await db.execute(existing_query)
    existing_bookings = existing_result.scalars().all()
    if existing_bookings:
        # Edit Mode: Delete existing bookings (associated BookingTasks are deleted via SQLAlchemy cascading)
        for b in existing_bookings:
            await db.delete(b)
        await db.flush()

    created_bookings = []
    for job_booking in booking.bookings:
        # Create a single booking record for the job
        new_booking = LocoBooking(
            loco_number=booking.loco_number,
            date_time=booking.date_time,
            job_id=job_booking.job_id,
            ticket_number=current_user.ticket_number,
            designation_id=current_user.designation_id,
        )
        db.add(new_booking)
        created_bookings.append(new_booking)

        # Create tasks for this job booking
        for task_in in job_booking.tasks:
            db_task = BookingTask(
                loco_number=booking.loco_number,
                date_time=booking.date_time,
                job_id=job_booking.job_id,
                task_description=task_in.task_description
            )
            db.add(db_task)

    await db.commit()

    # Broadcast workshop telemetry event
    await broadcast_event(
        "booking_created",
        {
            "loco_number": booking.loco_number,
            "jobs_count": len(booking.bookings),
        },
    )

    return {"message": f"Successfully created {len(created_bookings)} bookings"}


@router.get("/")
async def get_bookings(
    current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    # Fetch bookings, joining Loco, Job, BookingTask, and Employee
    query = (
        select(
            LocoBooking.loco_number,
            LocoBooking.date_time,
            LocoBooking.job_id,
            Job.job_description,
            BookingTask.task_id,
            BookingTask.task_description,
            LocoBooking.ticket_number,
            Employee.name.label("employee_name"),
            Loco.shift,
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
        .join(Loco, LocoBooking.loco_number == Loco.loco_number)
        .order_by(LocoBooking.date_time.desc())
    )
    result = await db.execute(query)
    bookings = []
    for row in result.all():
        bookings.append(
            {
                "loco_number": row.loco_number,
                "date_time": row.date_time.isoformat() if row.date_time else None,
                "job_id": row.job_id,
                "job_description": row.job_description,
                "task_id": row.task_id,
                "task_description": row.task_description,
                "ticket_number": row.ticket_number,
                "employee_name": row.employee_name,
                "shift": row.shift,
            }
        )
    return bookings
