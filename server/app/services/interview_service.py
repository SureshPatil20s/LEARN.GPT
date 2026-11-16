"""
Interview Service — AI Interviewer Lifecycle, State Machine & Evaluation
LEARN.GPT Platform
"""

from __future__ import annotations

import json
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.app.models.entities import (
    InterviewSession,
    InterviewTurn,
    InterviewEvaluation,
    IdempotencyRecord,
    Document,
    DocumentChunk
)
from server.app.schemas.schemas import (
    InterviewSessionCreate,
    InterviewSessionResponse,
    InterviewTurnResponse,
    InterviewEvaluationResponse,
    AnswerSubmissionRequest,
    TurnAnswerResponse
)
from server.app.services.llm_service import hosted_llm

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: Call LLM with automatic Groq -> Gemini fallback
# ---------------------------------------------------------------------------

async def _call_llm(messages: List[Dict[str, Any]], temperature: float = 0.6, max_tokens: int = 1500) -> str:
    """Invokes LLM router with multi-model failover and returns complete response text."""
    chunks = []
    try:
        async for chunk in hosted_llm.stream_chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        ):
            chunks.append(chunk)
    except Exception as e:
        logger.error(f"Error in LLM invocation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Interview AI engine temporarily unavailable: {str(e)}"
        )
    return "".join(chunks).strip()


# ---------------------------------------------------------------------------
# Helper: Fetch Resume Text if provided
# ---------------------------------------------------------------------------

def _get_resume_context(db: Session, resume_document_id: Optional[str], user_id: str) -> str:
    if not resume_document_id:
        return ""
    doc = db.query(Document).filter(
        Document.id == resume_document_id,
        Document.user_id == user_id
    ).first()
    if not doc:
        return ""

    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == resume_document_id
    ).order_by(DocumentChunk.chunk_index).limit(10).all()

    if not chunks:
        return ""

    full_text = "\n".join(c.content for c in chunks if c.content)
    # Truncate to safe size (~4000 chars) for prompt context
    return full_text[:4000]


# ---------------------------------------------------------------------------
# Specialized Mode Rubrics (Stage 3)
# ---------------------------------------------------------------------------

RUBRIC_SCHEMAS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "technical": {
        "core_domain_knowledge": {"weight": 0.30, "label": "Core Domain Knowledge"},
        "technical_accuracy": {"weight": 0.25, "label": "Technical Accuracy"},
        "problem_solving_approach": {"weight": 0.20, "label": "Problem Solving & Approach"},
        "architectural_and_tradeoff_reasoning": {"weight": 0.15, "label": "Architecture & Trade-offs"},
        "communication_clarity": {"weight": 0.10, "label": "Communication Clarity"}
    },
    "hr": {
        "star_methodology_structure": {"weight": 0.25, "label": "STAR Method Structure"},
        "communication_and_articulation": {"weight": 0.25, "label": "Communication & Articulation"},
        "conflict_resolution_and_teamwork": {"weight": 0.20, "label": "Teamwork & Conflict Resolution"},
        "ownership_and_accountability": {"weight": 0.15, "label": "Ownership & Accountability"},
        "cultural_alignment_and_adaptability": {"weight": 0.15, "label": "Culture Alignment & Adaptability"}
    },
    "behavioral": {
        "star_methodology_structure": {"weight": 0.25, "label": "STAR Method Structure"},
        "communication_and_articulation": {"weight": 0.25, "label": "Communication & Articulation"},
        "conflict_resolution_and_teamwork": {"weight": 0.20, "label": "Teamwork & Conflict Resolution"},
        "ownership_and_accountability": {"weight": 0.15, "label": "Ownership & Accountability"},
        "cultural_alignment_and_adaptability": {"weight": 0.15, "label": "Culture Alignment & Adaptability"}
    },
    "coding": {
        "algorithmic_correctness": {"weight": 0.35, "label": "Algorithmic Correctness"},
        "complexity_analysis_time_space": {"weight": 0.25, "label": "Complexity Analysis (Time & Space)"},
        "code_quality_and_structure": {"weight": 0.20, "label": "Code Quality & Structure"},
        "edge_case_and_boundary_handling": {"weight": 0.10, "label": "Edge Case & Boundary Handling"},
        "problem_solving_clarity": {"weight": 0.10, "label": "Problem Solving Clarity"}
    },
    "project": {
        "depth_of_ownership_and_role": {"weight": 0.30, "label": "Ownership & Individual Contribution"},
        "architectural_and_design_justification": {"weight": 0.25, "label": "Architecture & Design Decisions"},
        "challenge_handling_and_tradeoffs": {"weight": 0.20, "label": "Challenge Handling & Tradeoffs"},
        "technical_depth_of_claimed_skills": {"weight": 0.15, "label": "Depth of Claimed Tech Stack"},
        "articulation_and_presentation": {"weight": 0.10, "label": "Articulation & Defense"}
    },
    "viva": {
        "conceptual_and_theoretical_rigor": {"weight": 0.35, "label": "Conceptual & Theoretical Rigor"},
        "definition_and_axiom_precision": {"weight": 0.25, "label": "Precision of Definitions & Laws"},
        "defense_under_cross_examination": {"weight": 0.20, "label": "Defense Under Cross-Examination"},
        "breadth_of_syllabus_coverage": {"weight": 0.10, "label": "Breadth of Syllabus Coverage"},
        "academic_clarity": {"weight": 0.10, "label": "Academic & Mathematical Clarity"}
    },
    "placement": {
        "core_technical_competence": {"weight": 0.30, "label": "Core Technical Competence"},
        "analytical_and_problem_solving": {"weight": 0.25, "label": "Analytical & Problem Solving"},
        "practical_scenario_execution": {"weight": 0.20, "label": "Practical Scenario Execution"},
        "professional_communication": {"weight": 0.15, "label": "Professional Communication"},
        "confidence_and_structure": {"weight": 0.10, "label": "Confidence & Structure"}
    }
}


