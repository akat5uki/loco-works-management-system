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

