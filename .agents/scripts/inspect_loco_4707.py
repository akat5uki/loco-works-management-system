import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = "postgresql+asyncpg://locouser:55vAdT43Cf297mwZruZbfg@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        print("--- Querying employee_bookings for loco 4707 ---")
        res = await conn.execute(text("SELECT * FROM employee_bookings WHERE loco_number = 4707000"))
        rows = res.mappings().all()
        print(f"Found {len(rows)} employee_bookings:")
        for r in rows:
            print(dict(r))

        print("\n--- Querying distinct dates in employee_bookings ---")
        res = await conn.execute(text("SELECT DISTINCT date_time, shift FROM employee_bookings"))
        rows = res.mappings().all()
        for r in rows:
            print(dict(r))

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