# ---------------------------------------------------------------------------
# Prompt Builders for Interview Roles
# ---------------------------------------------------------------------------

def _get_interviewer_system_prompt(session: InterviewSession, resume_context: str = "") -> str:
    interview_type = session.interview_type.lower()
    role = session.subject_role
    role_lower = role.lower()
    level = session.experience_level
    difficulty = session.difficulty
    language = session.language

    base = f"""You are an elite, professional AI Technical Interviewer conducting a realistic {interview_type.upper()} interview for the role / subject: "{role}".
The candidate level is: {level}.
The target difficulty is: {difficulty}.
Conduct the interview entirely in: {language}.

Core Interviewing Rules:
1. Ask exactly ONE question at a time.
2. Be polite, formal, objective, and realistic — like an expert hiring manager or university viva examiner.
3. NEVER reveal the answers or correct the candidate during the interview turn. Save feedback for the post-interview report.
4. Do NOT say generic pleasantries like "Hello, welcome to the interview" before every question. Go straight to the question text clearly.
5. Tailor the question strictly to the subject "{role}" and difficulty level "{difficulty}".
"""

    if resume_context:
        base += f"""
Candidate Verified Resume / Project Document Excerpt:
\"\"\"
{resume_context}
\"\"\"
IMPORTANT: Ask questions about the candidate's actual projects, architectural decisions, claimed technical skills, or design challenges shown above. Do NOT hallucinate skills or work experience not in the document.
"""

    # Stage 3 Domain-Specific Interview Guidance
    if interview_type == "coding":
        base += """
For CODING mode:
- Provide a clear algorithmic or software problem statement.
- Specify input format, output format, and constraints.
- Provide a starter code signature or boilerplate in Python, C, C++, or Java.
- Assess time and space complexity and edge cases.
"""
    elif interview_type in ["hr", "behavioral"]:
        base += """
For HR & BEHAVIORAL mode:
- Frame situational, behavioral, and conflict-resolution questions using the STAR methodology (Situation, Task, Action, Result).
- Focus on real-world team collaboration, handling technical disagreements, managing tight deadlines, ethical decisions, and ownership.
- Probe specifically on individual contributions vs team accomplishments.
"""
    elif interview_type == "viva":
        base += """
For UNIVERSITY VIVA mode:
- Embody a rigorous, academic university professor / viva voce external examiner.
- Probe fundamental theoretical principles, formal definitions, proofs, mathematical derivations, boundary conditions, and foundational axioms.
- Challenge candidate claims with academic counter-examples.
"""
    elif interview_type == "project":
        base += """
For PROJECT & RESUME DEFENSE mode:
- Deep-dive into architectural justifications, database schema choices, performance bottlenecks, and security considerations.
- Ask candidate to justify why they chose technology X over Y for their project.
- Probe the biggest technical challenge faced and how it was resolved.
"""
    elif interview_type == "placement":
        base += """
For CAMPUS PLACEMENT mode:
- Mimic campus hiring drives for top tech firms.
- Combine fundamental computer science questions with practical engineering problem scenarios and professional communication checks.
"""
    else:  # Technical interview track
        base += """
For TECHNICAL mode:
"""
        if any(k in role_lower for k in ["python", "django", "fastapi", "flask"]):
            base += "- Focus on Python internals: GIL, memory management/reference counting, generators/iterators, decorators, asyncio event loop, typing, and framework routing/middleware.\n"
        elif any(k in role_lower for k in ["c ", "c programming", "c language", "embedded"]):
            base += "- Focus on C internals: pointers, pointer arithmetic, memory allocation (malloc/free), stack vs heap, struct alignment/padding, segmentation faults, and undefined behavior.\n"
        elif any(k in role_lower for k in ["java", "spring"]):
            base += "- Focus on Java internals: JVM architecture (heap/stack/metaspace), GC algorithms (G1, ZGC), multithreading, synchronization primitives, abstract classes vs interfaces, and Spring dependency injection.\n"
        elif any(k in role_lower for k in ["dsa", "data structure", "algorithm"]):
            base += "- Focus on DSA: Big-O time and space complexity, recursion vs iteration, dynamic programming state transitions, graph traversals (BFS/DFS, Dijkstra), trees/tries, and heap operations.\n"
        elif any(k in role_lower for k in ["operating system", "os "]):
            base += "- Focus on OS: process vs thread, IPC mechanisms, virtual memory/paging, TLB, deadlock necessary conditions & prevention, CPU scheduling algorithms, and race conditions/semaphores.\n"
        elif any(k in role_lower for k in ["dbms", "database", "sql"]):
            base += "- Focus on DBMS: ACID properties, B+ Tree indexing internals, transaction isolation levels (Dirty Read, Non-repeatable Read, Phantom Read), normalization (1NF-BCNF), and execution plans.\n"
        elif any(k in role_lower for k in ["network"]):
            base += "- Focus on Networks: OSI 7-layer model, TCP 3-way handshake & 4-way teardown, flow control vs congestion control, UDP vs TCP, DNS resolution, and HTTPS TLS handshake.\n"
        elif any(k in role_lower for k in ["ai", "machine learning", "ml", "deep learning"]):
            base += "- Focus on AI/ML: supervised vs unsupervised, bias-variance tradeoff, regularization (L1/L2), loss functions, transformer self-attention mechanisms, and precision/recall/F1 metrics.\n"
        elif any(k in role_lower for k in ["web", "frontend", "react", "node"]):
            base += "- Focus on Web Engineering: DOM rendering pipeline, event loop, CORS, JWT vs session cookies, REST idempotency, client-side caching vs HTTP caching, and WebSockets.\n"
        else:
            base += "- Focus on core technical principles, architectural tradeoffs, system scalability, and practical engineering scenarios.\n"

    return base


