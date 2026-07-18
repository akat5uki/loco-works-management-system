import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = "postgresql+asyncpg://locouser:locopass@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            tables = [row[0] for row in res]
            print("Successfully connected! Tables in public schema:", tables)
    except Exception as e:
        print("Failed to connect:", e)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
