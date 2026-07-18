import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.redis import redis_client
from app.features.auth.dependencies import CurrentUser
from app.features.jobs.models import Job, EmployeeJobRating
from app.features.employee_bookings.models import EmployeeNotification
from app.features.employees.models import Employee
from app.features.assessments.schemas import (
    SelfAssessmentSubmit,
    SelfAssessmentRead,
    AssessmentApproval,
    AssessmentRejection,
    EmployeeRatingRead,
)

router = APIRouter()

def get_pending_key(ticket_number: int) -> str:
    return f"assessment:pending:{ticket_number}"

def check_supervisor(current_user: CurrentUser):
    """Enforces Double-Guarding Security check for Supervisor role category."""
    if not current_user.designation or current_user.designation.category_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only supervisors are authorized to perform this operation."
        )

def check_staff(current_user: CurrentUser):
    """Enforces Double-Guarding Security check for Staff role category."""
    if current_user.designation and current_user.designation.category_id == 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Supervisors are not permitted to submit self-assessments."
        )

@router.post("/self", status_code=status.HTTP_201_CREATED)
async def submit_self_assessment(
    data: SelfAssessmentSubmit,
    current_user: CurrentUser,
):
    """
    Submit or update employee self-assessment.
    Saves assessment temporarily in Redis for supervisor approval.
    """
    check_staff(current_user)

    redis_key = get_pending_key(current_user.ticket_number)
    payload = {
        "ticket_number": current_user.ticket_number,
        "name": current_user.name,
        "designation_name": current_user.designation.designation_name if current_user.designation else "Staff",
        "ratings": [r.model_dump() for r in data.ratings],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "PENDING"
    }

    # Store in Redis (no TTL so it doesn't expire prematurely before review)
    await redis_client.set(redis_key, json.dumps(payload))
    return {"message": "Self-assessment submitted successfully for supervisor approval."}