# ---------------------------------------------------------------------------
# Question Generation
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Adaptive Intelligence & Follow-Up Helpers (Stage 2)
# ---------------------------------------------------------------------------

def _compute_adaptive_difficulty(session: InterviewSession, turns: List[InterviewTurn]) -> str:
    """Computes dynamic difficulty based on candidate's performance trend."""
    if session.difficulty != "adaptive":
        return session.difficulty

    evaluated_turns = [t for t in turns if t.score_awarded is not None]
    if not evaluated_turns:
        return "medium"

    recent_scores = [t.score_awarded for t in evaluated_turns[-3:]]
    avg_score = sum(recent_scores) / len(recent_scores)

    if avg_score >= 80.0:
        return "hard (advanced scenarios, scale, edge cases & internal architecture)"
    elif avg_score < 50.0:
        return "foundational (core definitions, practical scenarios, gentle ramp-up)"
    else:
        return "medium (standard industry engineering challenges)"


async def _generate_question(
    db: Session,
    session: InterviewSession,
    turn_num: int,
    history_turns: List[InterviewTurn],
    effective_difficulty: Optional[str] = None
) -> Tuple[str, Optional[str]]:
    """
    Generates the next question using conversational history and adaptive difficulty.
    Returns (question_text, optional starter_code).
    """
    resume_context = _get_resume_context(db, session.resume_document_id, session.user_id)
    system_prompt = _get_interviewer_system_prompt(session, resume_context)

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]

    # Append past turns so LLM maintains cohesive conversational continuity
    for turn in history_turns:
        messages.append({"role": "assistant", "content": turn.question_text})
        if turn.candidate_answer:
            messages.append({"role": "user", "content": f"[Candidate Answer]: {turn.candidate_answer}"})
        elif turn.candidate_code:
            messages.append({"role": "user", "content": f"[Candidate Code Submission]:\n```\n{turn.candidate_code}\n```"})
        elif turn.status == "skipped":
            messages.append({"role": "user", "content": "[Candidate skipped this question]"})

    diff = effective_difficulty or session.difficulty
    user_instruction = f"""Generate Main Question #{turn_num} of {session.total_main_questions}.
Target difficulty level: {diff}.
Make sure it does NOT repeat previous topics covered above.
Ask the question directly. Do not include introductory conversational fluff.
"""
    if session.interview_type.lower() == "coding":
        user_instruction += " Format your response with the Problem Statement and include a starter code block."

    messages.append({"role": "user", "content": user_instruction})

    response = await _call_llm(messages, temperature=0.7, max_tokens=800)

    # Extract starter code if coding interview
    starter_code = None
    if session.interview_type.lower() == "coding" and "```" in response:
        parts = response.split("```")
        if len(parts) >= 3:
            raw_code = parts[1]
            lines = raw_code.split("\n")
            if lines and lines[0].strip().lower() in ["python", "cpp", "c", "java", "javascript", "ts"]:
                starter_code = "\n".join(lines[1:]).strip()
            else:
                starter_code = raw_code.strip()

    return response.strip(), starter_code


async def _evaluate_turn_response(
    turn: InterviewTurn,
    session: InterviewSession,
    candidate_response: str
) -> Dict[str, Any]:
    """
    Stage 2: Evaluates candidate's answer to the specific turn question.
    Determines accuracy, completeness, claims made, and whether an adaptive follow-up is warranted.
    """
    clean_resp = candidate_response.strip().lower()
    if not clean_resp or clean_resp in ["[candidate skipped this question]", "skip", "i don't know", "pass"]:
        return {
            "accuracy": 0.0,
            "completeness": 0.0,
            "clarity": 0.0,
            "score": 0.0,
            "needs_follow_up": False,
            "follow_up_reason": None,
            "follow_up_topic": None,
            "difficulty_trend": "decrease"
        }

    eval_prompt = f"""You are an elite interviewer assessing a candidate's response for {session.subject_role} ({session.interview_type} interview).

Question Asked:
"{turn.question_text}"

Candidate Answer:
\"\"\"{candidate_response[:3000]}\"\"\"

Target Experience Level: {session.experience_level}
Current Turn Type: {turn.turn_type} (Follow-Up #{turn.follow_up_index})

Analyze the response strictly:
1. Accuracy: Did they answer the question correctly?
2. Completeness: Did they address key mechanisms, trade-offs, or edge cases?
3. Technical claims: Did they make technical assertions without justifying them?
4. Follow-up need:
   - If the answer was superficial, missing an important edge case, or made an unverified claim, set needs_follow_up to true.
   - If the answer was solid, complete, and demonstrated strong comprehension, set needs_follow_up to false.

Output strict JSON only:
{{
  "accuracy": <float 0-100>,
  "completeness": <float 0-100>,
  "clarity": <float 0-100>,
  "score": <float 0-100>,
  "needs_follow_up": <bool>,
  "follow_up_reason": "<brief rationale for probe, or null>",
  "follow_up_topic": "<specific topic or claim to challenge, or null>",
  "difficulty_trend": "<increase|maintain|decrease>"
}}
"""
    messages = [
        {"role": "system", "content": "You are an objective assessment engine. Output valid parseable JSON only."},
        {"role": "user", "content": eval_prompt}
    ]

    try:
        raw = await _call_llm(messages, temperature=0.2, max_tokens=300)
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        data = json.loads(cleaned.strip())
        return data
    except Exception as e:
        logger.warning(f"Error in turn evaluation: {e}. Using heuristic assessment.")
        word_count = len(candidate_response.split())
        score = min(85.0, max(40.0, float(word_count * 2)))
        return {
            "accuracy": score,
            "completeness": score,
            "clarity": 70.0,
            "score": score,
            "needs_follow_up": score < 60.0,
            "follow_up_reason": "Elaborate on technical trade-offs and edge cases" if score < 60.0 else None,
            "follow_up_topic": "technical justification",
            "difficulty_trend": "maintain"
        }


