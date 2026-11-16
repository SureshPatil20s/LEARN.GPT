"""
Pydantic schemas for request validation and response serialization.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    # Real Google Sign-In: `credential` is the JWT ID token from @react-oauth/google
    credential: Optional[str] = None
    # Fallback fields (used when GOOGLE_CLIENT_ID is not yet configured)
    id_token: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    default_model: Optional[str] = None
    temperature: Optional[float] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: str
    avatar_url: Optional[str] = None
    provider: str
    system_prompt: Optional[str] = None
    default_model: Optional[str] = None
    temperature: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Chat & Conversation Schemas
class MessageCreate(BaseModel):
    conversation_id: Optional[str] = None
    content: str
    model: Optional[str] = None
    use_rag: Optional[bool] = False
    use_web_search: Optional[bool] = False
    use_memory: Optional[bool] = True
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    image_data: Optional[str] = None
    attached_filename: Optional[str] = None
    system_prompt: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    model: Optional[str] = None
    sources: Optional[str] = None
    feedback: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True


class MessageFeedback(BaseModel):
    feedback: Optional[int] = None  # 1 for up, -1 for down, 0 for clear
    rating: Optional[str] = None    # "like" or "dislike"


class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    persona_id: Optional[str] = None


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class ConversationResponse(BaseModel):
    id: str
    title: str
    pinned: bool = False
    is_pinned: bool = False
    model: str
    system_prompt: Optional[str] = None
    persona_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = []

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, "pinned") and not hasattr(obj, "is_pinned"):
            setattr(obj, "is_pinned", getattr(obj, "pinned"))
        return super().model_validate(obj, **kwargs)


# Persona Schemas
class PersonaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    avatar: Optional[str] = "🤖"
    description: Optional[str] = None
    system_prompt: str = Field(..., min_length=1)


class PersonaCreate(PersonaBase):
    pass


class PersonaResponse(PersonaBase):
    id: str
    user_id: Optional[str] = None
    is_builtin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# Prompt Template Schemas
class PromptTemplateBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    category: Optional[str] = "General"
    description: Optional[str] = None
    template: str = Field(..., min_length=1)
    variables: Optional[List[str]] = []


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateResponse(PromptTemplateBase):
    id: str
    user_id: Optional[str] = None
    is_builtin: bool = False
    variables: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    total_pages: int = 1
    total_chunks: int = 0
    chunk_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, "total_chunks") and not hasattr(obj, "chunk_count"):
            setattr(obj, "chunk_count", getattr(obj, "total_chunks"))
        return super().model_validate(obj, **kwargs)


# ---------------------------------------------------------------------------
# AI Interviewer Schemas
# ---------------------------------------------------------------------------

class InterviewSessionCreate(BaseModel):
    interview_type: str = Field(..., description="technical, hr, coding, project, viva, placement, behavioral, custom")
    subject_role: str = Field(..., min_length=2, max_length=120, description="Role or subject, e.g. 'Backend Engineer', 'OS Viva'")
    experience_level: Optional[str] = Field("fresher", description="student, fresher, 1-3yr, senior")
    difficulty: Optional[str] = Field("medium", description="easy, medium, hard, adaptive")
    total_main_questions: Optional[int] = Field(5, ge=1, le=15)
    max_follow_ups_per_question: Optional[int] = Field(2, ge=0, le=4)
    allocated_time_min: Optional[int] = Field(20, ge=5, le=90)
    language: Optional[str] = Field("English", max_length=50)
    interaction_mode: Optional[str] = Field("text", description="text or voice")
    resume_document_id: Optional[str] = None


class InterviewTurnResponse(BaseModel):
    id: str
    session_id: str
    sequence_number: int
    main_question_index: int
    follow_up_index: int
    turn_type: str
    question_text: str
    coding_starter_code: Optional[str] = None
    coding_test_specs: Optional[str] = None
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    coding_execution_result: Optional[str] = None
    assessment_data: Optional[str] = None
    score_awarded: Optional[float] = None
    status: str
    asked_at: datetime
    answered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InterviewEvaluationResponse(BaseModel):
    id: str
    session_id: str
    rubric_version: str
    status: str
    overall_score: float
    dimension_scores: Optional[Dict[str, Any]] = None
    summary_verdict: str
    peer_band: Optional[str] = None
    hire_recommendation: Optional[str] = None
    evidence_by_category: Optional[Dict[str, Any]] = None
    key_strengths: Optional[List[str]] = None
    knowledge_gaps: Optional[List[str]] = None
    study_roadmap: Optional[List[Dict[str, Any]]] = None
    teach_after_feedback: Optional[List[Dict[str, Any]]] = None
    full_report_markdown: str
    generated_at: datetime

    class Config:
        from_attributes = True


class InterviewSessionResponse(BaseModel):
    id: str
    user_id: str
    interview_type: str
    subject_role: str
    experience_level: str
    difficulty: str
    total_main_questions: int
    max_follow_ups_per_question: int
    allocated_time_min: int
    language: str
    interaction_mode: str
    resume_document_id: Optional[str] = None
    status: str
    ended_reason: Optional[str] = None
    main_questions_asked: int
    main_questions_answered: int
    total_follow_ups_asked: int
    current_sequence_number: int
    version: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    current_turn: Optional[InterviewTurnResponse] = None
    turns: Optional[List[InterviewTurnResponse]] = []
    evaluation: Optional[InterviewEvaluationResponse] = None

    class Config:
        from_attributes = True


class AnswerSubmissionRequest(BaseModel):
    turn_id: str
    sequence_number: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None


class TurnAnswerResponse(BaseModel):
    session_id: str
    session_status: str
    main_questions_answered: int
    total_main_questions: int
    next_turn: Optional[InterviewTurnResponse] = None
    is_completed: bool = False
    evaluation: Optional[InterviewEvaluationResponse] = None


class InterviewEndRequest(BaseModel):
    reason: Optional[str] = "candidate_requested"


# ---------------------------------------------------------------------------
# Coding Interview Execution Schemas (Stage 4)
# ---------------------------------------------------------------------------

class TestCaseResult(BaseModel):
    test_index: int
    input_data: str
    expected_output: str
    actual_output: Optional[str] = None
    passed: bool
    execution_time_ms: float
    error: Optional[str] = None


class CodingExecutionRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000)
    language: Optional[str] = Field("python", max_length=30)
    turn_id: Optional[str] = None
    test_cases: Optional[List[Dict[str, Any]]] = None


class CodingExecutionResponse(BaseModel):
    status: str  # "success", "error", "security_violation", "timeout"
    language: str
    total_tests: int = 0
    passed_tests: int = 0
    all_passed: bool = False
    total_execution_time_ms: float = 0.0
    output: Optional[str] = None
    error_message: Optional[str] = None
    test_results: List[TestCaseResult] = []



