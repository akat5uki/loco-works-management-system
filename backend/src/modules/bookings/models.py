from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class LocoBooking(Base):
    __tablename__ = "loco_bookings"
    loco_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("loco.loco_number"), primary_key=True
    )
    date_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.job_id"), primary_key=True
    )
    task_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tasks.task_id"), nullable=False, default=1
    )
    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number"), nullable=False
    )
    designation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("designation.designation_id"), nullable=False
    )