async def _generate_follow_up_question(
    db: Session,
    session: InterviewSession,
    parent_turn: InterviewTurn,
    follow_up_index: int,
    assessment: Dict[str, Any],
    history_turns: List[InterviewTurn]
) -> Tuple[str, Optional[str]]:
    """
    Generates an adaptive follow-up probing question directly challenging
    the candidate's prior answer, asking for technical justification, or probing an edge case.
    """
    resume_context = _get_resume_context(db, session.resume_document_id, session.user_id)
    system_prompt = _get_interviewer_system_prompt(session, resume_context)

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]

    for turn in history_turns:
        messages.append({"role": "assistant", "content": turn.question_text})
        if turn.candidate_answer:
            messages.append({"role": "user", "content": f"[Candidate Answer]: {turn.candidate_answer}"})
        elif turn.candidate_code:
            messages.append({"role": "user", "content": f"[Candidate Code Submission]:\n```\n{turn.candidate_code}\n```"})
        elif turn.status == "skipped":
            messages.append({"role": "user", "content": "[Candidate skipped this question]"})

    probe_reason = assessment.get("follow_up_reason") or "elaborate on technical trade-offs"
    probe_topic = assessment.get("follow_up_topic") or "the implementation details"

    user_instruction = f"""Generate Follow-Up Probe #{follow_up_index} of {session.max_follow_ups_per_question} for Topic #{parent_turn.main_question_index}.
The candidate just responded:
\"{parent_turn.candidate_answer or parent_turn.candidate_code}\"

Probe finding: {probe_reason}.
Focus of probe: {probe_topic}.

Rules:
1. Ask candidate to justify their claim, explain an edge case, or analyze trade-offs.
2. Ask the question directly. No conversational pleasantries.
3. Keep it sharp, realistic, and concise (1-2 sentences).
"""
    messages.append({"role": "user", "content": user_instruction})

    response = await _call_llm(messages, temperature=0.6, max_tokens=400)
    return response.strip(), None


# ---------------------------------------------------------------------------
# Final Evaluation Generation (Teach-After-Interview)
# ---------------------------------------------------------------------------

