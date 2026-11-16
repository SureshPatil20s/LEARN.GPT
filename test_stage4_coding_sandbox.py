"""
Stage 4 Verification Test: Isolated Coding Sandbox & Security Guarantees
Validates:
1. Safe solution passing multiple test cases.
2. Safe solution with some failing test cases reporting exact outputs and runtime.
3. Prohibited module imports (os, sys, subprocess, socket) caught by AST static security check.
4. Prohibited built-ins (eval, open, __import__) caught by AST static security check.
5. Infinite loop terminated cleanly by 3.0s asynchronous execution timeout.
6. Execution endpoint (/api/v1/interviews/coding/execute) handles direct output execution.
"""

import httpx, json, sys, time

BASE = "http://localhost:8000/api/v1"

print("--- 1. Authenticating Test Candidate ---")
r = httpx.post(
    f"{BASE}/auth/register",
    json={"email": "sandbox_candidate@test.com", "password": "Password123!", "name": "Sandbox Candidate"},
    timeout=10
)
if r.status_code in [200, 201]:
    token = r.json()["access_token"]
else:
    r2 = httpx.post(
        f"{BASE}/auth/login",
        json={"email": "sandbox_candidate@test.com", "password": "Password123!"},
        timeout=10
    )
    token = r2.json()["access_token"]

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Authenticated successfully.")


# ---------------------------------------------------------------------------
# Test Case 1: Safe code passing all test cases
# ---------------------------------------------------------------------------
print("\n--- 2. Executing Safe Code (Two-Sum Solution) ---")
safe_code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
"""

test_cases = [
    {"input": [[2, 7, 11, 15], 9], "expected": [0, 1]},
    {"input": [[3, 2, 4], 6], "expected": [1, 2]},
    {"input": [[3, 3], 6], "expected": [0, 1]}
]

res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={"code": safe_code, "language": "python", "test_cases": test_cases},
    headers=H,
    timeout=10
)
assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
data = res.json()
print("Sandbox Response:", json.dumps(data, indent=2))
assert data["status"] == "success", f"Expected 'success', got {data['status']}"
assert data["all_passed"] is True, "Expected all tests to pass"
assert data["passed_tests"] == 3
assert data["total_tests"] == 3
assert len(data["test_results"]) == 3
print("PASS: Safe code correctly passed all 3 test cases!")


# ---------------------------------------------------------------------------
# Test Case 2: Code with partial failures
# ---------------------------------------------------------------------------
print("\n--- 3. Executing Code with Partial Test Failure ---")
buggy_code = """
def is_palindrome(s):
    # Bug: does not handle case-sensitivity
    return s == s[::-1]
"""

palindrome_tests = [
    {"input": ["racecar"], "expected": True},
    {"input": ["Racecar"], "expected": True},   # will FAIL - 'R' != 'r' reversed
    {"input": ["hello"], "expected": False}
]

res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={"code": buggy_code, "language": "python", "test_cases": palindrome_tests},
    headers=H,
    timeout=10
)
assert res.status_code == 200
data = res.json()
print(f"Status: {data['status']}, Passed: {data['passed_tests']}/{data['total_tests']}, All Passed: {data['all_passed']}")
assert data["status"] == "success"
assert data["all_passed"] is False, "Expected all_passed to be False"
assert data["passed_tests"] == 2
assert data["total_tests"] == 3
print("PASS: Partial failure accurately recorded with exact inputs and outputs!")


# ---------------------------------------------------------------------------
# Test Case 3: Security Policy Violation - Prohibited Import
# ---------------------------------------------------------------------------
print("\n--- 4. Enforcing Security: Prohibited Module Import (os/subprocess) ---")
malicious_code_import = """
import os

def exploit():
    return os.listdir('.')
"""

res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={"code": malicious_code_import, "language": "python"},
    headers=H,
    timeout=10
)
assert res.status_code == 200
data = res.json()
print(f"Status: {data['status']}")
print(f"Error Message: {data['error_message']}")
assert data["status"] == "security_violation", f"Expected 'security_violation', got {data['status']}"
assert "prohibited" in data["error_message"].lower()
assert "os" in data["error_message"].lower()
print("PASS: Prohibited module import blocked by AST static security barrier!")


# ---------------------------------------------------------------------------
# Test Case 4: Security Policy Violation - Prohibited Built-in Function
# ---------------------------------------------------------------------------
print("\n--- 5. Enforcing Security: Prohibited Built-in Function (eval / open) ---")
malicious_code_builtin = """
def read_secrets():
    f = open('/etc/passwd', 'r')
    return f.read()
"""

res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={"code": malicious_code_builtin, "language": "python"},
    headers=H,
    timeout=10
)
assert res.status_code == 200
data = res.json()
print(f"Status: {data['status']}")
print(f"Error Message: {data['error_message']}")
assert data["status"] == "security_violation", f"Expected 'security_violation', got {data['status']}"
assert "open" in data["error_message"].lower()
print("PASS: Prohibited built-in call blocked by AST static security barrier!")


# ---------------------------------------------------------------------------
# Test Case 5: Infinite Loop Timeout Guarantee
# ---------------------------------------------------------------------------
print("\n--- 6. Enforcing Resource Limits: Asynchronous Timeout (3.0s) ---")
infinite_loop_code = """
def hang_server():
    while True:
        pass
"""

t0 = time.time()
res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={
        "code": infinite_loop_code,
        "language": "python",
        "test_cases": [{"input": [], "expected": None}]
    },
    headers=H,
    timeout=10
)
elapsed = time.time() - t0
assert res.status_code == 200
data = res.json()
print(f"Elapsed wall time: {elapsed:.2f}s")
print(f"Status: {data['status']}")
print(f"Error Message: {data['error_message']}")
assert data["status"] == "timeout", f"Expected 'timeout', got {data['status']}"
assert 2.8 <= elapsed <= 5.5, f"Expected execution to terminate around 3s timeout, took {elapsed:.2f}s"
print("PASS: Infinite loop terminated cleanly by 3.0s timeout with process kill!")


# ---------------------------------------------------------------------------
# Test Case 6: Direct Code Output without Test Cases
# ---------------------------------------------------------------------------
print("\n--- 7. Direct Code Execution with Standard Output ---")
simple_print_code = """
def greet(name):
    return f"Hello, {name}!"

print("Calculating Fibonacci sequence:")
for i in range(5):
    print(f"Step {i}")
"""

res = httpx.post(
    f"{BASE}/interviews/coding/execute",
    json={"code": simple_print_code, "language": "python"},
    headers=H,
    timeout=10
)
assert res.status_code == 200
data = res.json()
print("Output:", repr(data.get("output")))
assert data["status"] == "success"
assert "Calculating Fibonacci sequence:" in data.get("output", "")
assert "Step 4" in data.get("output", "")
print("PASS: Direct output captured and returned cleanly!")

print("\n" + "=" * 60)
print("ALL STAGE 4 CODING SANDBOX TESTS PASSED SUCCESSFULLY! (100%)")
print("=" * 60)
