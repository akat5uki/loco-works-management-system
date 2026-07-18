from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.exceptions import handle_db_error
from app.features.auth.dependencies import AnyUser, SupervisorOrAdminUser
from app.features.jobs.models import Job
from app.features.jobs.schemas import JobBase, JobCreate, JobRead, JobQueryRequest

router = APIRouter()


# Jobs CRUD
@router.get("/", response_model=List[JobRead])
async def get_jobs(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    """
    Retrieve all job definitions.
    Accessible by any authenticated portal user. Returns a list of all active jobs.
    """
    result = await db.execute(select(Job))
    return result.scalars().all()


@router.post("/", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate, current_user: SupervisorOrAdminUser, db: AsyncSession = Depends(get_db)
):
    """
    Create a new job definition.
    Requires Supervisor or Admin privileges. Validates that the job ID is unique and consists of numeric digits.
    """
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
    """
    Update an existing job definition.
    Requires Supervisor or Admin privileges. Modifies description or target stage attributes.
    """
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
    """
    Delete a job definition.
    Requires Supervisor or Admin privileges. Removes the job configuration from the master records database.
    """
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


@router.api_route("/query", methods=["QUERY"], response_model=List[JobRead])
async def query_jobs(
    request: JobQueryRequest,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Experimental HTTP QUERY endpoint. Query jobs dynamically by description or stage filter.
    Idempotent search utilizing request payload.
    """
    stmt = select(Job)
    if request.description:
        stmt = stmt.where(Job.job_description.ilike(f"%{request.description}%"))
    if request.stage is not None:
        stmt = stmt.where(Job.stage == request.stage)
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.api_route("/query-public", methods=["QUERY"])
async def query_public_test(payload: dict):
    """
    Experimental public HTTP QUERY endpoint. Simply echoes back the payload.
    Used for testing the QUERY method compatibility.
    """
    return {"message": "Experimental HTTP QUERY method working!", "echo": payload}
