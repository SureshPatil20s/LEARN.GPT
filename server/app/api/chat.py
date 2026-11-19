from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import json

from server.app.db.session import get_db
from server.app.models.entities import User, Conversation, Message, ImageGenerationLog, Document, DocumentChunk, Memory
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
from server.app.services.web_search import build_web_context
from server.app.core.config import settings

router = APIRouter(tags=["Chat & Conversations"])


# ---------------------------------------------------------------------------
# Intelligent Title Generation Helper
# ---------------------------------------------------------------------------

async def _generate_title(user_message: str, assistant_preview: str, llm) -> str:
    """
    Generates a concise 3–7 word chat title using the LLM.
    Falls back to a truncated user message snippet on any error.
    """
    fallback = (user_message[:40] + "...") if len(user_message) > 40 else user_message

    title_messages = [
        {
            "role": "system",
            "content": (
                "You generate concise chat titles. "
                "Respond with ONLY the title, no quotes, no punctuation at end. 3-7 words max."
            ),
        },
        {
            "role": "user",
            "content": (
                f'Conversation: "{user_message[:200]}"\n'
                f'Assistant replied about: "{assistant_preview[:100]}"\n'
                "Generate title:"
            ),
        },
    ]

    try:
        chunks = []
        async for chunk in llm.stream_chat_completion(
            messages=title_messages,
            model=None,   # groq auto fallback
            temperature=0.4,
            max_tokens=20,
        ):
            chunks.append(chunk)
        title = "".join(chunks).strip().strip('"\'').rstrip(".,;!?")
        if not title or len(title) > 60:
            return fallback
        return title
    except Exception:
        return fallback


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
        model=model_name,
        system_prompt=conv_in.system_prompt,
        persona_id=conv_in.persona_id
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


