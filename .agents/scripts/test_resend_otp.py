import asyncio
import os
import sys
import json

# Configure environment
os.environ["SMTP_HOST"] = "127.0.0.1"
os.environ["SMTP_PORT"] = "1025"

backend_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend"
sys.path.append(backend_path)

from app.core.redis import redis_client
from app.core.config import settings
import httpx

async def main():
    print(f"Current Config - OTP Expire: {settings.OTP_EXPIRE_SECONDS}s, Reg Expire: {settings.REGISTRATION_SESSION_EXPIRE_SECONDS}s")
    
    # We will test the API endpoints using httpx directly
    async with httpx.AsyncClient() as client:
        # 1. Clean up any existing temp registration for a test ticket number (e.g., 99999)
        test_ticket = "99999"
        await redis_client.delete(f"temp_reg:{test_ticket}")
        await redis_client.delete(f"otp:reg:{test_ticket}")
        
        # 2. Register
        reg_payload = {
            "ticket_number": test_ticket,
            "name": "OTP Test User",
            "designation_id": 7, # Helper
            "email": "otp-test@example.com",
            "password": "testpassword",
            "captcha": "ABCD" # Captcha validation bypassed/handled
        }
        
        print("Submitting registration...")
        # Since uvicorn runs on port 8082 through nginx
        url_reg = "http://localhost:8082/api/v1/auth/register"
        res_reg = await client.post(url_reg, json=reg_payload)
        print(f"Register status: {res_reg.status_code}, response: {res_reg.text}")
        
        if res_reg.status_code != 200:
            print("Register failed. Make sure user is not already registered or CAPTCHA is not blocking.")
            return

        # 3. Check Redis keys exist
        reg_ttl = await redis_client.ttl(f"temp_reg:{test_ticket}")
        otp_ttl = await redis_client.ttl(f"otp:reg:{test_ticket}")
        print(f"Redis TTLs - temp_reg: {reg_ttl}s, otp:reg: {otp_ttl}s")
        
        # 4. Trigger resend-otp
        resend_payload = {
            "ticket_number": test_ticket,
            "type": "registration"
        }
        print("Triggering resend OTP...")
        url_resend = "http://localhost:8082/api/v1/auth/resend-otp"
        res_resend = await client.post(url_resend, json=resend_payload)
        print(f"Resend status: {res_resend.status_code}, response: {res_resend.text}")
        
        # 5. Clean up
        await redis_client.delete(f"temp_reg:{test_ticket}")
        await redis_client.delete(f"otp:reg:{test_ticket}")

if __name__ == "__main__":
    # Load settings
    asyncio.run(main())
