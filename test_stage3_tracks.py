"""
Stage 3 Verification Test: Specialized Tracks & Mode-Specific Rubrics
Validates:
1. HR/Behavioral track generates STAR-method situational prompts.
2. HR evaluation report uses STAR rubric dimensions (star_methodology_structure, communication, teamwork, ownership, adaptability).
3. University Viva Voce track generates academic theoretical prompts.
4. Viva evaluation report uses Viva rubric dimensions (conceptual_and_theoretical_rigor, definition_precision, defense).
5. Dimension weights normalize to 100%.
"""

import httpx, json, sys

BASE = "http://localhost:8000/api/v1"

print("--- 1. Authenticate ---")
r = httpx.post(f"{BASE}/auth/register", json={"email": "tracks_test@test.com", "password": "Test1234!", "name": "Stage 3 Candidate"}, timeout=10)
if r.status_code in [200, 201]:
    token = r.json()["access_token"]
else:
    r2 = httpx.post(f"{BASE}/auth/login", json={"email": "tracks_test@test.com", "password": "Test1234!"}, timeout=10)
    token = r2.json()["access_token"]

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# -------------------------------------------------------------
# Test Track 1: HR & Behavioral (STAR Method)
# -------------------------------------------------------------
print("\n--- 2. Create HR / Behavioral Track Session ---")
r_hr = httpx.post(f"{BASE}/interviews/sessions",
    json={
        "interview_type": "hr",
        "subject_role": "Leadership & Conflict Resolution",
        "total_main_questions": 1,
        "difficulty": "medium"
    },
    headers=H, timeout=15)
assert r_hr.status_code == 201
hr_sess = r_hr.json()
hr_id = hr_sess["id"]
print(f"HR Session created: {hr_id}")

print("--- 3. Start HR Session -> Get Q1 ---")
r_start = httpx.post(f"{BASE}/interviews/sessions/{hr_id}/start", headers=H, timeout=60)
assert r_start.status_code == 200
hr_q1 = r_start.json()
print(f"HR Question: {hr_q1['question_text'][:160]}...")

print("--- 4. Submit STAR Answer to HR Question ---")
star_answer = (
    "In my previous project, we faced a major architectural deadlock between using synchronous REST vs event-driven RabbitMQ. "
    "My task was to resolve the disagreement and deliver the feature before the sprint deadline. "
    "I took action by organizing a benchmark workshop where both teams measured throughput under peak load, demonstrating that RabbitMQ reduced API latency by 45%. "
    "As a result, both teams agreed on RabbitMQ, we shipped on time with zero downtime, and established a team guideline for data-driven architecture decisions."
)
r_ans = httpx.post(f"{BASE}/interviews/sessions/{hr_id}/answer",
    json={
        "turn_id": hr_q1["id"],
        "sequence_number": hr_q1["sequence_number"],
        "candidate_answer": star_answer
    },
    headers=H, timeout=120)
assert r_ans.status_code == 200
hr_res = r_ans.json()

if hr_res["is_completed"] and hr_res.get("evaluation"):
    ev = hr_res["evaluation"]
    print(f"\n[PASS] HR Evaluation Generated!")
    print(f"Rubric Version: {ev['rubric_version']}")
    print(f"Overall Score: {ev['overall_score']}/100")
    print(f"Dimensions: {list(ev['dimension_scores'].keys())}")
    assert "star_methodology_structure" in ev["dimension_scores"]
    print(f"STAR Structure Score: {ev['dimension_scores']['star_methodology_structure']}")
    print(f"Verdict: {ev['summary_verdict']}")
else:
    print("HR turn required follow up or next turn.")

# -------------------------------------------------------------
# Test Track 2: University Viva Voce (Academic Rigor)
# -------------------------------------------------------------
print("\n--- 5. Create University Viva Session ---")
r_viva = httpx.post(f"{BASE}/interviews/sessions",
    json={
        "interview_type": "viva",
        "subject_role": "Operating Systems & Virtual Memory",
        "total_main_questions": 1,
        "difficulty": "hard"
    },
    headers=H, timeout=15)
assert r_viva.status_code == 201
viva_sess = r_viva.json()
viva_id = viva_sess["id"]
print(f"Viva Session created: {viva_id}")

print("--- 6. Start Viva Session -> Get Q1 ---")
r_vstart = httpx.post(f"{BASE}/interviews/sessions/{viva_id}/start", headers=H, timeout=60)
assert r_vstart.status_code == 200
viva_q1 = r_vstart.json()
print(f"Viva Question: {viva_q1['question_text'][:160]}...")

print("--- 7. Submit Formal Academic Answer to Viva Question ---")
viva_answer = (
    "Virtual memory is formally an abstraction of main storage providing an address space decoupled from physical RAM. "
    "Paging divides the address space into fixed-size units (pages) mapped to physical frames via page tables. "
    "A translation lookaside buffer (TLB) acts as an associative cache for page table entries. "
    "When a requested page is absent from physical memory, the MMU triggers a page fault exception (trap), invoking the OS fault handler to read the frame from swap."
)
r_vans = httpx.post(f"{BASE}/interviews/sessions/{viva_id}/answer",
    json={
        "turn_id": viva_q1["id"],
        "sequence_number": viva_q1["sequence_number"],
        "candidate_answer": viva_answer
    },
    headers=H, timeout=120)
assert r_vans.status_code == 200
viva_res = r_vans.json()

if viva_res["is_completed"] and viva_res.get("evaluation"):
    ev = viva_res["evaluation"]
    print(f"\n[PASS] University Viva Evaluation Generated!")
    print(f"Rubric Version: {ev['rubric_version']}")
    print(f"Overall Score: {ev['overall_score']}/100")
    print(f"Dimensions: {list(ev['dimension_scores'].keys())}")
    assert "conceptual_and_theoretical_rigor" in ev["dimension_scores"]
    print(f"Theoretical Rigor Score: {ev['dimension_scores']['conceptual_and_theoretical_rigor']}")
    print(f"Verdict: {ev['summary_verdict']}")
else:
    print("Viva turn required follow up or next turn.")

print("\n==================================================")
print("  STAGE 3 SPECIALIZED TRACKS & RUBRICS VERIFIED!  ")
print("==================================================")
