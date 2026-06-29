from datetime import datetime
from typing import List
from pydantic import BaseModel
from app.core.loco_encoder import LocoNumberStr

class TaskCreateInput(BaseModel):
    """Schema for defining tasks to be created inside a job."""
    task_description: str

class JobBookingInput(BaseModel):
    """Schema for booking a specific job with a set of associated tasks."""
    job_id: int
    tasks: List[TaskCreateInput]

class BookingCreateBatch(BaseModel):
    """Schema for batch-creating multiple job bookings for a locomotive on a specific date/shift."""
    loco_number: LocoNumberStr
    date_time: datetime
    shift: int
    bookings: List[JobBookingInput]

class SingleTaskAddInput(BaseModel):
    """Schema for appending a single task to a specific locomotive's job booking."""
    loco_number: LocoNumberStr
    date_time: datetime
    job_id: int
    task_description: str

class SingleJobAddInput(BaseModel):
    """Schema for appending a single job booking to a locomotive."""
    loco_number: LocoNumberStr
    date_time: datetime
    job_id: int
    shift: int

class TaskUpdateInput(BaseModel):
    """Schema for updating the description of an existing booking task."""
    task_description: str

class JobUpdateInput(BaseModel):
    """Schema for migrating/updating the job identifier of a booking."""
    new_job_id: int
