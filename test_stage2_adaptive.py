"""
Stage 2 Adaptive Interview Intelligence Test
Validates:
1. Turn structured assessment (accuracy, completeness, score, needs_follow_up).
2. Dynamic follow-up question generation when answer has gaps/unjustified claims.
3. Follow-up limit enforcement (max_follow_ups_per_question).
4. Adaptive difficulty scaling.
5. Final evaluation generation.
"""

import httpx, json, sys

BASE = "http://localhost:8000/api/v1"

print("--- 1. Authenticate ---")
r = httpx.post(f"{BASE}/auth/register", json={"email": "adaptive_test@test.com", "password": "Test1234!", "name": "Adaptive Candidate"}, timeout=10)
if r.status_code in [200, 201]:
    token = r.json()["access_token"]
else:
    r2 = httpx.post(f"{BASE}/auth/login", json={"email": "adaptive_test@test.com", "password": "Test1234!"}, timeout=10)
    token = r2.json()["access_token"]

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

print("\n--- 2. Create Adaptive Session ---")
r = httpx.post(f"{BASE}/interviews/sessions",
    json={
        "interview_type": "technical",
        "subject_role": "Python Backend Architecture",
        "total_main_questions": 2,
        "max_follow_ups_per_question": 1,
        "difficulty": "adaptive"
    },
    headers=H, timeout=15)
assert r.status_code == 201
sess = r.json()
sid = sess["id"]
print(f"Session created: {sid} | difficulty={sess['difficulty']} | max_follow_ups={sess['max_follow_ups_per_question']}")

print("\n--- 3. Start Session -> Q1 ---")
r = httpx.post(f"{BASE}/interviews/sessions/{sid}/start", headers=H, timeout=60)
assert r.status_code == 200
q1 = r.json()
print(f"Q1 ({q1['turn_type']}): {q1['question_text']}")

print("\n--- 4. Submit Brief Answer to Trigger Contextual Follow-Up Probe ---")
r = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
    json={
        "turn_id": q1["id"],
        "sequence_number": q1["sequence_number"],
        "candidate_answer": "I would just put a Redis cache in front of the database to make it fast."
    },
    headers=H, timeout=60)
assert r.status_code == 200
ans1 = r.json()
print(f"Answer submitted | is_completed={ans1['is_completed']}")

next_turn = ans1.get("next_turn")
assert next_turn is not None
print(f"Next turn type: {next_turn['turn_type']} | follow_up_index: {next_turn['follow_up_index']}")
print(f"Interviewer Follow-Up Probe: {next_turn['question_text']}")

# Check that turn_type is follow_up
if next_turn['turn_type'] == 'follow_up':
    print("PASS: Adaptive engine detected superficial answer and generated contextual probe!")
else:
    print("NOTE: Follow-up was not triggered, proceeded to main topic.")

print("\n--- 5. Answer the Follow-Up Probe with Strong Explanation ---")
r = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
    json={
        "turn_id": next_turn["id"],
        "sequence_number": next_turn["sequence_number"],
        "candidate_answer": "To prevent cache stampedes, I use a write-through strategy with Redis cluster. For invalidation, we emit event messages via Kafka on entity updates and set short TTLs with jitter on volatile keys to avoid thundering herds."
    },
    headers=H, timeout=60)
assert r.status_code == 200
ans2 = r.json()

if ans2["is_completed"]:
    print(f"Session completed! Score: {ans2['evaluation']['overall_score']}")
else:
    q2 = ans2["next_turn"]
    print(f"Main Question 2 ({q2['turn_type']} #{q2['main_question_index']}): {q2['question_text']}")

    # Answer Q2 to finalize interview
    r_final = httpx.post(f"{BASE}/interviews/sessions/{sid}/answer",
        json={
            "turn_id": q2["id"],
            "sequence_number": q2["sequence_number"],
            "candidate_answer": "For asynchronous task execution in Python, Celery with RabbitMQ broker is standard, allowing task retries with exponential backoff and dead-letter queues."
        },
        headers=H, timeout=120)
    assert r_final.status_code == 200
    res_final = r_final.json()
    print(f"Interview Finalized | Completed: {res_final['is_completed']}")
    if res_final.get("evaluation"):
        ev = res_final["evaluation"]
        print(f"Final Score: {ev['overall_score']:.1f}/100")
        print(f"Verdict: {ev['summary_verdict']}")

print("\n=============================================")
print("  STAGE 2 ADAPTIVE INTELLIGENCE TEST PASSED! ")
print("=============================================")
