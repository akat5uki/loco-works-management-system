import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath("/home/ansira-u/Documents/Development/loco-works-management-system/backend"))

from app.features.locos.models import Loco
from app.features.locos.router import LocoRead

async def main():
    db_url = "postgresql+asyncpg://locouser:locopass@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(Loco).limit(5))
        locos = result.scalars().all()
        for loco in locos:
            print("ORM object:")
            print(f"  loco_number: {loco.loco_number} (type: {type(loco.loco_number)})")
            print(f"  stage: {loco.stage}")
            print(f"  despatched: {loco.despatched}")
            
            # Try validating
            loco_read = LocoRead.model_validate(loco)
            print("Validated LocoRead model:")
            print(f"  model_dump(): {loco_read.model_dump()}")
            print(f"  model_dump_json(): {loco_read.model_dump_json()}")
            print("-" * 40)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
