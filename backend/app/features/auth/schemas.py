from pydantic import BaseModel, field_validator
from typing import Optional
import re


class LoginRequest(BaseModel):
    ticket_number: str
    password: str
    captcha: Optional[str] = None

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    ticket_number: Optional[int] = None


class UserRegister(BaseModel):
    ticket_number: str
    name: str
    designation_id: int
    password: str
    email: str
    captcha: Optional[str] = None

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) <= 8:
            raise ValueError("Password length must be greater than 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one numeric digit")
        if not re.search(r"[^a-zA-Z0-9]", v):
            raise ValueError("Password must contain at least one special character")
        return v



class VerifyOTPRequest(BaseModel):
    ticket_number: str
    otp: str
    type: str  # "registration" | "login" | "email_registration"

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)


class RegisterEmailRequest(BaseModel):
    ticket_number: str
    email: str

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.lower().strip()


class ForgotPasswordRequest(BaseModel):
    ticket_number: str

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)


class ResetPasswordRequest(BaseModel):
    ticket_number: str
    otp: str
    new_password: str

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)


class ResendOTPRequest(BaseModel):
    ticket_number: str
    type: str  # "registration" | "login" | "email_registration"

    @field_validator('ticket_number')
    @classmethod
    def validate_ticket_number(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Ticket number must contain only digits")
        return int(v)

class EmployeeChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
