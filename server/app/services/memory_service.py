"""
Automatic Conversational Memory Extraction & Summarization Engine.
Extracts personal details, user preferences, goals, and choices from user interactions.
"""
from __future__ import annotations

import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from server.app.models.entities import Memory, Message, Conversation
from server.app.services.llm_service import hosted_llm

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = (
    "You are an expert AI personalization engine for LEARN.GPT.\n"
    "Your job is to analyze user interactions and extract persistent user context to remember across future chats.\n\n"
    "Look specifically for:\n"
    "1. PERSONAL DETAILS: Role, field of study, year/degree, company, current technical projects, background (e.g. 'User is a 3rd-year CS student', 'User is building an X-Ray ML research model').\n"
    "2. PREFERENCES: Preferred programming languages, frameworks, explanation style (e.g. 'Prefers TypeScript and Python', 'Prefers concise bullet points with minimal preamble').\n"
    "3. GOALS: Exam preparation, job interviews, learning targets, milestones (e.g. 'Preparing for frontend developer interviews', 'Wants to master dynamic programming').\n"
    "4. CHOICES: Concrete architectural, tech stack, or design decisions made by the user.\n\n"
    "STRICT RULES:\n"
    "- ONLY extract persistent facts explicitly stated or strongly implied about the USER.\n"
    "- NEVER extract transient questions (e.g. 'what is aiml', 'how to write a loop', 'debug this error').\n"
    "- NEVER extract assistant explanations or general domain knowledge.\n"
    "- Formulate each fact as a concise 3rd-person declarative statement (e.g. 'User prefers...', 'User is studying...').\n"
    "- Respond ONLY with a valid JSON array of objects: [{\"content\": \"...\", \"category\": \"personal\" | \"preference\" | \"goal\" | \"choice\"}]\n"
    "- If nothing persistent is shared in this exchange, return an empty JSON array: []"
)


def _normalize_text(text: str) -> str:
    """Lowercase and strip punctuation for duplicate detection."""
    return re.sub(r"[^\w\s]", "", text.lower()).strip()


def _is_duplicate_fact(new_content: str, existing_contents: List[str]) -> bool:
    """Checks if new memory is identical or substantially overlapping with existing ones."""
    norm_new = _normalize_text(new_content)
    if not norm_new:
        return True

    new_words = set(norm_new.split())
    if not new_words:
        return True

    for ext in existing_contents:
        norm_ext = _normalize_text(ext)
        if norm_new == norm_ext or norm_new in norm_ext or norm_ext in norm_new:
            return True
        ext_words = set(norm_ext.split())
        if ext_words:
            overlap = len(new_words.intersection(ext_words)) / max(len(new_words), 1)
            if overlap >= 0.8:
                return True
    return False


async def extract_and_store_memories_from_exchange(
    user_message: str,
    assistant_response: str,
    user_id: str,
    db: Session,
    llm=hosted_llm
) -> List[Memory]:
    """
    Analyzes a user-assistant exchange and automatically extracts & persists
    any personal details, preferences, goals, or choices.
    """
    if not user_message or len(user_message.strip()) < 10:
        return []

    # Filter out obvious quick commands or greetings
    stripped = user_message.strip().lower()
    if stripped in {"hi", "hello", "hey", "test", "clear", "help"}:
        return []

    messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f'USER MESSAGE:\n"{user_message.strip()}"\n\n'
                f'ASSISTANT CONTEXT PREVIEW:\n"{assistant_response[:200].strip()}"\n\n'
                "Extract any personal details, preferences, goals, or choices as a JSON array (or []):"
            )
        }
    ]

    try:
        chunks = []
        async for chunk in llm.stream_chat_completion(
            messages=messages,
            model=None,
            temperature=0.2,
            max_tokens=250,
        ):
            chunks.append(chunk)

        raw_output = "".join(chunks).strip()
        # Clean markdown code blocks if model wrapped JSON
        if "```" in raw_output:
            raw_output = re.sub(r"^```(?:json)?\s*", "", raw_output)
            raw_output = re.sub(r"\s*```$", "", raw_output)
        raw_output = raw_output.strip()

        start_idx = raw_output.find("[")
        end_idx = raw_output.rfind("]")
        if start_idx == -1 or end_idx == -1 or end_idx < start_idx:
            return []

        parsed_items = json.loads(raw_output[start_idx:end_idx + 1])
        if not isinstance(parsed_items, list):
            return []

        # Fetch existing user memories to avoid duplication
        existing_memories = db.query(Memory).filter(Memory.user_id == user_id).all()
        existing_contents = [m.content for m in existing_memories]

        added_memories: List[Memory] = []
        for item in parsed_items:
            if not isinstance(item, dict):
                continue
            content = (item.get("content") or "").strip()
            category = (item.get("category") or "general").strip().lower()
            if category not in {"personal", "preference", "goal", "choice"}:
                category = "preference"

            if content and not _is_duplicate_fact(content, existing_contents):
                new_mem = Memory(
                    user_id=user_id,
                    content=content,
                    category=category,
                    is_active=True
                )
                db.add(new_mem)
                added_memories.append(new_mem)
                existing_contents.append(content)

        if added_memories:
            db.commit()
            for mem in added_memories:
                db.refresh(mem)
            logger.info(f"Auto-saved {len(added_memories)} new memory items for user {user_id}")

        return added_memories

    except Exception as e:
        logger.warning(f"Error in automatic conversational memory extraction: {e}")
        return []


