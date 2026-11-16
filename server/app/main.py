"""
FastAPI Main Application Entry Point for LEARN.GPT Platform.
- Configures CORS for Next.js frontend
- Registers Authentication, Chat & Document routers
- Auto-initializes database tables
- Exposes model catalog and health checks
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from server.app.core.config import settings
from server.app.db.session import engine, Base
from server.app.api.auth import router as auth_router
from server.app.api.chat import router as chat_router
from server.app.api.documents import router as doc_router
from server.app.api.voice import router as voice_router
from server.app.api.personas_prompts import router as personas_prompts_router
from server.app.api.memory import router as memory_router
from server.app.api.interviews import router as interviews_router

# In development/local SQLite, initialize tables if needed.
# In production, schema migrations are strictly managed via Alembic (alembic upgrade head).
if settings.ENVIRONMENT.lower() != "production" and not os.getenv("RENDER"):
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-user ChatGPT-style Platform powered by FastAPI and Hosted Groq LLMs",
    version="3.0.0"
)

# Configure CORS: restricted to exact configured origins in production, with localhost in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(doc_router, prefix=settings.API_V1_STR)
app.include_router(voice_router, prefix=settings.API_V1_STR)
app.include_router(personas_prompts_router, prefix=settings.API_V1_STR)
app.include_router(memory_router, prefix=settings.API_V1_STR)
app.include_router(interviews_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health_check():
    """Simple public health check endpoint."""
    return {"status": "ok"}


@app.get(f"{settings.API_V1_STR}/models")
def list_available_models():
    """Returns available hosted models for the model picker."""
    return settings.AVAILABLE_MODELS


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.app.main:app", host="0.0.0.0", port=8000, reload=True)

