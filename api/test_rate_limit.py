import requests
import time
import sys

# URL of your API
BASE_URL = "http://127.0.0.1:5000"
ENDPOINT = "/api/players"

def test_rate_limit():
    print(f"Testing rate limit on {BASE_URL}{ENDPOINT}")
    print("Sending 60 requests quickly...")
    
    success_count = 0
    blocked_count = 0
    
    for i in range(1, 61):
        try:
            start = time.time()
            response = requests.get(f"{BASE_URL}{ENDPOINT}")
            elapsed = time.time() - start
            
            if response.status_code == 200:
                print(f"Request {i}: 200 OK ({elapsed:.3f}s)")
                success_count += 1
            elif response.status_code == 429:
                print(f"Request {i}: 429 Too Many Requests ({elapsed:.3f}s)")
                blocked_count += 1
            else:
                print(f"Request {i}: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"Request {i}: Error - {e}")

    print("\n--- Summary ---")
    print(f"Successful requests: {success_count}")
    print(f"Blocked requests: {blocked_count}")
    
    if blocked_count > 0:
        print("\n✅ Verification Successful: Rate limit triggered!")
        return True
    else:
        print("\n❌ Verification Failed: Rate limit NOT triggered.")
        return False

if __name__ == "__main__":
    try:
        if test_rate_limit():
            sys.exit(0)
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\nTest interrupted.")
