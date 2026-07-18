import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = "postgresql+asyncpg://locouser:locopass@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    try:
        async with engine.connect() as conn:
            query = text("""
                SELECT column_name, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_name = 'loco_bookings'
                  AND column_name IN ('date_time', 'shift');
            """)
            res = await conn.execute(query)
            for r in res:
                print(f"Column: {r.column_name}, Nullable: {r.is_nullable}, Data Type: {r.data_type}")
    except Exception as e:
        print("Error checking database:", e)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
