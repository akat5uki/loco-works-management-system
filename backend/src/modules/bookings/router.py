from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.auth.dependencies import CurrentUser
from src.modules.bookings.models import LocoBooking
from src.modules.realtime.router import broadcast_event

router = APIRouter()


class BookingCreate(BaseModel):
    loco_number: int
    date_time: datetime
    job_id: int
    task_id: int
    ticket_number: Optional[int] = None
    designation_id: Optional[int] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking: BookingCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    booking_dict = booking.model_dump()
    # Override with actual authenticated user data for security
    booking_dict["ticket_number"] = current_user.ticket_number
    booking_dict["designation_id"] = current_user.designation_id

    new_booking = LocoBooking(**booking_dict)
    db.add(new_booking)
    await db.commit()

    # Broadcast workshop telemetry event
    await broadcast_event(
        "booking_created",
        {
            "loco_number": booking.loco_number,
            "job_id": booking.job_id,
            "task_id": booking.task_id,
        },
    )

    return {"message": "Booking created successfully"}
