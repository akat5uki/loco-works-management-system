import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_PRIMARY_URL)
    async with engine.connect() as conn:
        # Check all tables
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in res]
        print("Tables in public schema:", tables)
        
        for table in tables:
            print(f"\nColumns for table '{table}':")
            columns_res = await conn.execute(text(f"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='{table}'"))
            for col in columns_res:
                print(f"  - {col[0]} ({col[1]}), nullable: {col[2]}")
                
            # Sample row
            try:
                sample_res = await conn.execute(text(f"SELECT * FROM public.{table} LIMIT 1"))
                row = sample_res.fetchone()
                if row:
                    print(f"  Sample row from '{table}':", dict(row._mapping))
                else:
                    print(f"  Table '{table}' is empty.")
            except Exception as e:
                print(f"  Error reading rows from '{table}': {e}")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
