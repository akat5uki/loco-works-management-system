from pydantic import BaseModel, ConfigDict, field_validator

class JobBase(BaseModel):
    """Base schema for defining jobs within the works management system."""
    job_description: str
    stage: int

class JobCreate(JobBase):
    """Schema for registering a new job with a numeric Job ID validation."""
    job_id: str

    @field_validator('job_id')
    @classmethod
    def validate_id(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Job ID must contain only digits")
        return int(v)

class JobRead(JobBase):
    """Schema for loading/reading job records from the database."""
    job_id: int
    model_config = ConfigDict(from_attributes=True)
