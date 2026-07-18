import asyncio
import os
import sys

# Add backend directory to sys.path
backend_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend"
sys.path.append(backend_path)

from sqlalchemy import text
from app.core.database import primary_engine

async def main():
    print("=== Testing Audit Logging, Triggers & Auto-Partitioning ===")
    async with primary_engine.connect() as conn:
        # 1. Check partitioned master table audit_logs
        result = await conn.execute(text("SELECT relname FROM pg_class WHERE relname = 'audit_logs';"))
        row = result.fetchone()
        print(f"Master Table 'audit_logs': {'EXISTS' if row else 'MISSING'}")

        # 2. Check existing partitions
        result = await conn.execute(text("""
            SELECT c.relname 
            FROM pg_inherits i
            JOIN pg_class c ON c.oid = i.inhrelid
            JOIN pg_class p ON p.oid = i.inhparent
            WHERE p.relname = 'audit_logs';
        """))
        partitions = [r[0] for r in result.fetchall()]
        print(f"Existing partitions: {partitions}")

        # 3. Check attached triggers across operational tables
        result = await conn.execute(text("""
            SELECT event_object_table, trigger_name 
            FROM information_schema.triggers 
            WHERE trigger_name LIKE 'trg_audit_%'
            ORDER BY event_object_table;
        """))
        triggers = result.fetchall()
        print("\nAttached Triggers:")
        for t in triggers:
            print(f"  - Table: {t[0]:<25} Trigger: {t[1]}")

        # 4. Perform an operational test (Insert & Delete a temporary dummy job or rating)
        print("\nTesting live audit log insertion...")
        # Check current count in audit_logs
        res_before = await conn.execute(text("SELECT COUNT(*) FROM public.audit_logs;"))
        count_before = res_before.scalar()

        # Insert a dummy record into jobs (e.g. job_id 99999)
        await conn.execute(text("INSERT INTO public.jobs (job_id, job_description, stage) VALUES (99999, 'Audit Test Job', 1) ON CONFLICT (job_id) DO NOTHING;"))
        await conn.execute(text("DELETE FROM public.jobs WHERE job_id = 99999;"))
        await conn.commit()

        res_after = await conn.execute(text("SELECT COUNT(*) FROM public.audit_logs;"))
        count_after = res_after.scalar()
        print(f"Audit log entries count: Before = {count_before}, After = {count_after}")

        if count_after > count_before:
            # Query recent audit log entry
            res_recent = await conn.execute(text("SELECT id, table_name, operation, record_pk, changed_at FROM public.audit_logs ORDER BY changed_at DESC, id DESC LIMIT 2;"))
            print("\nRecent Audit Log entries:")
            for r in res_recent.fetchall():
                print(f"  ID: {r[0]}, Table: {r[1]}, Op: {r[2]}, PK: {r[3]}, Time: {r[4]}")
            print("\nSUCCESS: Audit logging and triggers are active and functional!")
        else:
            print("\nWARNING: No new audit log entries detected!")

if __name__ == "__main__":
    asyncio.run(main())
