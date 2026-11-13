"""
Chat & Conversation API Endpoints:
- List conversations (chronological + search)
- Create new conversation
- Get conversation with full message history
- Rename conversation & toggle pin
- Delete conversation
- Real-time streaming AI response (SSE)
- Message feedback (thumbs up/down)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import json

from server.app.db.session import get_db
from server.app.models.entities import User, Conversation, Message, ImageGenerationLog, Document, DocumentChunk
from server.app.schemas.schemas import (
    ConversationResponse,
    ConversationCreate,
    ConversationRename,
    MessageResponse,
    MessageCreate,
    MessageFeedback
)
from server.app.core.security import get_current_user
from server.app.services.llm_service import hosted_llm
from server.app.services.rag_service import rag_service
from server.app.core.config import settings

router = APIRouter(tags=["Chat & Conversations"])


@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    q: Optional[str] = Query(None, description="Search keyword in titles"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists conversations for the current user, optionally filtered by keyword."""
    # Guest users have temporary/ephemeral sessions — their chats are not persisted to sidebar history
    if current_user.provider == "guest":
        return []

    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if q and q.strip():
        query = query.filter(Conversation.title.ilike(f"%{q.strip()}%"))

    # Pinned first, then newest updated
    convs = query.order_by(Conversation.pinned.desc(), Conversation.updated_at.desc()).all()
    # Map pinned to is_pinned
    for c in convs:
        setattr(c, "is_pinned", bool(c.pinned))
    return convs


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initializes a new persistent conversation."""
    model_name = conv_in.model or current_user.default_model or settings.DEFAULT_MODEL
    title = conv_in.title or "New Chat"
    conv = Conversation(
        user_id=current_user.id,
        title=title,
        model=model_name
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    setattr(conv, "is_pinned", bool(conv.pinned))
    return conv


@router.get("/conversations/{conversation_id}")
def get_conversation_history(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full conversation details and all message history."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()

    formatted_messages = []
    for m in messages:
        sources_list = []
        if m.sources:
            try:
                sources_list = json.loads(m.sources)
            except Exception:
                sources_list = []
        
        rating_str = None
        if m.feedback == 1:
            rating_str = "like"
        elif m.feedback == -1:
            rating_str = "dislike"

        formatted_messages.append({
            "id": m.id,
            "conversation_id": m.conversation_id,
            "role": m.role,
            "content": m.content,
            "model": m.model,
            "sources": sources_list,
            "feedback": rating_str,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })

    setattr(conv, "is_pinned", bool(conv.pinned))
    return {
        "conversation": {
            "id": conv.id,
            "user_id": conv.user_id,
            "title": conv.title,
            "model": conv.model,
            "is_pinned": bool(conv.pinned),
            "pinned": bool(conv.pinned),
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        },
        "messages": formatted_messages
    }


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates title or pin status of a conversation."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if "title" in updates and updates["title"]:
        conv.title = updates["title"].strip()
    if "is_pinned" in updates:
        conv.pinned = bool(updates["is_pinned"])
    if "pinned" in updates:
        conv.pinned = bool(updates["pinned"])

    db.commit()
    db.refresh(conv)
    setattr(conv, "is_pinned", bool(conv.pinned))
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a conversation and its messages."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return None


async def _handle_message_stream(
    conversation_id: str,
    msg_in: MessageCreate,
    db: Session,
    current_user: User
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 1. Save User Message
    stored_user_content = msg_in.content
    if msg_in.attached_filename:
        stored_user_content = f"📄 **[Attached Document: {msg_in.attached_filename}]**\n\n{msg_in.content}"
    elif msg_in.image_data:
        stored_user_content = f"🖼️ **[Attached Image]**\n\n{msg_in.content or 'Please extract all text (OCR) from this image and analyze its visual content.'}"

    user_msg = Message(
        conversation_id=conversation_id,
        role="user",
        content=stored_user_content
    )
    db.add(user_msg)
    db.commit()

    # Auto-generate title if this is the first turn
    msg_count = db.query(Message).filter(Message.conversation_id == conversation_id).count()
    if msg_count <= 1:
        snippet = msg_in.content.strip()
        conv.title = snippet[:32] + "..." if len(snippet) > 32 else snippet
        db.commit()

    # 2. Check RAG Context if requested
    rag_context = ""
    sources_list = []
    sources_json = None
    if msg_in.use_rag:
        # Determine attached filename: from request schema or extracted from content tags
        effective_filename = msg_in.attached_filename
        if not effective_filename:
            import re
            match = re.search(r'\[Attached Document:\s*([^\]]+)\]', msg_in.content)
            if match:
                effective_filename = match.group(1).strip()

        # If user explicitly attached a document or mentioned a filename, prioritize it
        search_query = msg_in.content
        if effective_filename:
            search_query = f"{effective_filename} {msg_in.content}"
        
        # If query is generic like "explain attached file", look up the most recently uploaded document
        is_generic_doc_query = any(phrase in msg_in.content.lower() for phrase in [
            "attached file", "this document", "uploaded file", "this file", "explain the file",
            "explain document", "summarize document", "summarize the file", "summarize this",
            "what is in this", "what is in the file", "explain content", "explain the content",
            "explain this document", "explain this file", "explain this"
        ])

        if effective_filename:
            # Explicitly load all chunks of the attached document
            target_doc = db.query(Document).filter(
                Document.user_id == current_user.id,
                Document.filename.ilike(f"%{effective_filename}%")
            ).order_by(Document.created_at.desc()).first()
        elif is_generic_doc_query:
            # Default to the user's latest uploaded document
            target_doc = db.query(Document).filter(
                Document.user_id == current_user.id
            ).order_by(Document.created_at.desc()).first()
        else:
            target_doc = None

        if target_doc:
            doc_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == target_doc.id
            ).order_by(DocumentChunk.chunk_index.asc()).limit(20).all()

            if doc_chunks:
                context_blocks = []
                sources_list = []
                for c in doc_chunks:
                    context_blocks.append(
                        f"[Document: {target_doc.filename}, Page {c.page_number}]:\n{c.content}"
                    )
                    sources_list.append({
                        "filename": target_doc.filename,
                        "page": c.page_number,
                        "similarity": 100.0,
                        "snippet": c.content[:160] + "..." if len(c.content) > 160 else c.content
                    })
                rag_context = "\n\n".join(context_blocks)
                sources_json = json.dumps(sources_list, ensure_ascii=False)

        # If not satisfied by target_doc, perform semantic hybrid vector search
        if not rag_context:
            rag_context, sources_list = rag_service.search_user_documents(
                db, current_user.id, search_query, top_k=12
            )
            if sources_list:
                sources_json = json.dumps(sources_list, ensure_ascii=False)

    # 3. Assemble Prompt Messages History
    history = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()
    system_text = current_user.system_prompt or "You are LEARN.GPT, a knowledgeable, concise, and helpful AI assistant."
    if rag_context:
        num_docs = len(set(s["filename"] for s in sources_list))
        system_text += (
            f"\n\n[REFERENCE DOCUMENTS — {num_docs} document(s) with {len(sources_list)} relevant sections]:\n"
            f"{rag_context}\n\n"
            "GUIDELINES FOR USING REFERENCE DOCUMENTS:\n"
            "1. DOCUMENT QUESTIONS: When the user asks about specific topics, projects, assignments, or details contained in the reference documents above, use them as your primary ground truth and cite the source filename & page number.\n"
            "2. GENERAL QUESTIONS: For all general questions (such as greetings, programming & coding tasks, math, explanations of broad concepts, science, history, creative writing, advice, etc.), answer COMPREHENSIVELY, HELPINGLY, and DIRECTLY using your full general AI knowledge. Do NOT restrict yourself to the documents for questions not specifically asking about them.\n"
            "3. If the user explicitly asks for something from their uploaded documents that is not in the excerpts, let them know clearly."
        )

    llm_messages = [{"role": "system", "content": system_text}]
    for m in history[-8:]:  # Sliding window of last 8 turns
        llm_messages.append({"role": m.role, "content": m.content})

    chosen_model = msg_in.model or conv.model or current_user.default_model or settings.DEFAULT_MODEL

    # Enforce Daily Image Generation Rate Limit (Strictly 10 images per user per day)
    content_lower = msg_in.content.strip().lower()
    is_image_request = (chosen_model == "flux-image-gen") or content_lower.startswith((
        "/image", "generate image", "draw ", "create an image", "generate an image"
    ))

    if is_image_request:
        today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time()).replace(tzinfo=timezone.utc)
        today_count = db.query(ImageGenerationLog).filter(
            ImageGenerationLog.user_id == current_user.id,
            ImageGenerationLog.created_at >= today_start
        ).count()

        if today_count >= 10:
            limit_msg = (
                "⚠️ **Daily Image Generation Limit Reached (10/10)**\n\n"
                "You have used your maximum allowance of **10 AI image generations** for today.\n\n"
                "- **Daily Quota:** 10 images / user\n"
                f"- **Used Today:** {today_count} / 10\n"
                "- **Quota Reset:** Midnight UTC (00:00 UTC)\n\n"
                "💡 *You can continue unlimited text conversations with our language models (`Gemini 2.0 Flash`, `Gemini 2.5 Flash Lite`, `Qwen 3.8 Groq`), "
                "or return tomorrow for 10 fresh image generation credits!*"
            )

            async def limit_generator():
                yield f"data: {json.dumps({'delta': limit_msg})}\n\n"
                asst_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=limit_msg,
                    model=chosen_model,
                    sources=None
                )
                db.add(asst_msg)
                db.commit()
                yield "data: [DONE]\n\n"

            return StreamingResponse(limit_generator(), media_type="text/event-stream")

        # Record this image generation against user's daily quota
        db.add(ImageGenerationLog(user_id=current_user.id, prompt=msg_in.content[:500]))
        db.commit()

    # If image data is attached, the IntelligentRouter handles OCR/Vision automatically.
    # Just ensure the last user message has the right text prompt.
    if msg_in.image_data and llm_messages:
        prompt_text = msg_in.content or "Please perform OCR: read and transcribe all text from this image and analyze its visual content."
        # Keep as plain text — image_data is passed separately to the router
        llm_messages[-1] = {"role": "user", "content": prompt_text}

    # 4. Stream response generator and save assistant message upon completion
    async def sse_event_generator():
        full_content = []
        # Send sources metadata event if RAG retrieved sources
        if sources_list:
            yield f"data: {json.dumps({'sources': sources_list})}\n\n"

        async for chunk in hosted_llm.stream_chat_completion(
            messages=llm_messages,
            model=chosen_model,
            temperature=current_user.temperature or 0.7,
            image_data=msg_in.image_data or None
        ):
            full_content.append(chunk)
            # Send text delta
            yield f"data: {json.dumps({'delta': chunk})}\n\n"

        complete_response = "".join(full_content)
        # Save assistant message into DB
        asst_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=complete_response,
            model=chosen_model,
            sources=sources_json
        )
        db.add(asst_msg)
        db.commit()
        db.refresh(asst_msg)

        # Send completion
        yield "data: [DONE]\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


@router.post("/messages/stream")
async def stream_message_global(
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Streams assistant response for a given conversation_id."""
    if not msg_in.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    return await _handle_message_stream(msg_in.conversation_id, msg_in, db, current_user)


@router.post("/conversations/{conversation_id}/messages/stream")
async def stream_message_nested(
    conversation_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Streams assistant response for a nested conversation route."""
    return await _handle_message_stream(conversation_id, msg_in, db, current_user)


@router.post("/messages/{message_id}/feedback")
def set_message_feedback(
    message_id: str,
    feedback_in: MessageFeedback,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sets thumbs up/down feedback for a message."""
    msg = db.query(Message).join(Conversation).filter(
        Message.id == message_id,
        Conversation.user_id == current_user.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if feedback_in.rating:
        msg.feedback = 1 if feedback_in.rating == "like" else -1
    elif feedback_in.feedback is not None:
        msg.feedback = feedback_in.feedback

    db.commit()
    return {"status": "success", "feedback": msg.feedback}
