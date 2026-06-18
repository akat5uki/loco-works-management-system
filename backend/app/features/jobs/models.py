from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"
    job_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_description: Mapped[str] = mapped_column(String, nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)


class Task(Base):
    __tablename__ = "tasks"
    task_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)


class EmployeeJobRating(Base):
    __tablename__ = "employee_job_ratings"
    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number"), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.job_id"), primary_key=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
