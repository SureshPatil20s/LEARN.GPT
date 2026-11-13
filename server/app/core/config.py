"""
Server Configuration & Settings.
Supports PostgreSQL (Neon/Supabase) and SQLite fallback for seamless local/cloud dev.
Configures Groq Hosted LLM endpoint. Models are matched to the user's actual Groq key access.
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

    # Database: Defaults to local SQLite if DATABASE_URL is not set or empty, otherwise PostgreSQL (Neon/Supabase)
    DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./data/conversations/learn_gpt_platform.db"

    # Hosted LLM Inference via Groq (Free Tier)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # Default to the fast GPT-OSS-20B model confirmed accessible on this key
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "openai/gpt-oss-20b")

    # Available Hosted Models — IDs match the user's actual Groq key entitlements
    AVAILABLE_MODELS: list = [
        {"id": "openai/gpt-oss-20b", "name": "GPT OSS 20B (Fast)", "provider": "Groq", "description": "Fast, efficient model for general chat", "is_default": True},
        {"id": "openai/gpt-oss-120b", "name": "GPT OSS 120B (Powerful)", "provider": "Groq", "description": "Largest available model for complex reasoning tasks"},
        {"id": "qwen/qwen3.8-27b", "name": "Qwen3.8 27B (Reasoning)", "provider": "Groq", "description": "Advanced reasoning, math, and multilingual tasks"},
        {"id": "flux-image-gen", "name": "AI Image Generator (Gemini 2.0)", "provider": "Gemini / HuggingFace / Pollinations", "description": "Photorealistic image generation via Gemini 2.0 Flash (1,500 free/day) with automatic fallback"},
        {"id": "openai/gpt-oss-120b-vision", "name": "Vision & OCR (GPT OSS 120B)", "provider": "Groq Vision", "description": "Reads & extracts text from images, scans, and diagrams"},
    ]

    # Google OAuth (Real sign-in for any Google account)
    # Get from: https://console.cloud.google.com → APIs & Services → Credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # Hugging Face — FLUX.1-schnell image generation (free, much better than Pollinations)
    # Get from: https://huggingface.co → Settings → Access Tokens → New Token (Read)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

    # Google Gemini API Key — Imagen 3 photorealistic image generation & multimodal reasoning
    # Free key at: https://aistudio.google.com/apikey
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # CORS settings
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app"
    ]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

