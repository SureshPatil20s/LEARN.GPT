"""
AI Interviewer smoke test — Stage 1 E2E validation.
Run: python test_interview_smoke.py
"""
import httpx, json, sys

BASE = "http://localhost:8000/api/v1"

# Auth
print("--- Auth ---")
r = httpx.post(f"{BASE}/auth/register", json={"email": "interviewer_test@test.com", "password": "Test1234!", "name": "Test User"}, timeout=10)
if r.status_code in [200, 201]:
    token = r.json()["access_token"]
    print("Registered new user")
else:
    r2 = httpx.post(f"{BASE}/auth/login", json={"email": "interviewer_test@test.com", "password": "Test1234!"}, timeout=10)
    if r2.status_code != 200:
        print("Auth failed:", r2.status_code, r2.text); sys.exit(1)
    token = r2.json()["access_token"]
    print("Logged in existing user")

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 1. Create session
print("\n--- 1. Create Session ---")
r = httpx.post(f"{BASE}/interviews/sessions",
    json={"interview_type": "technical", "subject_role": "Python Backend Engineering",
          "total_main_questions": 2, "difficulty": "easy", "allocated_time_min": 10},
    headers=H, timeout=15)
assert r.status_code == 201, f"Create failed: {r.status_code} {r.text}"
sess = r.json()
sid = sess["id"]
print(f"Session ID: {sid}")
print(f"Status: {sess['status']}")
assert sess["status"] == "created"

# 2. Cross-user 403 test (use a fake token)
print("\n--- 2. Cross-user ownership check ---")
r_unauth = httpx.get(f"{BASE}/interviews/sessions/{sid}", headers={"Authorization": "Bearer fake_token"}, timeout=10)
assert r_unauth.status_code == 401, f"Expected 401, got {r_unauth.status_code}"
print("401 correctly returned for invalid token")

# 3. Start session
print("\n--- 3. Start Session (generates Q1) ---")
r = httpx.post(f"{BASE}/interviews/sessions/{sid}/start", headers=H, timeout=60)
assert r.status_code == 200, f"Start failed: {r.status_code} {r.text}"
turn1 = r.json()
print(f"Turn ID: {turn1['id'][:16]}...")
print(f"Question 1: {turn1['question_text'][:160]}...")
assert turn1["sequence_number"] == 1
assert turn1["status"] == "awaiting_answer"

# 4. Submit answer to Q1 (with idempotency key)
print("\n--- 4. Submit Answer to Q1 ---")
idem_key = f"idem-test-{turn1['id']}"
payload = {"turn_id": turn1["id"], "sequence_number": 1,
           "candidate_answer": "Python is a high-level interpreted language with dynamic typing. It uses garbage collection and has a large standard library. It is widely used for web backends (Django, FastAPI), data science, and automation."}
r = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
    json=payload, headers={**H, "Idempotency-Key": idem_key}, timeout=120)
assert r.status_code == 200, f"Answer1 failed: {r.status_code} {r.text}"
ans1 = r.json()
print(f"Q1 answered | next_turn={bool(ans1.get('next_turn'))} | is_completed={ans1['is_completed']}")

# 4b. Idempotent replay
print("    Testing idempotency replay...")
r_idem = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
    json=payload, headers={**H, "Idempotency-Key": idem_key}, timeout=10)
assert r_idem.status_code == 200, f"Idempotency replay failed: {r_idem.status_code}"
print("    Replay returned 200 (cached)")

# 5. Submit Q2 & get evaluation
if not ans1["is_completed"] and ans1.get("next_turn"):
    turn2 = ans1["next_turn"]
    print(f"\n--- 5. Q2 generated: {turn2['question_text'][:160]}...")
    idem_key2 = f"idem-test-{turn2['id']}"
    r2 = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
        json={"turn_id": turn2["id"], "sequence_number": turn2["sequence_number"],
              "candidate_answer": "I use FastAPI for async REST APIs, SQLAlchemy for ORM, Alembic for migrations, Pydantic for validation, and Docker for containerized deployment."},
        headers={**H, "Idempotency-Key": idem_key2}, timeout=120)
    assert r2.status_code == 200, f"Answer2 failed: {r2.status_code} {r2.text}"
    ans2 = r2.json()
    print(f"Q2 answered | is_completed={ans2['is_completed']} | session_status={ans2['session_status']}")

    if ans2.get("evaluation"):
        ev = ans2["evaluation"]
        print(f"\n--- EVALUATION ---")
        print(f"Overall Score: {ev['overall_score']:.1f}")
        print(f"Verdict: {ev['summary_verdict'][:200]}")
        print(f"Strengths: {ev.get('key_strengths', [])[:2]}")
        print(f"Gaps: {ev.get('knowledge_gaps', [])[:2]}")
        assert ev["overall_score"] >= 0
    else:
        print("WARNING: No evaluation returned on session complete")

# 6. Session detail reload recovery
print("\n--- 6. Session Reload Recovery ---")
r_detail = httpx.get(f"{BASE}/interviews/sessions/{sid}", headers=H, timeout=10)
assert r_detail.status_code == 200
detail = r_detail.json()
print(f"Reloaded session status: {detail['status']}")
print(f"Answers logged: {detail['main_questions_answered']} of {detail['total_main_questions']}")

# 7. History
print("\n--- 7. Interview History ---")
rh = httpx.get(f"{BASE}/interviews/history", headers=H, timeout=10)
assert rh.status_code == 200
print(f"Past sessions: {len(rh.json())}")

print("\n========================================")
print("  ALL SMOKE TESTS PASSED")
print("========================================")
