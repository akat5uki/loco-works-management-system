import asyncio
import os
import sys

# Configure environment to use localhost for SMTP since we run this check from the host machine
os.environ["SMTP_HOST"] = "127.0.0.1"
os.environ["SMTP_PORT"] = "1025"

# Add backend directory to path
backend_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend"
sys.path.append(backend_path)

from app.core.email import send_otp_email

async def main():
    print("Testing SMTP email dispatch to local Mailpit container...")
    try:
        await send_otp_email("test-user@locoworks.com", "987654", "Unit Test Verification")
        print("SUCCESS: SMTP dispatch completed without errors.")
    except Exception as e:
        print(f"FAILED: Email dispatch failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
