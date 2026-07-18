import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import app.main
from app.features.employee_bookings.router import get_booking_views
from app.features.employees.models import Employee

# We need a dummy CurrentUser object
class DummyCurrentUser:
    ticket_number = 1001
    name = "SSE Rahul"
    designation_id = 1
    is_supervisor = True

async def main():
    db_url = "postgresql+asyncpg://locouser:55vAdT43Cf297mwZruZbfg@localhost:5432/locodb"
    engine = create_async_engine(db_url)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        print("--- Testing get_booking_views for 2026-06-26 shift 1 ---")
        res = await get_booking_views(
            date_str="2026-06-26",
            shift=1,
            current_user=DummyCurrentUser(),
            db=session
        )
        
        print("\nby_loco view results:")
        by_loco = res.get("by_loco", [])
        found_4707 = False
        for l in by_loco:
            print(l)
            if l["loco_number"] == "4707":
                found_4707 = True
                
        if found_4707:
            print("\nSUCCESS: Locomotive 4707 is included in the by_loco list!")
        else:
            print("\nFAILURE: Locomotive 4707 is NOT included in the by_loco list.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
