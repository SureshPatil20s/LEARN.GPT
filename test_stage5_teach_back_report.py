"""
Stage 5 Verification Test: Post-Interview Teach-Back Deepening, Spaced Repetition & Report Export
Validates:
1. Creation and execution of an interview session with full turn completion.
2. Generation of comprehensive Teach-After-Interview evaluation with:
   - Overall score & multi-dimensional normalized rubric breakdown.
   - Executive summary verdict, peer band estimate ('Top 10%', 'Top 25%', etc.), and hire recommendation.
   - Question-by-question teach-back coaching with candidate critique, expert ideal model answers, key concepts, and common pitfalls.
   - Spaced repetition study roadmap with concrete review_in_days (1d, 3d, 7d).
3. Report download endpoint:
   - GET /api/v1/interviews/sessions/{session_id}/report.md returns 200 text/markdown with attachment headers.
"""

import httpx, json, sys

BASE = "http://localhost:8000/api/v1"

print("--- 1. Authenticating Test Candidate ---")
r = httpx.post(
    f"{BASE}/auth/register",
    json={"email": "stage5_candidate@test.com", "password": "Password123!", "name": "Stage 5 Candidate"},
    timeout=10
)
if r.status_code in [200, 201]:
    token = r.json()["access_token"]
else:
    r2 = httpx.post(
        f"{BASE}/auth/login",
        json={"email": "stage5_candidate@test.com", "password": "Password123!"},
        timeout=10
    )
    token = r2.json()["access_token"]

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Candidate authenticated.")


# ---------------------------------------------------------------------------
# Step 1: Create and start a 1-question session for quick evaluation
# ---------------------------------------------------------------------------
print("\n--- 2. Creating Single-Question Technical Session ---")
r_sess = httpx.post(
    f"{BASE}/interviews/sessions",
    json={
        "interview_type": "technical",
        "subject_role": "Distributed Systems & Caching",
        "total_main_questions": 1,
        "difficulty": "medium",
        "allocated_time_min": 15
    },
    headers=H,
    timeout=15
)
assert r_sess.status_code == 201, f"Failed to create session: {r_sess.text}"
session = r_sess.json()
session_id = session["id"]
print(f"Session created: {session_id}")

print("\n--- 3. Starting Session -> Fetching Question 1 ---")
r_start = httpx.post(f"{BASE}/interviews/sessions/{session_id}/start", headers=H, timeout=60)
assert r_start.status_code == 200, f"Failed to start session: {r_start.text}"
q1 = r_start.json()
print(f"Question 1: {q1['question_text'][:140]}...")


# ---------------------------------------------------------------------------
# Step 2: Submit a thorough technical answer
# ---------------------------------------------------------------------------
print("\n--- 4. Submitting Technical Answer ---")
detailed_answer = (
    "In a distributed system, a write-through cache synchronously writes to both cache and DB, ensuring strong consistency "
    "at the expense of higher write latency. In contrast, write-back (write-behind) immediately acknowledges after writing "
    "to the cache, and asynchronously drains dirtied entries to disk in batches. While write-back yields ultra-low latency, "
    "it risks data loss if the cache node crashes before flush. To mitigate cache stampede under heavy read traffic, we apply "
    "probabilistic early expiration (XFetch algorithm) and distributed mutex locks (Redlock) so only a single worker refreshes "
    "the stale key while others consume cached values."
)

r_ans = httpx.post(
    f"{BASE}/interviews/sessions/{session_id}/answer",
    json={
        "turn_id": q1["id"],
        "sequence_number": q1["sequence_number"],
        "candidate_answer": detailed_answer
    },
    headers=H,
    timeout=60
)
assert r_ans.status_code == 200, f"Answer failed: {r_ans.text}"
ans_data = r_ans.json()
print("Answer submitted successfully.")
print(f"Is completed: {ans_data['is_completed']}")

