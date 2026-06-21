from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.features.employees.models import Designation, Employee, EmployeeCategory

router = APIRouter()


@router.get("/")
async def get_employees(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Employee, Designation, EmployeeCategory)
        .join(Designation, Employee.designation_id == Designation.designation_id)
        .join(EmployeeCategory, Designation.category_id == EmployeeCategory.category_id)
    )
    rows = result.all()
    return [
        {
            "ticket_number": r[0].ticket_number,
            "name": r[0].name,
            "designation_id": r[0].designation_id,
            "designation_name": r[1].designation_name,
            "category_id": r[1].category_id,
            "category_name": r[2].category_name,
        }
        for r in rows
    ]


@router.get("/designations")
async def get_designations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Designation))
    return result.scalars().all()


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmployeeCategory))
    return result.scalars().all()


@router.get("/stats")
async def get_employee_stats(db: AsyncSession = Depends(get_db)):
    """Return total employee count and a breakdown by designation. Public endpoint."""
    result = await db.execute(
        select(
            Designation.designation_name,
            EmployeeCategory.category_name,
            func.count(Employee.ticket_number).label("count"),
        )
        .join(Employee, Employee.designation_id == Designation.designation_id)
        .join(EmployeeCategory, Designation.category_id == EmployeeCategory.category_id)
        .group_by(Designation.designation_name, EmployeeCategory.category_name)
        .order_by(func.count(Employee.ticket_number).desc())
    )
    rows = result.all()
    total = sum(r.count for r in rows)
    return {
        "total": total,
        "by_designation": [
            {
                "designation_name": r.designation_name,
                "category_name": r.category_name,
                "count": r.count,
            }
            for r in rows
        ],
    }
