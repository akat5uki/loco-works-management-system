from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AdminLoginRequest(BaseModel):
    ticket_number: int = Field(..., description="Admin employee ticket number")
    password: str = Field(..., description="Admin password")


class AdminChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password")


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
    email: Optional[str] = None
    is_default: bool
    must_change_password: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
