from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import extract, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser, SupervisorUser
from app.features.jobs.models import Job
from app.features.locos.models import Loco, LocoType

router = APIRouter()


# Schemas
class LocoTypeBase(BaseModel):
    loco_type_name: str


class LocoTypeCreate(LocoTypeBase):
    loco_type_id: int


class LocoTypeRead(LocoTypeBase):
    loco_type_id: int
    model_config = ConfigDict(from_attributes=True)


class LocoBase(BaseModel):
    loco_number: int
    loco_type_id: int
    date_time: datetime
    stage: int
    shift: int


class LocoRead(LocoBase):
    model_config = ConfigDict(from_attributes=True)


# Stats
@router.get("/stats/production")
async def get_production_stats(db: AsyncSession = Depends(get_db)):
    year_query = select(
        extract("year", Loco.date_time).label("year"),
        func.count(Loco.loco_number).label("count"),
    ).group_by("year")
    year_result = await db.execute(year_query)
    year_stats = [{"year": int(r.year), "count": r.count} for r in year_result]

    current_year = func.extract("year", func.now())
    month_query = (
        select(
            extract("month", Loco.date_time).label("month"),
            func.count(Loco.loco_number).label("count"),
        )
        .where(extract("year", Loco.date_time) == current_year)
        .group_by("month")
    )
    month_result = await db.execute(month_query)
    month_stats = [{"month": int(r.month), "count": r.count} for r in month_result]

    return {"year_wise": year_stats, "month_wise": month_stats}


# Loco Types CRUD
@router.get("/types", response_model=List[LocoTypeRead])
async def get_loco_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LocoType))
    return result.scalars().all()


@router.post("/types", response_model=LocoTypeRead, status_code=status.HTTP_201_CREATED)
async def create_loco_type(
    loco_type: LocoTypeCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    db_type = LocoType(**loco_type.model_dump())
    db.add(db_type)
    try:
        await db.commit()
        await db.refresh(db_type)
        return db_type
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# Locos CRUD
@router.get("/", response_model=List[LocoRead])
async def get_locos(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Loco))
    return result.scalars().all()


@router.post("/", response_model=LocoRead, status_code=status.HTTP_201_CREATED)
async def create_loco(
    loco: LocoBase, current_user: SupervisorUser, db: AsyncSession = Depends(get_db)
):
    db_loco = Loco(**loco.model_dump())
    db.add(db_loco)
    try:
        await db.commit()
        await db.refresh(db_loco)
        return db_loco
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ongoing-jobs")
async def get_ongoing_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.stage > 0))
    jobs = result.scalars().all()
    return jobs


@router.put("/types/{loco_type_id}", response_model=LocoTypeRead)
async def update_loco_type(
    loco_type_id: int,
    loco_type: LocoTypeBase,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LocoType).where(LocoType.loco_type_id == loco_type_id))
    db_type = result.scalar_one_or_none()
    if not db_type:
        raise HTTPException(status_code=404, detail="Loco type not found")
    
    for key, value in loco_type.model_dump().items():
        setattr(db_type, key, value)
    
    try:
        await db.commit()
        await db.refresh(db_type)
        return db_type
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/types/{loco_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loco_type(
    loco_type_id: int,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LocoType).where(LocoType.loco_type_id == loco_type_id))
    db_type = result.scalar_one_or_none()
    if not db_type:
        raise HTTPException(status_code=404, detail="Loco type not found")
    
    await db.delete(db_type)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{loco_number}", response_model=LocoRead)
async def update_loco(
    loco_number: int,
    loco: LocoBase,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Loco).where(Loco.loco_number == loco_number))
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(status_code=404, detail="Locomotive not found")
    
    for key, value in loco.model_dump().items():
        setattr(db_loco, key, value)
    
    try:
        await db.commit()
        await db.refresh(db_loco)
        return db_loco
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{loco_number}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loco(
    loco_number: int,
    current_user: SupervisorUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Loco).where(Loco.loco_number == loco_number))
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(status_code=404, detail="Locomotive not found")
    
    await db.delete(db_loco)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

