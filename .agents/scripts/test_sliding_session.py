
import asyncio
from fastapi import FastAPI, Depends, Response, Request
from fastapi.testclient import TestClient
from jose import jwt

# Setup a mini FastAPI app to simulate the sliding session behavior
app = FastAPI()

SECRET_KEY = "testsecret"
ALGORITHM = "HS256"

# Mock Redis Client
class MockRedis:
    def __init__(self):
        self.store = {}
        self.expirations = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        if ex:
            self.expirations[key] = ex

    async def expire(self, key, seconds):
        if key in self.store:
            self.expirations[key] = seconds
            return True
        return False

mock_redis = MockRedis()

# Simulate the backend dependency logic
async def get_current_user_dependency(request: Request, response: Response):
    token = request.cookies.get("session_id_strict") or request.cookies.get("session_id_embed")
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        ticket_number = payload.get("sub")
        
        # Verify with Redis
        session_key = f"session:{ticket_number}"
        stored_token = await mock_redis.get(session_key)
        if not stored_token or stored_token != token:
            return None
        
        # Extend Redis session lifetime (Sliding Expiration)
        await mock_redis.expire(session_key, 1800)
        
        # Extend browser cookies (Sliding Expiration)
        response.set_cookie(
            key="session_id_strict",
            value=token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=1800,
        )
        response.set_cookie(
            key="session_id_embed",
            value=token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=1800,
        )
        
        # Add Partitioned attribute
        for i, (header_name, header_value) in enumerate(response.raw_headers):
            if header_name == b"set-cookie" and b"session_id_embed" in header_value:
                if b"Partitioned" not in header_value:
                    response.raw_headers[i] = (header_name, header_value + b"; Partitioned")
                    
        return ticket_number
    except Exception as e:
        print("Error in dependency:", e)
        return None

@app.get("/test-endpoint")
async def test_endpoint(user = Depends(get_current_user_dependency)):
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}

def run_tests():
    # 1. Generate a test token
    token = jwt.encode({"sub": "12345"}, SECRET_KEY, algorithm=ALGORITHM)
    
    # 2. Populate Mock Redis
    asyncio.run(mock_redis.set("session:12345", token, ex=1800))
    
    # 3. Request without cookies should fail authentication
    client = TestClient(app)
    resp = client.get("/test-endpoint")
    assert resp.json() == {"authenticated": False}
    print("Test 1 Passed: Request without cookies failed as expected.")
    
    # 4. Request with valid cookies
    client.cookies.set("session_id_strict", token)
    # Set expiration to a different value to verify sliding expiration updates it
    mock_redis.expirations["session:12345"] = 100
    
    resp = client.get("/test-endpoint")
    assert resp.json() == {"authenticated": True, "user": "12345"}
    print("Test 2 Passed: Request with valid session cookie authenticated successfully.")
    
    # Verify sliding expiration updated Redis
    assert mock_redis.expirations["session:12345"] == 1800
    print("Test 3 Passed: Redis session expiration successfully extended (sliding window).")
    
    # Verify browser response cookies are returned with correct max-age
    set_cookie_headers = resp.headers.get_list("set-cookie")
    print("Received Set-Cookie headers:", set_cookie_headers)
    
    strict_cookie = None
    embed_cookie = None
    for cookie in set_cookie_headers:
        if "session_id_strict" in cookie:
            strict_cookie = cookie
        elif "session_id_embed" in cookie:
            embed_cookie = cookie
            
    assert strict_cookie is not None
    assert "max-age=1800" in strict_cookie.lower()
    assert "samesite=strict" in strict_cookie.lower()
    
    assert embed_cookie is not None
    assert "max-age=1800" in embed_cookie.lower()
    assert "samesite=none" in embed_cookie.lower()
    # Check that Partitioned was successfully appended
    assert "partitioned" in embed_cookie.lower()
    
    print("Test 4 Passed: Response headers contain refreshed cookies with sliding lifetime and Partitioned attribute.")
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
