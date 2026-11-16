"""
API Endpoints for Custom Personas & Prompt Library with Variables.
- List built-in & custom characters / agent personas
- Create, update, delete custom personas
- List prompt templates with extracted {variable} fields
- Create, update, delete custom prompt templates
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json
import re

from server.app.db.session import get_db
from server.app.models.entities import User, Persona, PromptTemplate
from server.app.schemas.schemas import (
    PersonaCreate,
    PersonaResponse,
    PromptTemplateCreate,
    PromptTemplateResponse
)
from server.app.core.security import get_current_user

router = APIRouter(tags=["Personas & Prompt Library"])


# Default Built-in Personas Seed Data
DEFAULT_PERSONAS = [
    {
        "name": "General Assistant",
        "avatar": "🤖",
        "description": "Helpful, balanced, and direct AI assistant for all general queries",
        "system_prompt": "You are LEARN.GPT, a knowledgeable, concise, and helpful AI assistant.",
        "is_builtin": True
    },
    {
        "name": "Senior Full-Stack Architect",
        "avatar": "💻",
        "description": "Writes production-grade, secure, modern code with best practices",
        "system_prompt": "You are a Senior Full-Stack Architect with 15+ years of experience. Write clean, modular, production-ready code with concise technical explanations, security awareness, and zero fluff.",
        "is_builtin": True
    },
    {
        "name": "Academic Researcher & Socratic Tutor",
        "avatar": "🎓",
        "description": "Explains complex ideas step-by-step using analogies, first principles, and Socratic questioning",
        "system_prompt": "You are a distinguished university professor and Socratic mentor. Break down complex scientific and technical topics into intuitive first principles, analogies, and interactive follow-up questions.",
        "is_builtin": True
    },
    {
        "name": "Cybersecurity & Red Team Specialist",
        "avatar": "🛡️",
        "description": "Threat modeling, vulnerability analysis, and zero-trust security",
        "system_prompt": "You are a Principal Cyber Security Specialist and Penetration Tester. Explain system vulnerabilities, defensive hardening, OWASP Top 10 mitigations, and threat modeling with rigorous technical accuracy.",
        "is_builtin": True
    },
    {
        "name": "Creative Copywriter & Storyteller",
        "avatar": "✍️",
        "description": "Engaging narratives, persuasive marketing copy, and creative storytelling",
        "system_prompt": "You are a world-class creative writer, brand copywriter, and storyteller. Craft vivid, compelling, and memorable prose tailored precisely to the requested audience and emotional tone.",
        "is_builtin": True
    }
]

# Default Built-in Prompt Templates with Variables
DEFAULT_PROMPTS = [
    {
        "title": "Explain Like I'm Five",
        "category": "Education",
        "description": "Simplifies any technical or abstract topic using simple everyday analogies",
        "template": "Please explain the concept of {topic} in a {tone} tone. Use simple everyday analogies suitable for {audience}.",
        "variables": json.dumps(["topic", "tone", "audience"]),
        "is_builtin": True
    },
    {
        "title": "Code Review & Security Audit",
        "category": "Development",
        "description": "Performs an exhaustive code review focusing on performance, bugs, and security",
        "template": "Perform a rigorous code review of this {language} implementation:\n\n```{language}\n{code}\n```\n\nFocus specifically on {focus_areas} and output actionable improvements in a {tone} tone.",
        "variables": json.dumps(["language", "code", "focus_areas", "tone"]),
        "is_builtin": True
    },
    {
        "title": "Executive Summary & Key Takeaways",
        "category": "Business",
        "description": "Condenses lengthy content into a sharp bulleted executive brief",
        "template": "Analyze the following document or topic: {topic}.\n\nProduce an executive summary structured as:\n1. 3-Bullet Executive Overview\n2. Key Decisions & Strategic Implications\n3. Action Items\n\nTone: {tone}.",
        "variables": json.dumps(["topic", "tone"]),
        "is_builtin": True
    },
    {
        "title": "Socratic Debate & Counterarguments",
        "category": "Critical Thinking",
        "description": "Constructs balanced pro/con arguments and stress-tests premises",
        "template": "Take a balanced critical perspective on: \"{topic}\".\n\nOutline the strongest steel-manned arguments from both sides, identifying hidden assumptions and ethical considerations with a {tone} analytical style.",
        "variables": json.dumps(["topic", "tone"]),
        "is_builtin": True
    }
]


def _ensure_builtins(db: Session):
    """Seed default built-in personas and prompt templates if not present."""
    if db.query(Persona).filter(Persona.is_builtin.is_(True)).count() == 0:
        for p in DEFAULT_PERSONAS:
            db.add(Persona(**p))
        db.commit()

    if db.query(PromptTemplate).filter(PromptTemplate.is_builtin.is_(True)).count() == 0:
        for pt in DEFAULT_PROMPTS:
            db.add(PromptTemplate(**pt))
        db.commit()


# ---------------------------------------------------------------------------
# Personas API
# ---------------------------------------------------------------------------

@router.get("/personas", response_model=List[PersonaResponse])
def get_personas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns available built-in personas and user's custom saved characters."""
    _ensure_builtins(db)
    personas = db.query(Persona).filter(
        (Persona.is_builtin.is_(True)) | (Persona.user_id == current_user.id)
    ).order_by(Persona.is_builtin.desc(), Persona.created_at.desc()).all()
    return personas


