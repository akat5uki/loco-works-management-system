from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.features.employees.models import Designation, EmployeeCategory


class EmployeeCategory(Base):
    __tablename__ = "employee_category"
    category_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class Designation(Base):
    __tablename__ = "designation"
    designation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    designation_name: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employee_category.category_id"), nullable=False
    )

    category: Mapped["EmployeeCategory"] = relationship()


class Employee(Base):
    __tablename__ = "employees"
    ticket_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    designation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("designation.designation_id"), nullable=False
    )
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    nonce: Mapped[str] = mapped_column(String, nullable=False)

    designation: Mapped["Designation"] = relationship()
