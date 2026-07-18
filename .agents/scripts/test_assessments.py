import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.features.jobs.models import Job, EmployeeJobRating
from app.core.redis import redis_client

async def main():
    print("--- Starting Assessments Flow Integration Verification ---")
    
    # 1. Test database connection & jobs table retrieval
    db_url = "postgresql+asyncpg://locouser:55vAdT43Cf297mwZruZbfg@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("Checking jobs in master record...")
        jobs_res = await session.execute(select(Job).limit(3))
        jobs = jobs_res.scalars().all()
        if not jobs:
            print("WARNING: No jobs found. Seeding dummy job for test...")
            test_job = Job(job_id=999, job_description="Test Telemetry Wiring", stage=5)
            session.add(test_job)
            await session.commit()
            jobs = [test_job]
        
        for j in jobs:
            print(f"Job found: ID={j.job_id}, Desc='{j.job_description}', Stage={j.stage}")

        # Choose a job for the rating check
        target_job_id = jobs[0].job_id
        target_ticket = 1010 # Aastha (Supervisor/Staff ticket)
        
        # 2. Verify Redis keyspace operations
        redis_key = f"assessment:pending:{target_ticket}"
        print(f"Testing Redis write/read under: {redis_key}")
        
        payload = {
            "ticket_number": target_ticket,
            "name": "Aastha",
            "ratings": [{"job_id": target_job_id, "rating": 4}],
            "submitted_at": "2026-07-07T10:00:00Z",
            "status": "PENDING"
        }
        
        # Set
        await redis_client.set(redis_key, json.dumps(payload))
        print("Redis write complete.")
        
        # Get
        retrieved_data = await redis_client.get(redis_key)
        if retrieved_data:
            parsed = json.loads(retrieved_data)
            print(f"Redis read complete: {parsed}")
            assert parsed["ticket_number"] == target_ticket
            assert parsed["ratings"][0]["rating"] == 4
        else:
            print("FAILURE: Could not retrieve rating from Redis.")
            return

        # 3. Simulate Approval: write to PostgreSQL and delete from Redis
        print("Simulating supervisor approval workflow...")
        
        # Check if row exists in DB
        stmt = select(EmployeeJobRating).where(
            EmployeeJobRating.ticket_number == target_ticket,
            EmployeeJobRating.job_id == target_job_id
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.rating = 4
        else:
            new_rating = EmployeeJobRating(ticket_number=target_ticket, job_id=target_job_id, rating=4)
            session.add(new_rating)
        
        await session.commit()
        print("Saved rating successfully to PostgreSQL employee_job_ratings.")
        
        # Delete Redis pending key
        await redis_client.delete(redis_key)
        print("Cleared pending record from Redis.")
        
        # Verify Redis key has been deleted
        still_exists = await redis_client.exists(redis_key)
        assert not still_exists, "Redis pending key should be cleared!"
        print("Verified Redis pending key is completely cleared.")
        
        # 4. Verify DB read back
        stmt_verify = select(EmployeeJobRating).where(
            EmployeeJobRating.ticket_number == target_ticket,
            EmployeeJobRating.job_id == target_job_id
        )
        saved = (await session.execute(stmt_verify)).scalar_one_or_none()
        assert saved is not None
        assert saved.rating == 4
        print(f"Verified PostgreSQL record exists: ticket={saved.ticket_number}, rating={saved.rating}")

        # 5. Clean up test DB record
        await session.delete(saved)
        await session.commit()
        print("Cleaned up test PostgreSQL rating record.")

    await engine.dispose()
    print("--- SUCCESS: All assessments database and cache integration tests passed! ---")

if __name__ == "__main__":
    asyncio.run(main())