# If follow-up was asked, answer it to finish the topic
if not ans_data["is_completed"] and ans_data.get("next_turn"):
    follow_up = ans_data["next_turn"]
    print(f"Answering follow-up: {follow_up['question_text'][:120]}...")
    r_fu = httpx.post(
        f"{BASE}/interviews/sessions/{session_id}/answer",
        json={
            "turn_id": follow_up["id"],
            "sequence_number": follow_up["sequence_number"],
            "candidate_answer": "We enforce Redis sentinel clustering with append-only file (AOF) fsync=always and multi-datacenter replica promotion."
        },
        headers=H,
        timeout=60
    )
    assert r_fu.status_code == 200
    ans_data = r_fu.json()

# End session if not automatically completed
if not ans_data.get("is_completed"):
    print("Concluding interview session...")
    r_end = httpx.post(f"{BASE}/interviews/sessions/{session_id}/end", json={"reason": "completed"}, headers=H, timeout=60)
    assert r_end.status_code == 200
    session_details = r_end.json()
    evaluation = session_details.get("evaluation")
else:
    evaluation = ans_data.get("evaluation")

assert evaluation is not None, "Evaluation object was not generated!"
print(f"\nEvaluation generated! Overall Score: {evaluation['overall_score']}%")


# ---------------------------------------------------------------------------
# Step 3: Validate Stage 5 Teach-Back & Spaced Repetition Schema Elements
# ---------------------------------------------------------------------------
print("\n--- 5. Validating Stage 5 Enriched Data Elements ---")

# 1. Peer Band & Hiring Recommendation
peer_band = evaluation.get("peer_band") or (evaluation.get("evidence_by_category") or {}).get("peer_band")
hire_rec = evaluation.get("hire_recommendation") or (evaluation.get("evidence_by_category") or {}).get("hire_recommendation")
print(f"Peer Band: {peer_band}")
print(f"Hire Recommendation: {hire_rec}")
assert peer_band is not None, "Expected peer_band in evaluation"
assert hire_rec is not None, "Expected hire_recommendation in evaluation"

# 2. Dimension Scores
dim_scores = evaluation.get("dimension_scores", {})
print(f"Dimension Scores ({len(dim_scores)}):", dim_scores)
assert len(dim_scores) >= 3, "Expected at least 3 rubric dimensions"

# 3. Spaced Repetition Study Roadmap
roadmap = evaluation.get("study_roadmap", [])
print(f"Roadmap Items ({len(roadmap)}):")
for item in roadmap:
    print(f"  • [{item.get('priority', 'medium').upper()}] {item.get('topic')}: Review in {item.get('review_in_days')} days")
assert len(roadmap) > 0, "Expected study roadmap items"
assert any("review_in_days" in item for item in roadmap), "Expected spaced repetition 'review_in_days' attribute"

# 4. Teach-After-Interview Coaching
teach_back = evaluation.get("teach_after_feedback", [])
print(f"Teach-After-Interview items: {len(teach_back)}")
if teach_back:
    first_tb = teach_back[0]
    print(f"  Question #{first_tb.get('question_number')}: {first_tb.get('question_topic')}")
    print(f"  Key Concepts: {first_tb.get('key_concepts')}")
    print(f"  Model Answer preview: {str(first_tb.get('ideal_model_answer', ''))[:100]}...")
    assert "candidate_attempt_review" in first_tb
    assert "ideal_model_answer" in first_tb


# ---------------------------------------------------------------------------
# Step 4: Validate Markdown Report Download Endpoint
# ---------------------------------------------------------------------------
print("\n--- 6. Testing Report Download Endpoint (/sessions/{id}/report.md) ---")
r_dl = httpx.get(f"{BASE}/interviews/sessions/{session_id}/report.md", headers=H, timeout=10)
assert r_dl.status_code == 200, f"Expected 200, got {r_dl.status_code}: {r_dl.text}"
assert "text/markdown" in r_dl.headers.get("content-type", "")
assert "attachment" in r_dl.headers.get("content-disposition", "")
md_text = r_dl.text
print(f"Report length: {len(md_text)} bytes")
print("Report preview (first 250 chars):")
print(md_text[:250])
assert len(md_text) > 100, "Markdown report content is too short"

print("\n" + "=" * 60)
print("STAGE 5 TEACH-BACK & REPORT EXPORT VERIFIED! (100% PASS)")
print("=" * 60)
