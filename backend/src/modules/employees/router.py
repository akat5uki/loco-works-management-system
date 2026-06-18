from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.core.database import get_db
from src.modules.employees.models import Designation, EmployeeCategory

router = APIRouter()


@router.get("/designations")
async def get_designations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Designation))
    return result.scalars().all()


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmployeeCategory))
    return result.scalars().all()
