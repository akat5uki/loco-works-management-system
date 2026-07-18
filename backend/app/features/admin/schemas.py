from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AdminLoginRequest(BaseModel):
    ticket_number: int = Field(..., description="Admin employee ticket number")
    password: str = Field(..., description="Admin password")


class AdminChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password")
    new_ticket_number: Optional[int] = Field(None, description="New admin employee ticket number for account migration")
    name: Optional[str] = Field(None, description="Full name if employee record needs creation")
    email: str = Field(..., description="Mandatory email address")


class AdminSetEmployeePasswordRequest(BaseModel):
    admin_password: str = Field(..., description="Current Admin portal password (identity confirmation)")
    new_employee_password: str = Field(..., min_length=8, description="New Employee portal password (min 8 chars)")
    confirm_employee_password: str = Field(..., description="Confirm new employee portal password")


class RegistrationActionRequest(BaseModel):
    action: str = Field(..., description="Action to take: 'APPROVE', 'REJECT', or 'PENDING'")
    remarks: Optional[str] = Field(None, description="Reason for rejection or remarks for pending status")


class ExtendValidityRequest(BaseModel):
    additional_days: int = Field(7, description="Number of additional days to extend validity")


class AddAdminRequest(BaseModel):
    ticket_number: int = Field(..., description="Ticket number of employee to grant admin privileges")


class RegistrationRequestRead(BaseModel):
    request_id: int
    reg_code: str
    ticket_number: int
    name: str
    designation_id: int
    designation_name: Optional[str] = None
    category_name: Optional[str] = None
    email: str
    status: str
    remarks: Optional[str] = None
    valid_until: datetime
    created_at: datetime
    is_expired: bool = False

    model_config = ConfigDict(from_attributes=True)


class LocoAdminRead(BaseModel):
    ticket_number: int
    name: str
    email: str
    is_default: bool
    must_change_password: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogsQueryRequest(BaseModel):
    """Schema for querying system audit logs using HTTP QUERY method."""
    table_name: Optional[str] = None
    operation: Optional[str] = None
    limit: Optional[int] = 300


class RegRequestsQueryRequest(BaseModel):
    """Schema for querying registration requests using HTTP QUERY method."""
    status: Optional[str] = None
    search: Optional[str] = None
    limit: Optional[int] = 300
