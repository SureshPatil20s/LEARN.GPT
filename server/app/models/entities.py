"""
SQLAlchemy Database Models for LEARN.GPT Platform:
- Users (auth, Google OAuth, settings)
- Conversations (title, pinned, timestamps, foreign key to user)
- Messages (role, content, model, tokens, sources, feedback)
- Documents (uploaded files, chunks, page metadata for RAG)
"""
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from server.app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    provider = Column(String(32), default="email")  # 'email' or 'google'
    google_id = Column(String(128), unique=True, index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # User Preferences
    system_prompt = Column(Text, default="You are LEARN.GPT, a knowledgeable, concise, and helpful AI assistant.")
    default_model = Column(String(64), default="llama-3.3-70b-versatile")
    temperature = Column(Float, default=0.7)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="New Chat")
    pinned = Column(Boolean, default=False)
    model = Column(String(64), default="llama-3.3-70b-versatile")
    system_prompt = Column(Text, nullable=True)  # Conversation-specific custom persona/character prompt
    persona_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    model = Column(String(64), nullable=True)
    sources = Column(Text, nullable=True)  # JSON-encoded array of retrieved RAG documents & pages
    feedback = Column(Integer, default=0)  # 0: None, 1: thumbs_up, -1: thumbs_down
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(32), nullable=False)  # 'pdf', 'docx', 'txt', 'csv', 'json'
    file_size = Column(Integer, default=0)
    total_pages = Column(Integer, default=1)
    total_chunks = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="documents")
    conversation = relationship("Conversation")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, default=1)
    chunk_index = Column(Integer, default=0)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON-encoded vector embedding for semantic search

    # Relationships
    document = relationship("Document", back_populates="chunks")


class ImageGenerationLog(Base):
    __tablename__ = "image_generation_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    user = relationship("User")


class Persona(Base):
    """
    Reusable custom characters / agent personas.
    Can be user-created or system built-in templates.
    """
    __tablename__ = "personas"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True) # Null for built-ins
    name = Column(String(100), nullable=False)
    avatar = Column(String(32), default="🤖")
    description = Column(String(255), nullable=True)
    system_prompt = Column(Text, nullable=False)
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PromptTemplate(Base):
    """
    Prompt library templates with dynamic variables like {topic}, {tone}, {language}.
    """
    __tablename__ = "prompt_templates"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True) # Null for built-ins
    title = Column(String(120), nullable=False)
    category = Column(String(64), default="General")
    description = Column(String(255), nullable=True)
    template = Column(Text, nullable=False)  # e.g., "Explain {topic} in a {tone} tone for {audience}."
    variables = Column(Text, default="[]")  # JSON list of variable keys, e.g. ["topic", "tone", "audience"]
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Memory(Base):
    """
    Persistent cross-chat user memories / facts.
    Remembered across multiple conversation sessions.
    """
    __tablename__ = "memories"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)  # e.g., "User prefers Python/FastAPI code with typed annotations"
    category = Column(String(64), default="general")  # "preference", "context", "personal", "general"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# AI Interviewer Module Entities
# ---------------------------------------------------------------------------

