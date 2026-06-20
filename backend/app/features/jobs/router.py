from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.exceptions import handle_db_error
from app.features.auth.dependencies import CurrentUser, SupervisorUser
from app.features.jobs.models import Job, Task

router = APIRouter()


# Schemas
class JobBase(BaseModel):
    job_id: int
    job_description: str
    stage: int


class JobRead(JobBase):
    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    task_id: int
    task_description: str


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)


# Jobs CRUD
@router.get("/", response_model=List[JobRead])
async def get_jobs(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job))
    return result.scalars().all()


@router.post("/", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobBase, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
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


# Tasks CRUD
@router.get("/tasks", response_model=List[TaskRead])
async def get_tasks(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task))
    return result.scalars().all()


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskBase, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    db_task = Task(**task.model_dump())
    db.add(db_task)
    try:
        await db.commit()
        await db.refresh(db_task)
        return db_task
    except Exception as e:
        await db.rollback()
        handle_db_error(e)


@router.put("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: int,
    job: JobBase,
    current_user: SupervisorUser,
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
    current_user: SupervisorUser,
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
