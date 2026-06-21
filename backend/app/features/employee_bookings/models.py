from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"
    availability_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    shift: Mapped[int] = mapped_column(Integer, nullable=False)
    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("date_time", "shift", "ticket_number", name="uq_emp_avail_date_shift_ticket"),
    )


class EmployeeBooking(Base):
    __tablename__ = "employee_bookings"
    booking_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loco_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("loco.loco_number", ondelete="CASCADE"), nullable=False
    )
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    shift: Mapped[int] = mapped_column(Integer, nullable=False)
    supervisor_ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), nullable=False
    )
    staff_ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), nullable=True
    )
    is_forwarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class EmployeeNotification(Base):
    __tablename__ = "employee_notifications"
    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class LocoBookingRemarks(Base):
    __tablename__ = "loco_booking_remarks"
    remarks_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loco_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("loco.loco_number", ondelete="CASCADE"), nullable=False
    )
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    shift: Mapped[int] = mapped_column(Integer, nullable=False)
    supervisor_ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[int] = mapped_column(BigInteger, nullable=True)  # maps to BookingTask.task_id
    remarks: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
