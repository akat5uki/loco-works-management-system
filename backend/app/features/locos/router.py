from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Integer, extract, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import handle_db_error
from app.core.loco_encoder import encode_loco_number
from app.features.auth.dependencies import AnyUser, SupervisorOrAdminUser
from app.features.jobs.models import Job
from app.features.locos.models import Loco, LocoType
from app.features.bookings.models import LocoBooking
from app.features.locos.schemas import (
    LocoTypeBase,
    LocoTypeCreate,
    LocoTypeRead,
    LocoBase,
    LocoRead,
)

router = APIRouter()


# Stats
@router.get("/stats/production")
async def get_production_stats(db: AsyncSession = Depends(get_db)):
    year_query = select(
        extract("year", LocoBooking.date_time).label("year"),
        func.count(func.distinct(LocoBooking.loco_number)).label("count"),
    ).group_by("year")
    year_result = await db.execute(year_query)
    year_stats = [{"year": int(r.year), "count": r.count} for r in year_result]

    current_year = func.extract("year", func.now())
    month_query = (
        select(
            extract("month", LocoBooking.date_time).label("month"),
            func.count(func.distinct(LocoBooking.loco_number)).label("count"),
        )
        .where(extract("year", LocoBooking.date_time) == current_year)
        .group_by("month")
    )
    month_result = await db.execute(month_query)
    month_stats = [{"month": int(r.month), "count": r.count} for r in month_result]

    return {"year_wise": year_stats, "month_wise": month_stats}


# Loco Types CRUD
@router.get("/types", response_model=List[LocoTypeRead])
async def get_loco_types(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LocoType))
    return result.scalars().all()


@router.post("/types", response_model=LocoTypeRead, status_code=status.HTTP_201_CREATED)
async def create_loco_type(
    loco_type: LocoTypeCreate,
    current_user: SupervisorOrAdminUser,
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
        handle_db_error(e)


# Locos CRUD
@router.get("/", response_model=List[LocoRead])
async def get_locos(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Loco))
    return result.scalars().all()


@router.get("/type-counts")
async def get_loco_type_counts(db: AsyncSession = Depends(get_db)):
    """Return each loco type with total, active and despatched counts. Public endpoint."""
    result = await db.execute(
        select(
            LocoType.loco_type_id,
            LocoType.loco_type_name,
            func.count(Loco.loco_number).label("total"),
            func.sum(func.cast(Loco.despatched, Integer)).label("despatched_count"),
        )
        .outerjoin(Loco, Loco.loco_type_id == LocoType.loco_type_id)
        .group_by(LocoType.loco_type_id, LocoType.loco_type_name)
        .order_by(LocoType.loco_type_name)
    )
    rows = result.all()
    return [
        {
            "loco_type_id": r.loco_type_id,
            "loco_type_name": r.loco_type_name,
            "total": r.total or 0,
            "active": (r.total or 0) - (r.despatched_count or 0),
            "despatched": r.despatched_count or 0,
        }
        for r in rows
    ]


@router.post("/", response_model=LocoRead, status_code=status.HTTP_201_CREATED)
async def create_loco(
    loco: LocoBase, current_user: SupervisorOrAdminUser, db: AsyncSession = Depends(get_db)
):
    if loco.stage not in settings.loco_stages_list:
        valid_stages_str = ", ".join(map(str, settings.loco_stages_list))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage. Stage must be one of {valid_stages_str}."
        )
    if loco.despatched and loco.stage != 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A despatched locomotive must have stage set to 9."
        )
    if loco.stage == 9 and not loco.despatched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A locomotive at stage 9 must be marked as despatched."
        )
    data = loco.model_dump()
    data["loco_number"] = encode_loco_number(data["loco_number"])
    data.pop("date_time", None)
    data.pop("shift", None)
    db_loco = Loco(**data)
    if db_loco.despatched:
        db_loco.despatch_date = datetime.now(timezone.utc)
    db.add(db_loco)
    try:
        await db.commit()
        await db.refresh(db_loco)
        return db_loco
    except Exception as e:
        await db.rollback()
        handle_db_error(e)


@router.get("/ongoing-jobs")
async def get_ongoing_jobs(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.stage > 0))
    jobs = result.scalars().all()
    return jobs


@router.put("/types/{loco_type_id}", response_model=LocoTypeRead)
async def update_loco_type(
    loco_type_id: int,
    loco_type: LocoTypeBase,
    current_user: SupervisorOrAdminUser,
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
        handle_db_error(e)


@router.delete("/types/{loco_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loco_type(
    loco_type_id: int,
    current_user: SupervisorOrAdminUser,
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
        handle_db_error(e)


@router.put("/{loco_number}", response_model=LocoRead)
async def update_loco(
    loco_number: str,
    loco: LocoBase,
    current_user: SupervisorOrAdminUser,
    db: AsyncSession = Depends(get_db),
):
    if loco.stage not in settings.loco_stages_list:
        valid_stages_str = ", ".join(map(str, settings.loco_stages_list))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage. Stage must be one of {valid_stages_str}."
        )
    if loco.despatched and loco.stage != 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A despatched locomotive must have stage set to 9."
        )
    if loco.stage == 9 and not loco.despatched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A locomotive at stage 9 must be marked as despatched."
        )
    loco_number_int = encode_loco_number(loco_number)
    result = await db.execute(select(Loco).where(Loco.loco_number == loco_number_int))
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(status_code=404, detail="Locomotive not found")
    
    data = loco.model_dump()
    data["loco_number"] = encode_loco_number(data["loco_number"])
    data.pop("date_time", None)
    data.pop("shift", None)
    
    # Capture or reset despatch date
    if data.get("despatched"):
        if not db_loco.despatched or db_loco.despatch_date is None:
            db_loco.despatch_date = datetime.now(timezone.utc)
    else:
        db_loco.despatch_date = None

    for key, value in data.items():
        setattr(db_loco, key, value)
    
    try:
        await db.commit()
        await db.refresh(db_loco)
        return db_loco
    except Exception as e:
        await db.rollback()
        handle_db_error(e)


@router.delete("/{loco_number}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loco(
    loco_number: str,
    current_user: SupervisorOrAdminUser,
    db: AsyncSession = Depends(get_db),
):
    loco_number_int = encode_loco_number(loco_number)
    result = await db.execute(select(Loco).where(Loco.loco_number == loco_number_int))
    db_loco = result.scalar_one_or_none()
    if not db_loco:
        raise HTTPException(status_code=404, detail="Locomotive not found")
    
    await db.delete(db_loco)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        handle_db_error(e)

