"""
Interview API Endpoints — AI Interviewer for LEARN.GPT
Mounts under /api/v1/interviews
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from server.app.db.session import get_db
from server.app.models.entities import User, InterviewSession
from server.app.core.security import get_current_user
from server.app.schemas.schemas import (
    InterviewSessionCreate,
    InterviewSessionResponse,
    InterviewTurnResponse,
    AnswerSubmissionRequest,
    TurnAnswerResponse,
    InterviewEndRequest,
    CodingExecutionRequest,
    CodingExecutionResponse
)
from server.app.services.interview_service import InterviewService
from server.app.services.code_sandbox import execute_code_safely

router = APIRouter(prefix="/interviews", tags=["AI Interviewer"])


@router.post("/sessions", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_interview_session(
    config: InterviewSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new AI interview session configured with role, difficulty,
    question count, time allocation, and optional resume document.
    """
    session = InterviewService.create_session(db, current_user.id, config)
    return InterviewService.get_session_details(db, session.id, current_user.id)


@router.post("/sessions/{session_id}/start", response_model=InterviewTurnResponse)
async def start_interview_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Transitions session from 'created' to 'in_progress', generates Question 1,
    and returns Turn 1 awaiting candidate answer.
    """
    session, turn = await InterviewService.start_session(db, session_id, current_user.id)
    return turn


@router.get("/sessions/{session_id}", response_model=InterviewSessionResponse)
def get_interview_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches full session details, current turn, question history, and
    final evaluation report (if completed) for session reload recovery.
    """
    return InterviewService.get_session_details(db, session_id, current_user.id)


@router.post("/sessions/{session_id}/answer", response_model=TurnAnswerResponse)
async def submit_interview_answer(
    session_id: str,
    answer_in: AnswerSubmissionRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits candidate answer or code for the active turn.
    Protected with optimistic concurrency locking and durable idempotency caching.
    Advances to next question or generates post-interview evaluation report.
    """
    return await InterviewService.submit_answer(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        answer_in=answer_in,
        idempotency_key=idempotency_key
    )


@router.post("/sessions/{session_id}/skip", response_model=TurnAnswerResponse)
async def skip_interview_turn(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Skips the active question and immediately proceeds to the next turn or evaluation.
    """
    return await InterviewService.skip_turn(db, session_id, current_user.id)


@router.post("/sessions/{session_id}/end", response_model=InterviewSessionResponse)
async def end_interview_session(
    session_id: str,
    body: Optional[InterviewEndRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Terminates the interview session early. If questions were answered,
    generates an evaluation on answered turns.
    """
    reason = body.reason if body and body.reason else "candidate_requested"
    session = await InterviewService.end_session(db, session_id, current_user.id, reason)
    return InterviewService.get_session_details(db, session.id, current_user.id)


@router.get("/history", response_model=List[InterviewSessionResponse])
def get_interview_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the authenticated user's past interview sessions with scores and statuses.
    """
    return InterviewService.list_user_sessions(db, current_user.id, limit=limit)


@router.post("/coding/execute", response_model=CodingExecutionResponse)
async def run_sandboxed_code(
    req: CodingExecutionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Executes candidate code in an isolated subprocess sandbox.
    Subject to AST static security validation and timeout constraints.
    """
    return await execute_code_safely(
        code=req.code,
        language=req.language or "python",
        test_cases=req.test_cases,
        timeout_s=3.0
    )


@router.get("/sessions/{session_id}/report.md")
def download_interview_report(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads the comprehensive Teach-After-Interview markdown evaluation report.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")
    if not session.evaluation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evaluation report has not been generated for this session.")

    ev = session.evaluation
    report_content = ev.full_report_markdown or ev.summary_verdict
    safe_title = session.subject_role.replace(" ", "_").replace("/", "_")
    filename = f"interview_report_{safe_title}_{session.id[:8]}.md"

    return Response(
        content=report_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


