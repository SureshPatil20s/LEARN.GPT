"""
Documents & Knowledge Base API:
- Upload files (PDF, DOCX, TXT, CSV, JSON)
- Auto-extract semantic chunks with page numbering
- List user documents
- Delete document
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from server.app.db.session import get_db
from server.app.models.entities import User, Document, DocumentChunk
from server.app.schemas.schemas import DocumentResponse
from server.app.core.security import get_current_user
from server.app.services.rag_service import rag_service

router = APIRouter(prefix="/documents", tags=["Documents & RAG"])


@router.get("", response_model=List[DocumentResponse])
def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists global knowledge base documents for the authenticated user.
    Excludes ephemeral/chat-specific attached documents.
    """
    docs = db.query(Document).filter(
        Document.user_id == current_user.id,
        Document.conversation_id.is_(None)
    ).order_by(Document.created_at.desc()).all()
    for d in docs:
        setattr(d, "chunk_count", d.total_chunks)
    return docs


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads and indexes a document (PDF, DOCX, TXT, CSV, JSON).
    If conversation_id is provided, marks it as a chat-attached document.
    """
    from sqlalchemy import func
    from server.app.core.config import settings

    file_bytes = await file.read()
    filename = file.filename or "uploaded_file.txt"
    ext = filename.split(".")[-1].lower() if "." in filename else "txt"

    allowed_exts = {"pdf", "docx", "txt", "csv", "json"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type .{ext}. Allowed: PDF, DOCX, TXT, CSV, JSON"
        )

    # 1. Check individual file size limit
    if len(file_bytes) > settings.MAX_FILE_SIZE_BYTES:
        max_mb = settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {max_mb} MB."
        )

    # 2. Check total user storage capacity (quota designed for 20+ users)
    user_usage = db.query(func.coalesce(func.sum(Document.file_size), 0)).filter(
        Document.user_id == current_user.id
    ).scalar() or 0

    if user_usage + len(file_bytes) > settings.MAX_USER_STORAGE_BYTES:
        max_user_mb = settings.MAX_USER_STORAGE_BYTES // (1024 * 1024)
        used_mb = user_usage / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Storage quota exceeded. Your current usage is {used_mb:.1f} MB of {max_user_mb} MB limit."
        )

    # 3. Check document count limit for global knowledge base files
    if conversation_id is None:
        global_doc_count = db.query(Document).filter(
            Document.user_id == current_user.id,
            Document.conversation_id.is_(None)
        ).count()
        if global_doc_count >= settings.MAX_USER_DOCS_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document limit reached ({settings.MAX_USER_DOCS_COUNT} files). Please delete unused files from your RAG Knowledge Base."
            )

    chunks_data = rag_service.extract_text_and_chunks(file_bytes, filename)
    max_pages = max([c.get("page_number", 1) for c in chunks_data], default=1)

    doc = Document(
        user_id=current_user.id,
        conversation_id=conversation_id,
        filename=filename,
        file_type=ext,
        file_size=len(file_bytes),
        total_pages=max_pages,
        total_chunks=len(chunks_data)
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    chunk_objects = []
    for item in chunks_data:
        chunk = DocumentChunk(
            document_id=doc.id,
            page_number=item.get("page_number", 1),
            chunk_index=item.get("chunk_index", 0),
            content=item.get("content", "")
        )
        db.add(chunk)
        chunk_objects.append(chunk)
    db.commit()

    # Generate and persist vector embeddings for all chunks (real semantic RAG)
    # Uses sentence-transformers all-MiniLM-L6-v2 locally — no API key needed
    try:
        rag_service.embed_chunks(db, chunk_objects)
    except Exception as e:
        # Non-fatal: upload still succeeds; search falls back to on-the-fly embedding
        import logging
        logging.warning(f"Embedding generation failed for {filename}: {e}")

    setattr(doc, "chunk_count", doc.total_chunks)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a document and all its indexed chunks."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)
    db.commit()
    return None