@router.get("/self")
async def get_self_assessment(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve logged-in user's pending assessment from Redis
    and approved ratings from PostgreSQL.
    """
    check_staff(current_user)

    # 1. Read pending from Redis
    redis_key = get_pending_key(current_user.ticket_number)
    pending_data = await redis_client.get(redis_key)
    pending = json.loads(pending_data) if pending_data else None

    # 2. Read approved from PostgreSQL
    stmt = (
        select(EmployeeJobRating, Job)
        .join(Job, EmployeeJobRating.job_id == Job.job_id)
        .where(EmployeeJobRating.ticket_number == current_user.ticket_number)
    )
    res = await db.execute(stmt)
    rows = res.all()
    approved = [
        {
            "job_id": r[0].job_id,
            "job_description": r[1].job_description,
            "stage": r[1].stage,
            "rating": r[0].rating,
        }
        for r in rows
    ]

    return {
        "pending": pending,
        "approved": approved
    }

@router.get("/pending", response_model=List[SelfAssessmentRead])
async def get_pending_assessments(
    current_user: CurrentUser
):
    """
    Supervisor-only.
    List all pending self-assessments in Redis.
    """
    check_supervisor(current_user)

    # Find keys matching wildcard pattern
    keys = await redis_client.keys("assessment:pending:*")
    pending_list = []
    for key in keys:
        data = await redis_client.get(key)
        if data:
            pending_list.append(json.loads(data))
    
    # Sort by submission date descending
    pending_list.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
    return pending_list

@router.post("/approve/{ticket_number}")
async def approve_assessment(
    ticket_number: int,
    data: AssessmentApproval,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Approve staff self-assessment (with optional edits to ratings).
    Saves to PostgreSQL database and deletes from Redis.
    """
    check_supervisor(current_user)

    redis_key = get_pending_key(ticket_number)
    pending_exists = await redis_client.exists(redis_key)
    if not pending_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending self-assessment found for this employee."
        )

    # Write ratings to PostgreSQL
    for item in data.ratings:
        # Verify job exists
        job_exists = await db.execute(select(Job).where(Job.job_id == item.job_id))
        if not job_exists.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job ID {item.job_id} does not exist in master records."
            )

        stmt = select(EmployeeJobRating).where(
            EmployeeJobRating.ticket_number == ticket_number,
            EmployeeJobRating.job_id == item.job_id
        )
        rating_obj = (await db.execute(stmt)).scalar_one_or_none()
        if rating_obj:
            rating_obj.rating = item.rating
        else:
            rating_obj = EmployeeJobRating(
                ticket_number=ticket_number,
                job_id=item.job_id,
                rating=item.rating
            )
            db.add(rating_obj)

    # Clear pending Redis key
    await redis_client.delete(redis_key)

    # Dispatch notification to staff member
    notif = EmployeeNotification(
        ticket_number=ticket_number,
        message="Your self-assessment has been approved by the supervisor.",
        is_read=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(notif)
    await db.commit()

    return {"message": f"Successfully approved and stored assessments for employee #{ticket_number}."}

@router.post("/reject/{ticket_number}")
async def reject_assessment(
    ticket_number: int,
    data: AssessmentRejection,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Reject employee self-assessment.
    Clears key from Redis and sends warning notification to employee.
    """
    check_supervisor(current_user)

    redis_key = get_pending_key(ticket_number)
    pending_exists = await redis_client.exists(redis_key)
    if not pending_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending self-assessment found for this employee."
        )

    # Clear pending from Redis
    await redis_client.delete(redis_key)

    # Create notification message with optional remarks
    msg = "Your self-assessment was rejected by the supervisor."
    if data.remarks:
        msg += f" Remarks: {data.remarks}"

    notif = EmployeeNotification(
        ticket_number=ticket_number,
        message=msg,
        is_read=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(notif)
    await db.commit()

    return {"message": f"Successfully rejected assessment for employee #{ticket_number}."}

@router.get("/ratings/{ticket_number}", response_model=List[EmployeeRatingRead])
async def get_staff_ratings(
    ticket_number: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Retrieve approved PostgreSQL ratings for a specific staff member.
    """
    check_supervisor(current_user)

    stmt = (
        select(EmployeeJobRating, Job)
        .join(Job, EmployeeJobRating.job_id == Job.job_id)
        .where(EmployeeJobRating.ticket_number == ticket_number)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return [
        {
            "job_id": r[0].job_id,
            "job_description": r[1].job_description,
            "stage": r[1].stage,
            "rating": r[0].rating,
        }
        for r in rows
    ]

@router.post("/ratings/{ticket_number}")
async def save_staff_ratings_direct(
    ticket_number: int,
    data: SelfAssessmentSubmit,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Direct CRUD updates or creations of ratings in PostgreSQL for a staff member (bypasses Redis).
    """
    check_supervisor(current_user)

    # Verify staff exists in Employee model
    staff_exists = await db.execute(select(Employee).where(Employee.ticket_number == ticket_number))
    if not staff_exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff ticket number not found in employee registry."
        )

    for item in data.ratings:
        job_exists = await db.execute(select(Job).where(Job.job_id == item.job_id))
        if not job_exists.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job ID {item.job_id} does not exist in master records."
            )

        stmt = select(EmployeeJobRating).where(
            EmployeeJobRating.ticket_number == ticket_number,
            EmployeeJobRating.job_id == item.job_id
        )
        rating_obj = (await db.execute(stmt)).scalar_one_or_none()
        if rating_obj:
            rating_obj.rating = item.rating
        else:
            rating_obj = EmployeeJobRating(
                ticket_number=ticket_number,
                job_id=item.job_id,
                rating=item.rating
            )
            db.add(rating_obj)

    await db.commit()
    return {"message": f"Successfully updated ratings database directly for employee #{ticket_number}."}

@router.delete("/ratings/{ticket_number}")
async def delete_all_staff_ratings(
    ticket_number: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Delete all ratings records for a specific staff member.
    """
    check_supervisor(current_user)

    stmt = select(EmployeeJobRating).where(EmployeeJobRating.ticket_number == ticket_number)
    res = await db.execute(stmt)
    rows = res.scalars().all()
    for row in rows:
        await db.delete(row)
    await db.commit()
    return {"message": f"Successfully deleted all competency ratings for employee #{ticket_number}."}

@router.delete("/ratings/{ticket_number}/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_single_staff_rating(
    ticket_number: int,
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Supervisor-only.
    Delete a single job rating record for a staff member.
    """
    check_supervisor(current_user)

    stmt = select(EmployeeJobRating).where(
        EmployeeJobRating.ticket_number == ticket_number,
        EmployeeJobRating.job_id == job_id
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating record not found."
        )

    await db.delete(row)
    await db.commit()
