import urllib.request
import urllib.parse
import json

def make_request(url, method="GET", token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
        except:
            err_json = err_body
        return e.code, err_json
    except Exception as e:
        return 999, str(e)

def login(ticket_number):
    url = "http://localhost:8080/api/v1/auth/login"
    payload = {
        "ticket_number": str(ticket_number),
        "password": "abcd"
    }
    status, res = make_request(url, "POST", body=payload)
    if status == 200:
        return res["access_token"]
    else:
        raise Exception(f"Login failed for {ticket_number}: {res}")

def main():
    print("Logging in users...")
    sup_token = login(1001) # Supervisor
    staff_token = login(1003) # Staff
    
    base_url = "http://localhost:8080/api/v1"
    
    print("\n--- 1. Testing GET /chat/history/all ---")
    st, res = make_request(f"{base_url}/chat/history/all", token=sup_token)
    print(f"Supervisor: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/chat/history/all", token=staff_token)
    print(f"Staff: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/chat/history/all")
    print(f"Unauthenticated: {st} (Expected: 401)")
    
    print("\n--- 2. Testing GET /chat/history/supervisor ---")
    st, res = make_request(f"{base_url}/chat/history/supervisor", token=sup_token)
    print(f"Supervisor: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/chat/history/supervisor", token=staff_token)
    print(f"Staff: {st} (Expected: 403, got: {res})")
    
    print("\n--- 3. Testing POST /jobs/ (Create Job) ---")
    job_payload = {
        "job_id": "9999",
        "job_description": "RBAC Test Job",
        "stage": 1
    }
    # Clean up first in case it exists (requires supervisor)
    make_request(f"{base_url}/jobs/9999", "DELETE", token=sup_token)
    
    # Try creating as staff
    st, res = make_request(f"{base_url}/jobs/", "POST", token=staff_token, body=job_payload)
    print(f"Staff: {st} (Expected: 403, got: {res})")
    
    # Try creating as supervisor
    st, res = make_request(f"{base_url}/jobs/", "POST", token=sup_token, body=job_payload)
    print(f"Supervisor: {st} (Expected: 201, got: {st})")
    
    print("\n--- 4. Testing POST /locos/types (Create Loco Type) ---")
    type_payload = {
        "loco_type_id": "8888",
        "loco_type_name": "RBAC Type"
    }
    # Clean up first (requires supervisor)
    make_request(f"{base_url}/locos/types/8888", "DELETE", token=sup_token)
    
    # Try creating as staff
    st, res = make_request(f"{base_url}/locos/types", "POST", token=staff_token, body=type_payload)
    print(f"Staff: {st} (Expected: 403, got: {res})")
    
    # Try creating as supervisor
    st, res = make_request(f"{base_url}/locos/types", "POST", token=sup_token, body=type_payload)
    print(f"Supervisor: {st} (Expected: 201, got: {st})")
    
    print("\n--- 5. Testing GET /locos/types ---")
    st, res = make_request(f"{base_url}/locos/types", token=staff_token)
    print(f"Staff: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/locos/types")
    print(f"Unauthenticated: {st} (Expected: 401)")
    
    print("\n--- 6. Testing GET /bookings/employees/availabilities ---")
    st, res = make_request(f"{base_url}/bookings/employees/availabilities?date_str=2026-06-23&shift=1", token=staff_token)
    print(f"Staff: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/bookings/employees/availabilities?date_str=2026-06-23&shift=1")
    print(f"Unauthenticated: {st} (Expected: 401)")
    
    print("\n--- 7. Testing GET /employees/ ---")
    st, res = make_request(f"{base_url}/employees/", token=staff_token)
    print(f"Staff: {st} (Expected: 200)")
    st, res = make_request(f"{base_url}/employees/")
    print(f"Unauthenticated: {st} (Expected: 401)")

if __name__ == "__main__":
    main()
