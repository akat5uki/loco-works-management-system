from datetime import datetime
from typing import List

from sqlalchemy import BigInteger, DateTime, ForeignKey, ForeignKeyConstraint, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LocoBooking(Base):
    __tablename__ = "loco_bookings"
    loco_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("loco.loco_number", ondelete="CASCADE"), primary_key=True
    )
    date_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.job_id"), primary_key=True
    )
    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number"), nullable=False
    )
    designation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("designation.designation_id"), nullable=False
    )
    shift: Mapped[int] = mapped_column(Integer, nullable=False)

    tasks: Mapped[List["BookingTask"]] = relationship(
        "BookingTask",
        back_populates="booking",
        cascade="all, delete-orphan",
    )


class BookingTask(Base):
    __tablename__ = "booking_tasks"
    task_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    loco_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    job_id: Mapped[int] = mapped_column(Integer, nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)

    booking: Mapped["LocoBooking"] = relationship("LocoBooking", back_populates="tasks")

    __table_args__ = (
        ForeignKeyConstraint(
            ["loco_number", "date_time", "job_id"],
            ["loco_bookings.loco_number", "loco_bookings.date_time", "loco_bookings.job_id"],
            name="fk_booking_tasks_loco_bookings",
            ondelete="CASCADE",
        ),
    )
