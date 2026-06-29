from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from app.core.loco_encoder import LocoNumberStr

class LocoTypeBase(BaseModel):
    """Base schema for defining locomotive types (e.g. WAP7, WAG9)."""
    loco_type_name: str

class LocoTypeCreate(LocoTypeBase):
    """Schema for registering a new locomotive type with numeric ID validation."""
    loco_type_id: str

    @field_validator('loco_type_id')
    @classmethod
    def validate_id(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Type ID must contain only digits")
        return int(v)

class LocoTypeRead(LocoTypeBase):
    """Schema for loading/reading locomotive type details from the database."""
    loco_type_id: int
    model_config = ConfigDict(from_attributes=True)

class LocoBase(BaseModel):
    """Base schema representing a locomotive record in the shop/works."""
    loco_number: LocoNumberStr
    loco_type_id: int
    date_time: Optional[datetime] = None
    stage: int
    shift: Optional[int] = None
    despatched: bool = False

class LocoRead(BaseModel):
    """Schema for loading/reading active or dispatched locomotive records."""
    loco_number: LocoNumberStr
    loco_type_id: int
    stage: int
    despatched: bool = False
    despatch_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
