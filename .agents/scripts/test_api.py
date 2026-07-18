import urllib.request
import urllib.parse
import json

def main():
    base_url = "http://localhost:8080/api/v1"
    
    # 1. Login
    login_url = f"{base_url}/auth/login"
    login_data = json.dumps({
        "ticket_number": 1001,
        "password": "abcd"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        login_url,
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            token_info = json.loads(res_body)
            print("Login success. Token info:", token_info)
            
            token = token_info["access_token"]
            
            # 2. Get locos
            locos_url = f"{base_url}/locos/"
            req_locos = urllib.request.Request(
                locos_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                method="GET"
            )
            
            with urllib.request.urlopen(req_locos) as response_locos:
                locos_body = response_locos.read().decode("utf-8")
                locos_list = json.loads(locos_body)
                print("Get locos status code:", response_locos.status)
                print("First 5 locos returned:")
                for item in locos_list[:5]:
                    print(item)
                    
    except urllib.error.HTTPError as e:
        print("HTTP Error occurred:", e.code, e.read().decode("utf-8"))
    except Exception as e:
        print("Error occurred:", e)

if __name__ == "__main__":
    main()