async def summarize_recent_conversations_to_memories(
    user_id: str,
    db: Session,
    limit_convs: int = 5,
    llm=hosted_llm
) -> List[Memory]:
    """
    On-demand scanner that inspects recent conversations and extracts personal details,
    preferences, and goals into the persistent memories table.
    """
    # Fetch recent conversations for user
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit_convs)
        .all()
    )

    if not convs:
        return []

    # Collect recent user messages across these conversations
    conv_ids = [c.id for c in convs]
    messages = (
        db.query(Message)
        .filter(Message.conversation_id.in_(conv_ids), Message.sender == "user")
        .order_by(Message.created_at.desc())
        .limit(20)
        .all()
    )

    if not messages:
        return []

    user_texts = "\n---\n".join(m.content[:300] for m in reversed(messages) if m.content and len(m.content.strip()) > 10)
    if not user_texts.strip():
        return []

    prompt_messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Review the following recent user inputs across multiple chat sessions:\n\n"
                f"{user_texts}\n\n"
                "Extract all personal details, preferences, goals, and choices into a JSON array:"
            )
        }
    ]

    try:
        chunks = []
        async for chunk in llm.stream_chat_completion(
            messages=prompt_messages,
            model=None,
            temperature=0.2,
            max_tokens=400,
        ):
            chunks.append(chunk)

        raw_output = "".join(chunks).strip()
        if "```" in raw_output:
            raw_output = re.sub(r"^```(?:json)?\s*", "", raw_output)
            raw_output = re.sub(r"\s*```$", "", raw_output)
        raw_output = raw_output.strip()

        start_idx = raw_output.find("[")
        end_idx = raw_output.rfind("]")
        if start_idx == -1 or end_idx == -1:
            return []

        parsed_items = json.loads(raw_output[start_idx:end_idx + 1])
        if not isinstance(parsed_items, list):
            return []

        existing_memories = db.query(Memory).filter(Memory.user_id == user_id).all()
        existing_contents = [m.content for m in existing_memories]

        added_memories: List[Memory] = []
        for item in parsed_items:
            if not isinstance(item, dict):
                continue
            content = (item.get("content") or "").strip()
            category = (item.get("category") or "general").strip().lower()
            if category not in {"personal", "preference", "goal", "choice"}:
                category = "personal"

            if content and not _is_duplicate_fact(content, existing_contents):
                new_mem = Memory(
                    user_id=user_id,
                    content=content,
                    category=category,
                    is_active=True
                )
                db.add(new_mem)
                added_memories.append(new_mem)
                existing_contents.append(content)

        if added_memories:
            db.commit()
            for mem in added_memories:
                db.refresh(mem)

        return added_memories

    except Exception as e:
        logger.warning(f"Error in on-demand memory summarization: {e}")
        return []


async def background_memory_extractor(
    user_message: str,
    assistant_response: str,
    user_id: str
):
    """
    Safely runs conversational memory extraction in an isolated background task
    with its own database session.
    """
    from server.app.db.session import SessionLocal
    bg_db = SessionLocal()
    try:
        await extract_and_store_memories_from_exchange(
            user_message=user_message,
            assistant_response=assistant_response,
            user_id=user_id,
            db=bg_db,
            llm=hosted_llm
        )
    except Exception as e:
        logger.warning(f"Background memory extractor failed: {e}")
    finally:
        bg_db.close()

