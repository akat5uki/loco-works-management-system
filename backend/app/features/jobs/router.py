from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.exceptions import handle_db_error
from app.features.auth.dependencies import AnyUser, SupervisorOrAdminUser
from app.features.jobs.models import Job

router = APIRouter()


# Schemas
class JobBase(BaseModel):
    job_description: str
    stage: int


class JobCreate(JobBase):
    job_id: str

    @field_validator('job_id')
    @classmethod
    def validate_id(cls, v: str) -> int:
        if not v.isdigit():
            raise ValueError("Job ID must contain only digits")
        return int(v)


class JobRead(JobBase):
    job_id: int
    model_config = ConfigDict(from_attributes=True)


# Jobs CRUD
@router.get("/", response_model=List[JobRead])
async def get_jobs(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job))
    return result.scalars().all()


@router.post("/", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate, current_user: SupervisorOrAdminUser, db: AsyncSession = Depends(get_db)
):
    db_job = Job(**job.model_dump())
    db.add(db_job)
    try:
        await db.commit()
        await db.refresh(db_job)
        return db_job
    except Exception as e:
        await db.rollback()
        handle_db_error(e)


@router.put("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: int,
    job: JobBase,
    current_user: SupervisorOrAdminUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.job_id == job_id))
    db_job = result.scalar_one_or_none()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    for key, value in job.model_dump().items():
        setattr(db_job, key, value)
    
    try:
        await db.commit()
        await db.refresh(db_job)
        return db_job
    except Exception as e:
        await db.rollback()
        handle_db_error(e)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    current_user: SupervisorOrAdminUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.job_id == job_id))
    db_job = result.scalar_one_or_none()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await db.delete(db_job)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        handle_db_error(e)
