from typing import List, Optional
from pydantic import BaseModel
from app.core.loco_encoder import LocoNumberStr

class AvailabilityUpdatePayload(BaseModel):
    """Schema for updating the availability of multiple employees for a specific date and shift."""
    date_str: str  # YYYY-MM-DD
    shift: int
    ticket_numbers: List[int]

class BookingSavePayload(BaseModel):
    """Schema for saving/allocating supervisor and staff bookings for a locomotive on a specific date/shift."""
    date_str: str  # YYYY-MM-DD
    shift: int
    loco_number: LocoNumberStr
    supervisor_ticket_numbers: Optional[List[int]] = None
    supervisor_ticket_number: Optional[int] = None
    staff_ticket_numbers: Optional[List[int]] = None
    forward: bool = False
    phase: Optional[int] = None

class LockPayload(BaseModel):
    """Schema for locking/finalizing bookings for a specific date and shift."""
    date_str: str
    shift: int

class TaskRemarkPayload(BaseModel):
    """Schema for updating task remarks and marking a task as completed or incomplete."""
    task_id: int
    completed: bool
    remarks: str

class JobRemarkPayload(BaseModel):
    """Schema for updating job remarks along with individual task remarks."""
    job_id: int
    completed: bool
    remarks: str
    task_remarks: List[TaskRemarkPayload] = []

class NewTaskPayload(BaseModel):
    """Schema for introducing a new task for carry-forward during shift handover."""
    job_id: int
    task_description: str

class RemarksSubmitPayload(BaseModel):
    """Schema for submitting complete job and task remarks, and specifying carry-forward jobs/tasks."""
    loco_number: LocoNumberStr
    date_str: str  # YYYY-MM-DD
    shift: int
    job_remarks: List[JobRemarkPayload]
    new_jobs: List[int] = []  # carry forward new jobs to next shift
    new_tasks: List[NewTaskPayload] = []  # carry forward new tasks to next shift


class BookingQueryRequest(BaseModel):
    """Schema for querying availabilities and views using HTTP QUERY method."""
    date_str: str  # YYYY-MM-DD
    shift: int