@router.patch("/conversations/{conversation_id}/generate-title")
async def regenerate_conversation_title(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Regenerates an intelligent title for a conversation using the LLM.
    Does not regenerate if the conversation already has more than 4 messages
    (considered established — user may have renamed it deliberately).
    """
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_count = db.query(Message).filter(Message.conversation_id == conversation_id).count()
    if msg_count > 4:
        return {"title": conv.title, "regenerated": False, "reason": "Conversation already established (> 4 messages)"}

    # Gather first user and assistant messages for context
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).limit(4).all()

    user_message = next((m.content for m in messages if m.role == "user"), "")
    assistant_preview = next((m.content for m in messages if m.role == "assistant"), "")

    if not user_message:
        return {"title": conv.title, "regenerated": False, "reason": "No user message found"}

    generated_title = await _generate_title(
        user_message=user_message,
        assistant_preview=assistant_preview[:200],
        llm=hosted_llm,
    )
    conv.title = generated_title
    db.commit()
    return {"title": generated_title, "regenerated": True}


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

    # 0. Enforce Daily Chat Request Limit (Strictly 20 chat requests per user per day)
    today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_requests_count = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "user",
        Message.created_at >= today_start
    ).count()

    if today_requests_count >= settings.DAILY_CHAT_REQUEST_LIMIT:
        limit_msg = (
            f"⚠️ **Daily Chat Request Limit Reached ({settings.DAILY_CHAT_REQUEST_LIMIT}/{settings.DAILY_CHAT_REQUEST_LIMIT})**\n\n"
            f"You have used your maximum daily allocation of **{settings.DAILY_CHAT_REQUEST_LIMIT} chat queries** for today.\n\n"
            f"- **Daily Allowance:** {settings.DAILY_CHAT_REQUEST_LIMIT} requests / user\n"
            f"- **Used Today:** {today_requests_count} / {settings.DAILY_CHAT_REQUEST_LIMIT}\n"
            f"- **Reset Schedule:** Midnight UTC (00:00 UTC)\n\n"
            f"💡 *To ensure fair resource distribution across all {settings.MAX_TOTAL_USERS} users, limits reset every 24 hours. "
            f"Please return tomorrow for a fresh batch of {settings.DAILY_CHAT_REQUEST_LIMIT} AI requests!*"
        )

        async def limit_generator():
            yield f"data: {json.dumps({'delta': limit_msg})}\n\n"
            asst_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=limit_msg,
                model=conv.model,
                sources=None
            )
            db.add(asst_msg)
            db.commit()
            yield "data: [DONE]\n\n"

        return StreamingResponse(limit_generator(), media_type="text/event-stream")

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

    # Auto-generate title if this is the first turn (using snippet fallback; full LLM title generated post-stream)
    msg_count = db.query(Message).filter(Message.conversation_id == conversation_id).count()

    # 2. Check RAG Context (Runs if use_rag is True OR if an attached file/document is detected)
    rag_context = ""
    sources_list = []
    sources_json = None

    # Determine attached filename: from request schema or extracted from content tags
    import re
    effective_filename = msg_in.attached_filename
    if not effective_filename:
        match = re.search(r'\[Attached Document:\s*([^\]]+)\]', msg_in.content)
        if match:
            effective_filename = match.group(1).strip()

    should_process_rag = bool(msg_in.use_rag or effective_filename)

    if should_process_rag:
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
            # 1. First look for a document attached to this specific conversation
            target_doc = db.query(Document).filter(
                Document.user_id == current_user.id,
                Document.conversation_id == conversation_id,
                Document.filename.ilike(f"%{effective_filename}%")
            ).order_by(Document.created_at.desc()).first()
            # 2. If not found, look across global documents
            if not target_doc:
                target_doc = db.query(Document).filter(
                    Document.user_id == current_user.id,
                    Document.filename.ilike(f"%{effective_filename}%")
                ).order_by(Document.created_at.desc()).first()
        elif is_generic_doc_query:
            # First check for any document attached to this conversation
            target_doc = db.query(Document).filter(
                Document.user_id == current_user.id,
                Document.conversation_id == conversation_id
            ).order_by(Document.created_at.desc()).first()
            # If none attached to this conversation, default to latest global document
            if not target_doc:
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
                for c in doc_chunks:
                    context_blocks.append(
                        f"[Document: {target_doc.filename}, Page {c.page_number}]:\n{c.content}"
                    )
                rag_context = "\n\n".join(context_blocks)

                # Return clean, consolidated citations by grouping unique pages
                pages = sorted(list(set(c.page_number for c in doc_chunks if c.page_number)))
                pages_str = f"Pages {pages[0]}–{pages[-1]}" if len(pages) > 1 else f"Page {pages[0]}" if pages else "Document"
                sources_list = [{
                    "filename": target_doc.filename,
                    "page": pages_str,
                    "page_number": pages[0] if pages else 1,
                    "similarity": 100.0,
                    "score": 1.0,
                    "snippet": f"{target_doc.filename} ({len(doc_chunks)} sections, {pages_str})"
                }]
                sources_json = json.dumps(sources_list, ensure_ascii=False)

        # If not satisfied by target_doc, perform semantic hybrid vector search
        if not rag_context and msg_in.use_rag:
            rag_context, sources_list = rag_service.search_user_documents(
                db, current_user.id, search_query, top_k=12
            )
            if sources_list:
                for s in sources_list:
                    s["score"] = s.get("similarity", 100.0) / 100.0
                    s["page_number"] = s.get("page", 1)
                sources_json = json.dumps(sources_list, ensure_ascii=False)

    # 3. Assemble Prompt Messages History
    history = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()
    # Prioritize conversation's custom persona/character system prompt over general user setting
    system_text = conv.system_prompt or current_user.system_prompt or "You are LEARN.GPT, a knowledgeable, concise, and helpful AI assistant."
    if msg_in.system_prompt and msg_in.system_prompt.strip():
        system_text = f"{msg_in.system_prompt.strip()}\n\n{system_text}"

    # 3a. Inject Persistent Cross-Chat Memory (if enabled)
    if msg_in.use_memory:
        active_memories = db.query(Memory).filter(
            Memory.user_id == current_user.id,
            Memory.is_active == True
        ).order_by(Memory.created_at.desc()).limit(15).all()

        if active_memories:
            mem_items = "\n".join(f"- {m.content}" for m in active_memories)
            system_text += (
                f"\n\n[PERSISTENT CROSS-CHAT MEMORY & USER CONTEXT]:\n{mem_items}\n"
                "(INSTRUCTION: The user has set these persistent facts, preferences, and context across all their conversations. "
                "Respect and adapt your style, format, and answers accordingly.)"
            )

    # 3b. Real-Time Web Walkthrough & Search Activity
    web_context, web_sources = await build_web_context(msg_in.content, use_web_search=bool(msg_in.use_web_search))
    if web_context:
        system_text += f"\n\n{web_context}"
        for ws in web_sources:
            sources_list.append({
                "filename": ws.get("title") or ws.get("url", "Web"),
                "page": "Web",
                "page_number": 1,
                "similarity": 98.0,
                "score": 0.98,
                "snippet": ws.get("snippet") or ws.get("url", "")
            })
        if sources_list and not sources_json:
            sources_json = json.dumps(sources_list, ensure_ascii=False)

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
        if m.content and m.content.strip():
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

        if today_count >= settings.DAILY_IMAGE_REQUEST_LIMIT:
            limit_msg = (
                f"⚠️ **Daily Image Generation Limit Reached ({settings.DAILY_IMAGE_REQUEST_LIMIT}/{settings.DAILY_IMAGE_REQUEST_LIMIT})**\n\n"
                f"You have used your maximum allowance of **{settings.DAILY_IMAGE_REQUEST_LIMIT} AI image generations** for today.\n\n"
                f"- **Daily Quota:** {settings.DAILY_IMAGE_REQUEST_LIMIT} images / user\n"
                f"- **Used Today:** {today_count} / {settings.DAILY_IMAGE_REQUEST_LIMIT}\n"
                "- **Quota Reset:** Midnight UTC (00:00 UTC)\n\n"
                "💡 *You can continue text conversations with our language models, "
                f"or return tomorrow for {settings.DAILY_IMAGE_REQUEST_LIMIT} fresh image generation credits!*"
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
            temperature=msg_in.temperature if msg_in.temperature is not None else (current_user.temperature or 0.7),
            image_data=msg_in.image_data or None
        ):
            full_content.append(chunk)
            # Send text delta
            yield f"data: {json.dumps({'delta': chunk})}\n\n"

        complete_response = "".join(full_content).strip()
        if not complete_response:
            fallback_note = "⚠️ No response was received from the upstream AI provider. Please try sending your query again or switch to another model."
            yield f"data: {json.dumps({'delta': fallback_note})}\n\n"
            complete_response = fallback_note

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

        # Intelligent title generation: replace snippet title after first exchange
        if msg_count <= 2:
            try:
                generated_title = await _generate_title(
                    user_message=msg_in.content,
                    assistant_preview=complete_response[:200],
                    llm=hosted_llm,
                )
                # Reload conv to avoid stale state
                fresh_conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
                if fresh_conv:
                    fresh_conv.title = generated_title
                    db.commit()
            except Exception:
                pass  # Fallback title already set above; keep it

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


@router.post("/conversations/{conversation_id}/upload-document")
async def upload_document_to_conversation(
    conversation_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads and indexes a document attached to a specific conversation.
    Accepts: PDF, DOCX, TXT, CSV, JSON via multipart/form-data.
    Returns: document_id, filename, file_type, file_size, total_chunks, status.
    """
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    from server.app.api.documents import upload_document
    doc = await upload_document(
        file=file,
        conversation_id=conversation_id,
        db=db,
        current_user=current_user
    )
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "total_chunks": doc.total_chunks,
        "status": "ready"
    }
