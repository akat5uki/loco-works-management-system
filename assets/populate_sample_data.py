import asyncio
import csv
import os
import secrets
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

# Find workspace root dynamically
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(CURRENT_DIR) in ("assets", "backend"):
    WORKSPACE_ROOT = os.path.dirname(CURRENT_DIR)
else:
    WORKSPACE_ROOT = CURRENT_DIR

# Robust paths
SAMPLE_DATA_DIR = os.path.join(WORKSPACE_ROOT, "assets", "sample data")
env_path = os.path.join(WORKSPACE_ROOT, ".env")

# Ensure backend directory is in python module path
sys.path.append(os.path.join(WORKSPACE_ROOT, "backend"))

# Load and translate .env variables for host machine execution
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
                # Replace container names with localhost for host execution
                val = val.replace("db-primary", "localhost")
                val = val.replace("db-replica", "localhost")
                val = val.replace("redis-sentinel-1", "localhost")
                val = val.replace("redis-sentinel-2", "localhost")
                val = val.replace("redis-sentinel-3", "localhost")
                val = val.replace("redis:", "localhost:")
                os.environ[key] = val

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import get_password_hash
from app.core.loco_encoder import encode_loco_number
from app.features.employees.models import EmployeeCategory, Designation, Employee
from app.features.locos.models import LocoType, Loco
from app.features.jobs.models import Job

async def populate():
    # Set up DB connection
    engine = create_async_engine(settings.DATABASE_PRIMARY_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Truncating tables...")
    async with engine.begin() as conn:
        await conn.execute(text("""
            TRUNCATE TABLE
                employee_availability,
                employee_bookings,
                employee_notifications,
                loco_booking_remarks,
                loco_bookings,
                booking_tasks,
                employee_job_ratings,
                employees,
                loco,
                jobs,
                tasks,
                designation,
                employee_category,
                loco_type
            CASCADE;
        """))
    print("Tables truncated successfully.")

    # Calculate current date and shift in Asia/Kolkata timezone
    tz = ZoneInfo("Asia/Kolkata")
    now = datetime.now(tz)
    current_date = now.date()
    current_shift = 1 if 8 <= now.hour < 20 else 2
    local_dt = datetime.combine(current_date, datetime.min.time(), tzinfo=tz)
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))

    print(f"Target date: {current_date}, Target shift: {current_shift}, datetime: {utc_dt}")

    async with async_session() as session:
        # 1. Populate employee_category
        category_file = os.path.join(SAMPLE_DATA_DIR, "employee catergory sample data.csv")
        print(f"Reading employee categories from {category_file}...")
        with open(category_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cat = EmployeeCategory(
                    category_id=int(row["category_id"]),
                    category_name=row["category_name"]
                )
                session.add(cat)
        await session.commit()
        print("Employee categories populated.")

        # 2. Populate designation
        designation_file = os.path.join(SAMPLE_DATA_DIR, "designation sample data.csv")
        print(f"Reading designations from {designation_file}...")
        with open(designation_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                desig = Designation(
                    designation_id=int(row["designation_id"]),
                    designation_name=row["designation_name"],
                    category_id=int(row["category_id"])
                )
                session.add(desig)
        await session.commit()
        print("Designations populated.")

        # 3. Populate employees
        employee_file = os.path.join(SAMPLE_DATA_DIR, "employee sample data.csv")
        print(f"Reading employees from {employee_file}...")
        hashed_password = get_password_hash("abcd")
        with open(employee_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                emp = Employee(
                    ticket_number=int(row["ticket_number"]),
                    name=row["Name"],
                    designation_id=int(row["designation_id"]),
                    password=hashed_password,
                    nonce=secrets.token_hex(16)
                )
                session.add(emp)
        await session.commit()
        print("Employees populated.")

        # 4. Populate loco_type
        loco_type_file = os.path.join(SAMPLE_DATA_DIR, "loco type sample data.csv")
        print(f"Reading loco types from {loco_type_file}...")
        with open(loco_type_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lt = LocoType(
                    loco_type_id=int(row["loco_type_id"]),
                    loco_type_name=row["loco_type_name"]
                )
                session.add(lt)
        await session.commit()
        print("Loco types populated.")

        # 5. Populate loco
        loco_file = os.path.join(SAMPLE_DATA_DIR, "loco sample data.csv")
        print(f"Reading locos from {loco_file}...")
        with open(loco_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse despatched
                desp_str = row["despatched"].strip().upper()
                desp = True if desp_str == "TRUE" else False

                loco = Loco(
                    loco_number=encode_loco_number(row["loco_number"]),
                    loco_type_id=int(row["loco_type_id"]),
                    stage=5,  # user requested default stage 5
                    despatched=desp
                )
                session.add(loco)
        await session.commit()
        print("Locomotives populated.")

        # 6. Populate jobs
        jobs_file = os.path.join(SAMPLE_DATA_DIR, "jobs sample data.csv")
        print(f"Reading jobs from {jobs_file}...")
        with open(jobs_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse job ID string (strip "JOB-")
                raw_id = row["JOB ID"].strip()
                if raw_id.startswith("JOB-"):
                    job_id = int(raw_id[4:])
                else:
                    job_id = int(raw_id)

                job = Job(
                    job_id=job_id,
                    job_description=row["JOB DESCRIPTION"],
                    stage=int(row["STAGE"])
                )
                session.add(job)
        await session.commit()
        print("Jobs populated.")

    await engine.dispose()
    print("Database population completed successfully!")

if __name__ == "__main__":
    asyncio.run(populate())
