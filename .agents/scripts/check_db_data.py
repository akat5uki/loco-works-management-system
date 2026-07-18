import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = "postgresql+asyncpg://locouser:locopass@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        print("--- jobs table ---")
        res = await conn.execute(text("SELECT * FROM jobs ORDER BY job_id"))
        for row in res.mappings():
            print(dict(row))
        print("--- loco_type table ---")
        res = await conn.execute(text("SELECT * FROM loco_type ORDER BY loco_type_id"))
        for row in res.mappings():
            print(dict(row))
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
