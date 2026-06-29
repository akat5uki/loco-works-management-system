import secrets
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.features.employees.models import Designation, Employee


class LocoAdmin(Base):
    __tablename__ = "loco_admin"

    ticket_number: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.ticket_number", ondelete="CASCADE"), primary_key=True
    )
    password: Mapped[str] = mapped_column(String, nullable=False)
    nonce: Mapped[str] = mapped_column(String, nullable=False, default=lambda: secrets.token_hex(16))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    employee_portal_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    employee: Mapped["Employee"] = relationship("Employee")


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    request_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reg_code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    ticket_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    designation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("designation.designation_id"), nullable=False
    )
    email: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False, index=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    designation: Mapped["Designation"] = relationship("Designation")
