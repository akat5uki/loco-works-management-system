import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.features.jobs.models import Job


async def seed():
    # Use PRIMARY database for seeding
    engine = create_async_engine(settings.DATABASE_PRIMARY_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    jobs_data = [
        (501, "IR value", 5),
        (502, "Power cable", 5),
        (503, "Panto calibration", 5),
        (504, "Battery cable continuity", 5),
        (505, "Indoor Light commissioning and screen cover opening", 5),
        (506, "Inside & outside screened control circuit cables continuity", 5),
        (507, "Polarity test", 5),
        (508, "Ratio test", 5),
        (509, "Auxiliary cable continuity", 5),
        (
            510,
            "Heater Ventilation and Crew fan continuity and resistance measurement",
            5,
        ),
        (511, "Choke coil continuity", 5),
        (512, "PT cable meggering", 5),
        (513, "Schematic group 08 + RDSO MS 475, 503", 5),
        (514, "Schematic group 09 + FB, SR continuity", 5),
        (515, "Schematic group 05 + RDSO MS 495", 5),
        (516, "Schematic group 07 + RDSO MS 470, 500", 5),
        (517, "Schematic group 06 + RDSO MS 512, MSD 42", 5),
        (518, "Schematic group 10 + Air Dryer circuit", 5),
        (519, "Schematic group 11 + RDSO MS 505", 5),
        (520, "Schematic group 17 + RDSO MS 507", 5),
        (521, "MVR, MCR setting", 5),
        (522, "VCB timer setting", 5),
        (523, "First charging preparation", 5),
        (524, "VCB to close in D mode in simulation", 5),
        (525, "BUR contactor sequence", 5),
        (526, "Sensor test", 5),
        (
            527,
            "First charging in C & D modes from both cabs with all safety trippings",
            5,
        ),
        (528, "Rotation of all auxiliary machines and battery charger performance", 5),
        (529, "BUR redundancy", 5),
        (530, "Auxiliary machines current measurement", 5),
        (531, "Attend Mechanical faults", 5),
        (701, "Special mode switch operations", 7),
        (702, "Commissioning of both SRs and Traction", 7),
        (703, "Lighting and signalling", 7),
        (704, "RDSO MS + MU VCU reset + ECO mode", 7),
        (705, "AC commissioning", 7),
        (706, "Air flow measurement", 7),
        (707, "Vibration measurement", 7),
        (708, "SPM entry and performance", 7),
        (709, "Earth fault rectification", 7),
        (710, "Normalisation for trial run", 7),
        (711, "Attend trial run faults", 7),
        (712, "DPWCS + RMS + Note software versions", 7),
        (713, "MU operations", 7),
        (714, "Normalisation for despatch", 7),
        (715, "Despatch work", 7),
        (1, "Miscellaneous work", 0),
        (2, "WAP-5 Scheduled Testing work", 0),
    ]

    async with async_session() as session:
        for job_id, desc, stage in jobs_data:
            job = Job(job_id=job_id, job_description=desc, stage=stage)
            session.add(job)
            try:
                await session.commit()
                print(f"Added Job: {job_id} - {desc}")
            except Exception:
                await session.rollback()
                print(f"Job {job_id} already exists.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