async def _generate_final_evaluation(
    db: Session,
    session: InterviewSession,
    turns: List[InterviewTurn]
) -> InterviewEvaluation:
    """
    Stage 3: Generates a comprehensive mode-specific rubric evaluation,
    weighted multi-dimensional scoring, and post-interview Teach-After-Interview materials.
    """
    logger.info(f"Generating interview evaluation for session {session.id}")
    session.status = "evaluating"
    db.commit()

    # Retrieve specialized rubric for this interview track
    rubric = RUBRIC_SCHEMAS.get(session.interview_type.lower(), RUBRIC_SCHEMAS["technical"])
    dim_descriptions = []
    for dim_key, dim_info in rubric.items():
        weight_pct = int(dim_info["weight"] * 100)
        dim_descriptions.append(f'"{dim_key}": <float 0-100> (evaluating {dim_info["label"]}, weight {weight_pct}%)')
    dim_schema_text = ",\n    ".join(dim_descriptions)

    # Build transcript for the evaluation LLM
    transcript = []
    answered_count = 0
    for idx, turn in enumerate(turns, 1):
        ans = turn.candidate_answer or turn.candidate_code or "(Skipped / No answer)"
        if turn.candidate_answer or turn.candidate_code:
            answered_count += 1
        turn_kind = f" [{turn.turn_type.upper()}]" if turn.turn_type != "main" else ""
        transcript.append(f"Question {idx}{turn_kind}: {turn.question_text}\nCandidate Answer {idx}: {ans}\n")

    full_transcript = "\n---\n".join(transcript)

    eval_prompt = f"""You are a master assessor and career educator evaluating a candidate's completed {session.interview_type.upper()} interview for the role / subject: "{session.subject_role}".

Interview Context:
- Role / Subject: {session.subject_role}
- Interview Track: {session.interview_type.upper()}
- Target Experience Level: {session.experience_level}
- Target Difficulty: {session.difficulty}
- Total Questions Asked: {len(turns)}
- Total Questions Answered: {answered_count}

Candidate Interview Transcript:
\"\"\"
{full_transcript}
\"\"\"

Evaluate the candidate objectively and thoroughly using this specialized rubric for {session.interview_type.upper()} mode:
You MUST output your evaluation in strict valid JSON format matching this schema:
{{
  "dimension_scores": {{
    {dim_schema_text}
  }},
  "summary_verdict": "<2-3 sentence executive assessment of candidate performance, domain readiness, and gaps>",
  "peer_band": "<one of: 'Top 10%', 'Top 25%', 'Average', 'Below Average', 'Needs Significant Work'>",
  "hire_recommendation": "<one of: 'Strong Hire', 'Hire', 'Borderline', 'No Hire'>",
  "evidence_by_category": {{
    "strong_answers": ["<evidence snippet 1>", "<evidence snippet 2>"],
    "weak_answers": ["<evidence snippet 1>", "<evidence snippet 2>"]
  }},
  "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "knowledge_gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "study_roadmap": [
    {{
      "topic": "<topic name>",
      "priority": "<high|medium|low>",
      "action_item": "<concrete concept to master or exercise to do>",
      "review_in_days": <int: suggested days until first spaced-repetition review, e.g. 1 for critical gaps, 3 for medium, 7 for low>
    }}
  ],
  "teach_after_feedback": [
    {{
      "question_number": <int>,
      "question_topic": "<brief topic label>",
      "candidate_attempt_review": "<constructive critique of exactly what the candidate said — be specific>",
      "ideal_model_answer": "<the correct, comprehensive expert-level answer with technical depth, examples, and code snippets where relevant>",
      "key_concepts": ["<concept 1>", "<concept 2>", "<concept 3>"],
      "common_mistakes": ["<typical mistake 1>", "<typical mistake 2>"]
    }}
  ],
  "full_report_markdown": "<complete, richly formatted markdown report with headers, bullet points, dimension score table, teach-back section, and code/formulas where helpful>"
}}

Output ONLY the JSON object. Do not wrap in markdown code blocks if possible.
"""

    eval_messages = [
        {"role": "system", "content": "You are a professional educational evaluation engine. Output valid, parseable JSON only."},
        {"role": "user", "content": eval_prompt}
    ]

    raw_eval = await _call_llm(eval_messages, temperature=0.3, max_tokens=3000)

    # Clean and parse JSON safely
    cleaned_json = raw_eval.strip()
    if cleaned_json.startswith("```json"):
        cleaned_json = cleaned_json[7:]
    if cleaned_json.startswith("```"):
        cleaned_json = cleaned_json[3:]
    if cleaned_json.endswith("```"):
        cleaned_json = cleaned_json[:-3]
    cleaned_json = cleaned_json.strip()

    try:
        data = json.loads(cleaned_json)
    except Exception as parse_err:
        logger.warning(f"Failed to parse LLM evaluation JSON directly: {parse_err}. Creating structured fallback report.")
        fallback_dims = {k: (65.0 if answered_count > 0 else 0.0) for k in rubric.keys()}
        data = {
            "dimension_scores": fallback_dims,
            "summary_verdict": "Candidate demonstrated solid effort across the interview session.",
            "evidence_by_category": {"strong_answers": [], "weak_answers": []},
            "key_strengths": ["Completed interactive interview session", "Willingness to articulate solutions"],
            "knowledge_gaps": ["Review fundamental concepts and technical justifications"],
            "study_roadmap": [{"topic": session.subject_role, "priority": "high", "action_item": "Review core documentation and practice scenario questions"}],
            "teach_after_feedback": [],
            "full_report_markdown": raw_eval
        }

    # Calculate weighted overall score according to mode rubric
    dim_scores = data.get("dimension_scores", {})
    calculated_overall = 0.0
    for dim_key, dim_info in rubric.items():
        score_val = float(dim_scores.get(dim_key, 60.0 if answered_count > 0 else 0.0))
        calculated_overall += score_val * dim_info["weight"]
    final_overall_score = round(max(0.0, min(100.0, calculated_overall)), 1)

    evidence_dict = data.get("evidence_by_category", {})
    if not isinstance(evidence_dict, dict):
        evidence_dict = {}

    # Stage 5 Spaced Repetition & Peer Banding
    peer_band = data.get("peer_band")
    if not peer_band:
        if final_overall_score >= 88:
            peer_band = "Top 10%"
        elif final_overall_score >= 75:
            peer_band = "Top 25%"
        elif final_overall_score >= 55:
            peer_band = "Average"
        else:
            peer_band = "Needs Significant Work"
    evidence_dict["peer_band"] = peer_band

    hire_recommendation = data.get("hire_recommendation")
    if not hire_recommendation:
        if final_overall_score >= 80:
            hire_recommendation = "Strong Hire"
        elif final_overall_score >= 65:
            hire_recommendation = "Hire"
        elif final_overall_score >= 45:
            hire_recommendation = "Borderline"
        else:
            hire_recommendation = "No Hire"
    evidence_dict["hire_recommendation"] = hire_recommendation

    roadmap_list = data.get("study_roadmap", [])
    if isinstance(roadmap_list, list):
        for item in roadmap_list:
            if isinstance(item, dict) and "review_in_days" not in item:
                prio = str(item.get("priority", "medium")).lower()
                item["review_in_days"] = 1 if prio == "high" else (3 if prio == "medium" else 7)

    teach_feedback_list = data.get("teach_after_feedback", [])
    if isinstance(teach_feedback_list, list):
        for item in teach_feedback_list:
            if isinstance(item, dict):
                if "key_concepts" not in item:
                    item["key_concepts"] = [session.subject_role]
                if "common_mistakes" not in item:
                    item["common_mistakes"] = ["Vague technical definitions or skipping edge-case trade-offs"]

    evaluation = InterviewEvaluation(
        session_id=session.id,
        rubric_version="2.0",
        status="completed",
        overall_score=final_overall_score,
        dimension_scores=json.dumps(dim_scores),
        summary_verdict=str(data.get("summary_verdict", "Evaluation completed.")),
        evidence_by_category=json.dumps(evidence_dict),
        key_strengths=json.dumps(data.get("key_strengths", [])),
        knowledge_gaps=json.dumps(data.get("knowledge_gaps", [])),
        study_roadmap=json.dumps(roadmap_list),
        teach_after_feedback=json.dumps(teach_feedback_list),
        full_report_markdown=str(data.get("full_report_markdown", raw_eval))
    )

    db.add(evaluation)
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    session.version += 1
    db.commit()
    db.refresh(evaluation)
    return evaluation


