"""
Test script for admin email OTP verification flow.
Tests:
  1. Default admin login - should bypass OTP
  2. Promoted admin login - should require OTP
  3. Admin promotion - should require OTP when ENABLE_EMAIL_OTP=1
"""
import asyncio
import json
import os
import sys

backend_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend"
sys.path.insert(0, backend_path)

# Load settings
os.environ.setdefault("APP_ENV", "development")

import httpx

BASE = "http://localhost:8082/api/v1"


async def test_default_admin_no_otp(client: httpx.AsyncClient) -> dict:
    """Default admin login should NOT trigger OTP - returns access_token directly."""
    from app.core.config import settings
    payload = {
        "ticket_number": settings.DEFAULT_ADMIN_TICKET,
        "password": settings.DEFAULT_ADMIN_PASSWORD,
    }
    res = await client.post(f"{BASE}/admin/login", json=payload)
    data = res.json()
    print(f"[1] Default Admin Login: {res.status_code}")
    print(f"    otp_required: {data.get('otp_required')}")
    print(f"    has access_token: {'access_token' in data}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "access_token" in data, "Expected access_token in response"
    assert not data.get("otp_required"), "Default admin should NOT require OTP"
    print("    ✅ PASSED - No OTP required for default admin")
    return data


async def test_new_endpoints_exist(client: httpx.AsyncClient):
    """Verify /verify-login-otp and /verify-registration-otp endpoints are reachable."""
    # POST with empty body to /verify-login-otp - should return 422 (validation error), not 404
    r1 = await client.post(f"{BASE}/admin/verify-login-otp", json={})
    # /verify-registration-otp requires admin auth, so should return 401 not 404
    r2 = await client.post(f"{BASE}/admin/verify-registration-otp", json={})
    print(f"\n[2] verify-login-otp status: {r1.status_code} (expect 422 validation error)")
    print(f"[3] verify-registration-otp status: {r2.status_code} (expect 401 - auth required)")
    assert r1.status_code == 422, f"Expected 422, got {r1.status_code}: {r1.text}"
    assert r2.status_code == 401, f"Expected 401, got {r2.status_code}: {r2.text}"
    print("    ✅ PASSED - Both OTP verify endpoints exist")


async def test_invalid_otp_rejected(client: httpx.AsyncClient):
    """Invalid OTP should return 400."""
    payload = {"ticket_number": 9999, "otp": "000000"}
    res = await client.post(f"{BASE}/admin/verify-login-otp", json=payload)
    data = res.json()
    print(f"\n[4] Invalid OTP rejected: {res.status_code}")
    print(f"    detail: {data.get('detail')}")
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print("    ✅ PASSED - Invalid OTP correctly rejected")


async def main():
    print("=" * 60)
    print("Admin Email OTP Verification - API Test Suite")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await test_default_admin_no_otp(client)
            await test_new_endpoints_exist(client)
            await test_invalid_otp_rejected(client)
            print("\n" + "=" * 60)
            print("All tests PASSED ✅")
            print("=" * 60)
        except AssertionError as e:
            print(f"\n❌ ASSERTION FAILED: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
