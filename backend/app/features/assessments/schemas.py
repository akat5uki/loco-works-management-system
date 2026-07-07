from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional

class RatingItem(BaseModel):
    """Schema for individual job competency rating."""
    job_id: int
    rating: int

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not (0 <= v <= 5):
            raise ValueError("Rating must be between 0 and 5 inclusive")
        return v

class SelfAssessmentSubmit(BaseModel):
    """Schema for staff to submit their self-assessment list."""
    ratings: List[RatingItem]

class SelfAssessmentRead(BaseModel):
    """Schema for reading pending staff assessments from Redis."""
    ticket_number: int
    name: str
    designation_name: str
    ratings: List[RatingItem]
    submitted_at: str
    status: str = "PENDING"

class AssessmentApproval(BaseModel):
    """Schema for supervisor to approve/modify a staff assessment."""
    ratings: List[RatingItem]

class AssessmentRejection(BaseModel):
    """Schema for supervisor to reject a staff self-assessment."""
    remarks: Optional[str] = None

class EmployeeRatingRead(BaseModel):
    """Schema for reading approved employee job ratings from PostgreSQL."""
    job_id: int
    job_description: str
    stage: int
    rating: int
    model_config = ConfigDict(from_attributes=True)
