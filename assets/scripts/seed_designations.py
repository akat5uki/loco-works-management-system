import asyncio
import os
import sys

# Find workspace root dynamically
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(CURRENT_DIR) == "scripts":
    WORKSPACE_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
elif os.path.basename(CURRENT_DIR) in ("assets", "backend"):
    WORKSPACE_ROOT = os.path.dirname(CURRENT_DIR)
else:
    WORKSPACE_ROOT = CURRENT_DIR

# Ensure backend directory is in python module path
sys.path.append(os.path.join(WORKSPACE_ROOT, "backend"))

# Load and translate .env variables for host machine execution
env_path = os.path.join(WORKSPACE_ROOT, ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                val = val.replace("db-primary", "localhost")
                val = val.replace("db-replica", "localhost")
                val = val.replace("redis-sentinel-1", "localhost")
                val = val.replace("redis-sentinel-2", "localhost")
                val = val.replace("redis-sentinel-3", "localhost")
                val = val.replace("redis:", "localhost:")
                os.environ[key] = val

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