# ---------------------------------------------------------------------------
# Public Service API
# ---------------------------------------------------------------------------

class InterviewService:

    @staticmethod
    def create_session(db: Session, user_id: str, config: InterviewSessionCreate) -> InterviewSession:
        """Creates a new interview session in 'created' state."""
        # Validate resume document ownership if provided
        if config.resume_document_id:
            doc = db.query(Document).filter(
                Document.id == config.resume_document_id,
                Document.user_id == user_id
            ).first()
            if not doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Selected resume or project document not found or unauthorized."
                )

        session = InterviewSession(
            user_id=user_id,
            interview_type=config.interview_type.lower(),
            subject_role=config.subject_role.strip(),
            experience_level=config.experience_level or "fresher",
            difficulty=config.difficulty or "medium",
            total_main_questions=config.total_main_questions or 5,
            max_follow_ups_per_question=config.max_follow_ups_per_question or 2,
            allocated_time_min=config.allocated_time_min or 20,
            language=config.language or "English",
            interaction_mode=config.interaction_mode or "text",
            resume_document_id=config.resume_document_id,
            status="created",
            main_questions_asked=0,
            main_questions_answered=0,
            total_follow_ups_asked=0,
            current_sequence_number=0,
            version=1
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    async def start_session(db: Session, session_id: str, user_id: str) -> Tuple[InterviewSession, InterviewTurn]:
        """
        Transitions session from 'created' to 'in_progress', generates Question 1,
        and creates Turn 1 with status 'awaiting_answer'.
        """
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

        # Idempotent start: if already in progress and has turn 1, return it
        if session.status == "in_progress":
            active_turn = db.query(InterviewTurn).filter(
                InterviewTurn.session_id == session.id,
                InterviewTurn.status == "awaiting_answer"
            ).order_by(InterviewTurn.sequence_number.desc()).first()
            if active_turn:
                return session, active_turn

        if session.status != "created":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start session in status '{session.status}'."
            )

        # Transition to in_progress
        session.status = "in_progress"
        session.started_at = datetime.now(timezone.utc)
        session.version += 1

        # Generate Question 1
        q_text, starter_code = await _generate_question(db, session, turn_num=1, history_turns=[])

        turn = InterviewTurn(
            session_id=session.id,
            sequence_number=1,
            main_question_index=1,
            follow_up_index=0,
            turn_type="main",
            question_text=q_text,
            coding_starter_code=starter_code,
            status="awaiting_answer",
            asked_at=datetime.now(timezone.utc)
        )

        session.main_questions_asked = 1
        session.current_sequence_number = 1

        db.add(turn)
        db.commit()
        db.refresh(session)
        db.refresh(turn)
        return session, turn

    @staticmethod
    async def submit_answer(
        db: Session,
        session_id: str,
        user_id: str,
        answer_in: AnswerSubmissionRequest,
        idempotency_key: Optional[str] = None
    ) -> TurnAnswerResponse:
        """
        Submits candidate answer with persistent idempotency protection,
        advances turn state, and triggers next question or final evaluation.
        """
        # 1. Check Idempotency Record
        if idempotency_key:
            idem_rec = db.query(IdempotencyRecord).filter(
                IdempotencyRecord.user_id == user_id,
                IdempotencyRecord.key == idempotency_key
            ).first()

            if idem_rec:
                if idem_rec.status == "completed" and idem_rec.response_body:
                    try:
                        cached_data = json.loads(idem_rec.response_body)
                        return TurnAnswerResponse(**cached_data)
                    except Exception:
                        pass
                elif idem_rec.status == "in_progress":
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Submission with this idempotency key is already currently being processed."
                    )
            else:
                # Compute request payload hash
                payload_str = f"{session_id}:{answer_in.turn_id}:{answer_in.sequence_number}:{answer_in.candidate_answer or ''}"
                req_hash = hashlib.sha256(payload_str.encode()).hexdigest()
                new_idem = IdempotencyRecord(
                    key=idempotency_key,
                    user_id=user_id,
                    resource_type="interview_turn",
                    resource_id=answer_in.turn_id,
                    request_hash=req_hash,
                    status="in_progress",
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
                )
                db.add(new_idem)
                db.commit()

        # 2. Fetch session and verify ownership & status
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

        if session.status != "in_progress":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Interview is not in progress (current status: {session.status})."
            )

        # 3. Fetch active turn and validate sequence
        turn = db.query(InterviewTurn).filter(
            InterviewTurn.id == answer_in.turn_id,
            InterviewTurn.session_id == session.id
        ).first()

        if not turn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview turn not found.")

        if turn.status != "awaiting_answer":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Turn is not awaiting an answer (status: {turn.status})."
            )

        if turn.sequence_number != answer_in.sequence_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sequence number mismatch: expected {turn.sequence_number}, got {answer_in.sequence_number}."
            )

        # 4. Record answer & evaluate turn (Stage 2 Adaptive Assessment)
        ans_text = (answer_in.candidate_answer or "").strip()
        turn.candidate_answer = ans_text
        turn.candidate_code = answer_in.candidate_code
        turn.answered_at = datetime.now(timezone.utc)
        turn.status = "answered"

        # Evaluate candidate response
        candidate_content = ans_text or (f"```\n{answer_in.candidate_code}\n```" if answer_in.candidate_code else "")
        assessment = await _evaluate_turn_response(turn, session, candidate_content)
        turn.assessment_data = json.dumps(assessment)
        turn.score_awarded = float(assessment.get("score", 70.0))
        turn.status = "evaluated"

        db.flush()

        all_turns = db.query(InterviewTurn).filter(
            InterviewTurn.session_id == session.id
        ).order_by(InterviewTurn.sequence_number).all()

        # Check follow-up status for current main question topic
        topic_follow_ups = [
            t for t in all_turns
            if t.main_question_index == turn.main_question_index and t.turn_type == "follow_up"
        ]
        follow_up_count = len(topic_follow_ups)

        should_follow_up = (
            assessment.get("needs_follow_up", False)
            and follow_up_count < session.max_follow_ups_per_question
            and turn.candidate_answer != "[Candidate skipped this question]"
        )

        response_payload: TurnAnswerResponse

        if should_follow_up:
            # 5A. Generate Adaptive Contextual Follow-Up Probe
            next_seq = session.current_sequence_number + 1
            follow_up_q, starter = await _generate_follow_up_question(
                db=db,
                session=session,
                parent_turn=turn,
                follow_up_index=follow_up_count + 1,
                assessment=assessment,
                history_turns=all_turns
            )

            next_turn = InterviewTurn(
                session_id=session.id,
                sequence_number=next_seq,
                main_question_index=turn.main_question_index,
                follow_up_index=follow_up_count + 1,
                turn_type="follow_up",
                follow_up_to_turn_id=turn.id,
                question_text=follow_up_q,
                coding_starter_code=starter,
                status="awaiting_answer",
                asked_at=datetime.now(timezone.utc)
            )
            session.total_follow_ups_asked += 1
            session.current_sequence_number = next_seq
            session.version += 1

            db.add(next_turn)
            db.commit()
            db.refresh(next_turn)

            response_payload = TurnAnswerResponse(
                session_id=session.id,
                session_status=session.status,
                main_questions_answered=session.main_questions_answered,
                total_main_questions=session.total_main_questions,
                next_turn=InterviewTurnResponse.model_validate(next_turn),
                is_completed=False,
                evaluation=None
            )
        else:
            # 5B. Main Question Topic Completed -> Advance to Next Main Topic or Complete Interview
            session.main_questions_answered += 1
            session.version += 1

            if session.main_questions_answered >= session.total_main_questions:
                # All main questions covered! Generate comprehensive evaluation
                evaluation = await _generate_final_evaluation(db, session, all_turns)
                ev_cat = json.loads(evaluation.evidence_by_category) if evaluation.evidence_by_category else {}
                eval_resp = InterviewEvaluationResponse(
                    id=evaluation.id,
                    session_id=evaluation.session_id,
                    rubric_version=evaluation.rubric_version,
                    status=evaluation.status,
                    overall_score=evaluation.overall_score,
                    dimension_scores=json.loads(evaluation.dimension_scores) if evaluation.dimension_scores else {},
                    summary_verdict=evaluation.summary_verdict,
                    peer_band=ev_cat.get("peer_band"),
                    hire_recommendation=ev_cat.get("hire_recommendation"),
                    evidence_by_category=ev_cat,
                    key_strengths=json.loads(evaluation.key_strengths) if evaluation.key_strengths else [],
                    knowledge_gaps=json.loads(evaluation.knowledge_gaps) if evaluation.knowledge_gaps else [],
                    study_roadmap=json.loads(evaluation.study_roadmap) if evaluation.study_roadmap else [],
                    teach_after_feedback=json.loads(evaluation.teach_after_feedback) if evaluation.teach_after_feedback else [],
                    full_report_markdown=evaluation.full_report_markdown,
                    generated_at=evaluation.generated_at
                )
                response_payload = TurnAnswerResponse(
                    session_id=session.id,
                    session_status=session.status,
                    main_questions_answered=session.main_questions_answered,
                    total_main_questions=session.total_main_questions,
                    next_turn=None,
                    is_completed=True,
                    evaluation=eval_resp
                )
            else:
                # Generate Next Main Question with adaptive difficulty scaling
                next_main_idx = session.main_questions_answered + 1
                next_seq = session.current_sequence_number + 1
                effective_diff = _compute_adaptive_difficulty(session, all_turns)

                next_q_text, starter_code = await _generate_question(
                    db=db,
                    session=session,
                    turn_num=next_main_idx,
                    history_turns=all_turns,
                    effective_difficulty=effective_diff
                )

                next_turn = InterviewTurn(
                    session_id=session.id,
                    sequence_number=next_seq,
                    main_question_index=next_main_idx,
                    follow_up_index=0,
                    turn_type="main",
                    question_text=next_q_text,
                    coding_starter_code=starter_code,
                    status="awaiting_answer",
                    asked_at=datetime.now(timezone.utc)
                )
                session.main_questions_asked += 1
                session.current_sequence_number = next_seq

                db.add(next_turn)
                db.commit()
                db.refresh(next_turn)

                response_payload = TurnAnswerResponse(
                    session_id=session.id,
                    session_status=session.status,
                    main_questions_answered=session.main_questions_answered,
                    total_main_questions=session.total_main_questions,
                    next_turn=InterviewTurnResponse.model_validate(next_turn),
                    is_completed=False,
                    evaluation=None
                )

        # 6. Finalize Idempotency Record if key was provided
        if idempotency_key:
            idem_rec = db.query(IdempotencyRecord).filter(
                IdempotencyRecord.user_id == user_id,
                IdempotencyRecord.key == idempotency_key
            ).first()
            if idem_rec:
                idem_rec.status = "completed"
                idem_rec.response_code = 200
                idem_rec.response_body = response_payload.model_dump_json()
                db.commit()

        return response_payload

    @staticmethod
    async def skip_turn(db: Session, session_id: str, user_id: str) -> TurnAnswerResponse:
        """Skips the active question and moves forward."""
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id
        ).first()
        if not session or session.status != "in_progress":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active interview session to skip.")

        active_turn = db.query(InterviewTurn).filter(
            InterviewTurn.session_id == session.id,
            InterviewTurn.status == "awaiting_answer"
        ).order_by(InterviewTurn.sequence_number.desc()).first()

        if not active_turn:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active question awaiting answer.")

        # Simulate submission with skipped placeholder
        req = AnswerSubmissionRequest(
            turn_id=active_turn.id,
            sequence_number=active_turn.sequence_number,
            candidate_answer="[Candidate skipped this question]"
        )
        return await InterviewService.submit_answer(db, session_id, user_id, req)

    @staticmethod
    async def end_session(db: Session, session_id: str, user_id: str, reason: str = "candidate_requested") -> InterviewSession:
        """Terminates an interview early and generates evaluation if questions were answered."""
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

        if session.status in ["completed", "cancelled", "abandoned"]:
            return session

        session.ended_reason = reason

        turns = db.query(InterviewTurn).filter(
            InterviewTurn.session_id == session.id
        ).order_by(InterviewTurn.sequence_number).all()

        answered_turns = [
            t for t in turns 
            if t.status in ["answered", "evaluated"] and (t.candidate_answer or t.candidate_code)
        ]

        if answered_turns:
            await _generate_final_evaluation(db, session, answered_turns)
        else:
            session.status = "abandoned"
            session.completed_at = datetime.now(timezone.utc)
            session.version += 1
            db.commit()

        db.refresh(session)
        return session

    @staticmethod
    def get_session_details(db: Session, session_id: str, user_id: str) -> InterviewSessionResponse:
        """Retrieves session state, active question, past turns, and evaluation for reload recovery."""
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

        turns = db.query(InterviewTurn).filter(
            InterviewTurn.session_id == session.id
        ).order_by(InterviewTurn.sequence_number).all()

        active_turn = next((t for t in reversed(turns) if t.status == "awaiting_answer"), None)

        eval_resp = None
        if session.evaluation:
            ev = session.evaluation
            ev_cat = json.loads(ev.evidence_by_category) if ev.evidence_by_category else {}
            eval_resp = InterviewEvaluationResponse(
                id=ev.id,
                session_id=ev.session_id,
                rubric_version=ev.rubric_version,
                status=ev.status,
                overall_score=ev.overall_score,
                dimension_scores=json.loads(ev.dimension_scores) if ev.dimension_scores else {},
                summary_verdict=ev.summary_verdict,
                peer_band=ev_cat.get("peer_band"),
                hire_recommendation=ev_cat.get("hire_recommendation"),
                evidence_by_category=ev_cat,
                key_strengths=json.loads(ev.key_strengths) if ev.key_strengths else [],
                knowledge_gaps=json.loads(ev.knowledge_gaps) if ev.knowledge_gaps else [],
                study_roadmap=json.loads(ev.study_roadmap) if ev.study_roadmap else [],
                teach_after_feedback=json.loads(ev.teach_after_feedback) if ev.teach_after_feedback else [],
                full_report_markdown=ev.full_report_markdown,
                generated_at=ev.generated_at
            )

        return InterviewSessionResponse(
            id=session.id,
            user_id=session.user_id,
            interview_type=session.interview_type,
            subject_role=session.subject_role,
            experience_level=session.experience_level,
            difficulty=session.difficulty,
            total_main_questions=session.total_main_questions,
            max_follow_ups_per_question=session.max_follow_ups_per_question,
            allocated_time_min=session.allocated_time_min,
            language=session.language,
            interaction_mode=session.interaction_mode,
            resume_document_id=session.resume_document_id,
            status=session.status,
            ended_reason=session.ended_reason,
            main_questions_asked=session.main_questions_asked,
            main_questions_answered=session.main_questions_answered,
            total_follow_ups_asked=session.total_follow_ups_asked,
            current_sequence_number=session.current_sequence_number,
            version=session.version,
            started_at=session.started_at,
            completed_at=session.completed_at,
            created_at=session.created_at,
            updated_at=session.updated_at,
            current_turn=InterviewTurnResponse.model_validate(active_turn) if active_turn else None,
            turns=[InterviewTurnResponse.model_validate(t) for t in turns],
            evaluation=eval_resp
        )

    @staticmethod
    def list_user_sessions(db: Session, user_id: str, limit: int = 20) -> List[InterviewSessionResponse]:
        """Lists user interview history ordered by recent."""
        sessions = db.query(InterviewSession).filter(
            InterviewSession.user_id == user_id
        ).order_by(desc(InterviewSession.created_at)).limit(limit).all()

        return [
            InterviewSessionResponse(
                id=s.id,
                user_id=s.user_id,
                interview_type=s.interview_type,
                subject_role=s.subject_role,
                experience_level=s.experience_level,
                difficulty=s.difficulty,
                total_main_questions=s.total_main_questions,
                max_follow_ups_per_question=s.max_follow_ups_per_question,
                allocated_time_min=s.allocated_time_min,
                language=s.language,
                interaction_mode=s.interaction_mode,
                resume_document_id=s.resume_document_id,
                status=s.status,
                ended_reason=s.ended_reason,
                main_questions_asked=s.main_questions_asked,
                main_questions_answered=s.main_questions_answered,
                total_follow_ups_asked=s.total_follow_ups_asked,
                current_sequence_number=s.current_sequence_number,
                version=s.version,
                started_at=s.started_at,
                completed_at=s.completed_at,
                created_at=s.created_at,
                updated_at=s.updated_at,
                current_turn=None,
                turns=[],
                evaluation=None
            )
            for s in sessions
        ]