@router.post("/personas", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
def create_persona(
    persona_in: PersonaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Saves a custom character / agent persona for the current user."""
    persona = Persona(
        user_id=current_user.id,
        name=persona_in.name.strip(),
        avatar=persona_in.avatar or "🤖",
        description=persona_in.description.strip() if persona_in.description else None,
        system_prompt=persona_in.system_prompt.strip(),
        is_builtin=False
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_persona(
    persona_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a custom user persona (built-ins cannot be deleted)."""
    persona = db.query(Persona).filter(
        Persona.id == persona_id,
        Persona.user_id == current_user.id,
        Persona.is_builtin.is_(False)
    ).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found or cannot delete built-in")
    db.delete(persona)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Prompt Templates API
# ---------------------------------------------------------------------------

@router.get("/prompts", response_model=List[PromptTemplateResponse])
def get_prompt_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns built-in and user-created prompt templates with variables."""
    _ensure_builtins(db)
    templates = db.query(PromptTemplate).filter(
        (PromptTemplate.is_builtin.is_(True)) | (PromptTemplate.user_id == current_user.id)
    ).order_by(PromptTemplate.is_builtin.desc(), PromptTemplate.created_at.desc()).all()

    # Parse JSON variables for response
    results = []
    for t in templates:
        vars_list = []
        if t.variables:
            try:
                vars_list = json.loads(t.variables)
            except Exception:
                vars_list = re.findall(r'\{([a-zA-Z0-9_]+)\}', t.template)
        else:
            vars_list = re.findall(r'\{([a-zA-Z0-9_]+)\}', t.template)

        results.append(PromptTemplateResponse(
            id=t.id,
            user_id=t.user_id,
            title=t.title,
            category=t.category,
            description=t.description,
            template=t.template,
            variables=vars_list,
            is_builtin=bool(t.is_builtin),
            created_at=t.created_at
        ))
    return results


@router.post("/prompts", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_prompt_template(
    prompt_in: PromptTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new prompt template; auto-extracts variable tokens like {topic} or {tone}."""
    # Automatically parse variable keys from {key} in template
    extracted_vars = re.findall(r'\{([a-zA-Z0-9_]+)\}', prompt_in.template)
    # Deduplicate while preserving order
    unique_vars = list(dict.fromkeys(extracted_vars))

    pt = PromptTemplate(
        user_id=current_user.id,
        title=prompt_in.title.strip(),
        category=prompt_in.category or "General",
        description=prompt_in.description.strip() if prompt_in.description else None,
        template=prompt_in.template.strip(),
        variables=json.dumps(unique_vars),
        is_builtin=False
    )
    db.add(pt)
    db.commit()
    db.refresh(pt)

    return PromptTemplateResponse(
        id=pt.id,
        user_id=pt.user_id,
        title=pt.title,
        category=pt.category,
        description=pt.description,
        template=pt.template,
        variables=unique_vars,
        is_builtin=False,
        created_at=pt.created_at
    )


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt_template(
    prompt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a custom user prompt template (built-ins cannot be deleted)."""
    pt = db.query(PromptTemplate).filter(
        PromptTemplate.id == prompt_id,
        PromptTemplate.user_id == current_user.id,
        PromptTemplate.is_builtin.is_(False)
    ).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Prompt template not found or cannot delete built-in")
    db.delete(pt)
    db.commit()
    return None
