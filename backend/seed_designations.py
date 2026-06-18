import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.features.employees.models import Designation, EmployeeCategory


async def seed():
    engine = create_async_engine(settings.DATABASE_PRIMARY_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Ensure a default category exists
        category = EmployeeCategory(category_id=1, category_name="Technical")
        session.add(category)
        try:
            await session.commit()
            print("Added 'Technical' category.")
        except Exception as e:
            await session.rollback()
            print(f"'Technical' category already exists. Error: {e}")

        # 2. Add designations
        designations = [
            "SSE",
            "JE",
            "Sr. Tech/MCM",
            "Tech-I",
            "Tech-II",
            "Tech-III",
            "Helper",
        ]

        for i, name in enumerate(designations, 1):
            desig = Designation(designation_id=i, designation_name=name, category_id=1)
            session.add(desig)
            try:
                await session.commit()
                print(f"Added designation: {name}")
            except Exception as e:
                await session.rollback()
                print(
                    f"Designation {name} already exists or error occurred. Error: {e}"
                )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
