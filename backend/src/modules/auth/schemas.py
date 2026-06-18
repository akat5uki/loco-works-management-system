from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    ticket_number: int
    password: str
    captcha: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    ticket_number: Optional[int] = None


class UserRegister(BaseModel):
    ticket_number: int
    name: str
    designation_id: int
    password: str
