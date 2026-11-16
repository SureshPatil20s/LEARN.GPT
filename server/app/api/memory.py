"""
Persistent Cross-Chat Memory Router:
Enables storing, retrieving, and toggling user memories/facts that persist across conversations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from server.app.db.session import get_db
from server.app.models.entities import Memory, User
from server.app.api.auth import get_current_user

router = APIRouter(prefix="/memory", tags=["Cross-Chat Memory"])


class MemoryCreate(BaseModel):
    content: str
    category: Optional[str] = "general"


class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class MemoryResponse(BaseModel):
    id: str
    user_id: str
    content: str
    category: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[MemoryResponse])
def get_user_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all persistent memories for current user."""
    memories = (
        db.query(Memory)
        .filter(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
        .all()
    )
    return memories


@router.post("", response_model=MemoryResponse)
def create_memory(
    data: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new memory fact."""
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Memory content cannot be empty")

    memory = Memory(
        user_id=current_user.id,
        content=data.content.strip(),
        category=data.category or "general",
        is_active=True
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


@router.put("/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: str,
    data: MemoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing memory item."""
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.user_id == current_user.id)
        .first()
    )
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    if data.content is not None and data.content.strip():
        memory.content = data.content.strip()
    if data.category is not None:
        memory.category = data.category
    if data.is_active is not None:
        memory.is_active = data.is_active

    db.commit()
    db.refresh(memory)
    return memory


@router.patch("/{memory_id}/toggle", response_model=MemoryResponse)
def toggle_memory(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle a specific memory on/off."""
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.user_id == current_user.id)
        .first()
    )
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    memory.is_active = not memory.is_active
    db.commit()
    db.refresh(memory)
    return memory


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific memory."""
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.user_id == current_user.id)
        .first()
    )
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    db.delete(memory)
    db.commit()
    return {"message": "Memory deleted successfully"}


@router.delete("")
def clear_all_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all memories for the current user."""
    db.query(Memory).filter(Memory.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All memories cleared successfully"}
