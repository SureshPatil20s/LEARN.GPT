"""
Server Configuration & Settings.
Supports PostgreSQL (Neon/Supabase) and SQLite fallback for seamless local/cloud dev.
Configures the Intelligent Multi-Model Router (Gemini primary, Groq Qwen fallback).
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "LEARN.GPT Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "learn_gpt_super_secret_jwt_key_2026_change_in_prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database: Defaults to local SQLite if DATABASE_URL is not set or empty, otherwise PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./data/conversations/learn_gpt_platform.db"

    # --- Primary: Google Gemini (text, vision/OCR, image generation) ---
    # Free key at: https://aistudio.google.com/apikey
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # --- Fallback: Groq (qwen/qwen3.8-27b — activates automatically on Gemini 429) ---
    # Free key at: https://console.groq.com/keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # --- Secondary image gen: HuggingFace FLUX.1-schnell (optional) ---
    # Free token at: https://huggingface.co → Settings → Access Tokens
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

    # Default model — "auto" means the IntelligentRouter picks the best model
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "auto")

    # Available models shown in the frontend model selector
    AVAILABLE_MODELS: list = [
        {
            "id": "auto",
            "name": "🤖 Auto (Gemini + Groq)",
            "provider": "Smart Router",
            "description": "Automatically uses Gemini for all tasks; Groq Qwen as fallback on rate limit",
            "is_default": True
        },
        {
            "id": "gemini-3.5-flash",
            "name": "Gemini 3.5 Flash",
            "provider": "Google AI",
            "description": "Fast, multimodal reasoning with real-world grounding"
        },
        {
            "id": "gemini-3.5-flash-lite",
            "name": "Gemini 3.5 Flash Lite",
            "provider": "Google AI",
            "description": "Ultra-fast lightweight Gemini model for rapid queries"
        },
        {
            "id": "qwen/qwen3.8-27b",
            "name": "Qwen 3.8 27B (Groq)",
            "provider": "Groq",
            "description": "Advanced reasoning & multilingual — Groq LPU speed"
        },
        {
            "id": "openai/gpt-oss-120b",
            "name": "GPT-OSS 120B (Groq)",
            "provider": "Groq",
            "description": "High-capacity open reasoning model — Groq LPU speed"
        },
        {
            "id": "flux-image-gen",
            "name": "🎨 AI Image Generator",
            "provider": "Gemini / HuggingFace / Pollinations",
            "description": "Photorealistic image generation with automatic quality fallback"
        },
        {
            "id": "gemini-vision",
            "name": "👁️ Vision & OCR (Gemini)",
            "provider": "Google AI",
            "description": "Read & extract text from images, scans, and diagrams via Gemini multimodal"
        },
    ]

    # Environment & Host Configuration
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL", "")
    ADDITIONAL_CORS_ORIGINS: Optional[str] = os.getenv("ADDITIONAL_CORS_ORIGINS", "")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    def get_cors_origins(self) -> list:
        """
        Returns exact configured allowed CORS origins.
        Localhost origins are preserved strictly for local development.
        Production requires explicit FRONTEND_URL and/or ADDITIONAL_CORS_ORIGINS.
        """
        origins = []
        if self.ENVIRONMENT.lower() != "production":
            origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

        if self.FRONTEND_URL and self.FRONTEND_URL.strip():
            origins.append(self.FRONTEND_URL.strip().rstrip("/"))

        if self.ADDITIONAL_CORS_ORIGINS and self.ADDITIONAL_CORS_ORIGINS.strip():
            for item in self.ADDITIONAL_CORS_ORIGINS.split(","):
                cleaned = item.strip().rstrip("/")
                if cleaned and cleaned not in origins:
                    origins.append(cleaned)

        if not origins:
            origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
        return origins

    # Platform Capacity (Strictly 10 registered/active users)
    MAX_TOTAL_USERS: int = 10

    # Storage & Quotas (Configured for up to 10 users on local drive)
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB per single file
    MAX_USER_STORAGE_BYTES: int = 1000 * 1024 * 1024  # 1 GB per user (doubled storage for 10 users)
    MAX_USER_DOCS_COUNT: int = 150  # Up to 150 docs per user

    # Rate Limiting & User Request Allowances (Increased to 50 requests per user per day)
    DAILY_CHAT_REQUEST_LIMIT: int = 50
    DAILY_IMAGE_REQUEST_LIMIT: int = 20

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