class InterviewSession(Base):
    """
    AI Interview Session managing the macro lifecycle, configuration, progress,
    and optimistic concurrency locking.
    """
    __tablename__ = "interview_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Configuration
    interview_type = Column(String(50), nullable=False) # technical, hr, coding, project, viva, placement, behavioral
    subject_role = Column(String(100), nullable=False)   # e.g., "Python Backend Engineer", "Operating Systems"
    experience_level = Column(String(30), default="fresher", nullable=False) # student, fresher, 1-3yr, senior
    difficulty = Column(String(20), default="medium", nullable=False)        # easy, medium, hard, adaptive
    total_main_questions = Column(Integer, default=5, nullable=False)
    max_follow_ups_per_question = Column(Integer, default=2, nullable=False)
    allocated_time_min = Column(Integer, default=20, nullable=False)
    language = Column(String(30), default="English", nullable=False)
    interaction_mode = Column(String(20), default="text", nullable=False) # "text" or "voice"
    resume_document_id = Column(String(64), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    # State Machine: created, in_progress, evaluating, completed, abandoned, cancelled, failed
    status = Column(String(30), default="created", nullable=False, index=True)
    ended_reason = Column(String(50), nullable=True)

    # Progress Trackers
    main_questions_asked = Column(Integer, default=0, nullable=False)
    main_questions_answered = Column(Integer, default=0, nullable=False)
    total_follow_ups_asked = Column(Integer, default=0, nullable=False)
    current_sequence_number = Column(Integer, default=0, nullable=False)

    # Concurrency & Timestamps
    version = Column(Integer, default=1, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="interview_sessions")
    resume_document = relationship("Document")
    turns = relationship("InterviewTurn", back_populates="session", cascade="all, delete-orphan", order_by="InterviewTurn.sequence_number")
    evaluation = relationship("InterviewEvaluation", back_populates="session", uselist=False, cascade="all, delete-orphan")


class InterviewTurn(Base):
    """
    Individual turn in an interview representing a question and candidate response.
    Distinguishes main questions from contextual follow-ups.
    """
    __tablename__ = "interview_turns"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    session_id = Column(String(64), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    sequence_number = Column(Integer, nullable=False)
    main_question_index = Column(Integer, nullable=False)
    follow_up_index = Column(Integer, default=0, nullable=False)
    turn_type = Column(String(30), default="main", nullable=False) # "main", "follow_up", "clarification", "coding_challenge"
    follow_up_to_turn_id = Column(String(64), ForeignKey("interview_turns.id", ondelete="SET NULL"), nullable=True)

    question_text = Column(Text, nullable=False)
    coding_starter_code = Column(Text, nullable=True)
    coding_test_specs = Column(Text, nullable=True)

    candidate_answer = Column(Text, nullable=True)
    candidate_code = Column(Text, nullable=True)
    coding_execution_result = Column(Text, nullable=True)

    assessment_data = Column(Text, nullable=True) # JSON serialized StructuredAssessment
    score_awarded = Column(Float, nullable=True)

    # Turn Status: pending, awaiting_answer, answered, evaluated, skipped
    status = Column(String(30), default="pending", nullable=False)
    asked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    answered_at = Column(DateTime, nullable=True)

    session = relationship("InterviewSession", back_populates="turns")

    __table_args__ = (
        UniqueConstraint("session_id", "sequence_number", name="uq_session_turn_sequence"),
    )


class InterviewEvaluation(Base):
    """
    Final evaluation report with rubric scores, evidence breakdown, and
    Teach-After-Interview learning materials.
    """
    __tablename__ = "interview_evaluations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    session_id = Column(String(64), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    rubric_version = Column(String(20), default="1.0", nullable=False)
    # Evaluation Status: not_started, generating, completed, failed
    status = Column(String(30), default="not_started", nullable=False)

    overall_score = Column(Float, nullable=False)
    dimension_scores = Column(Text, nullable=False) # JSON
    summary_verdict = Column(Text, nullable=False)
    evidence_by_category = Column(Text, nullable=False) # JSON
    key_strengths = Column(Text, nullable=False) # JSON
    knowledge_gaps = Column(Text, nullable=False) # JSON
    study_roadmap = Column(Text, nullable=False) # JSON
    teach_after_feedback = Column(Text, nullable=False) # JSON
    full_report_markdown = Column(Text, nullable=False)

    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("InterviewSession", back_populates="evaluation")


class IdempotencyRecord(Base):
    """
    Durable idempotency table for safe retries and preventing duplicate submissions.
    """
    __tablename__ = "idempotency_records"

    key = Column(String(128), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(64), nullable=True, index=True)
    request_hash = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="in_progress") # "in_progress", "completed", "failed"
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_idempotency_key"),
    )




