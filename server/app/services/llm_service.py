"""
Intelligent Multi-Model Router — LEARN.GPT Platform
====================================================
Primary Engine  : Google Gemini (gemini-2.0-flash / gemini-2.5-flash-lite)
Vision / OCR    : Gemini multimodal (inline image_data)
Image Gen       : Gemini image model → HuggingFace FLUX → Pollinations (free fallback chain)
Groq Fallback   : llama-3.3-70b via AsyncGroq — auto-activates on Gemini 429
Auto-Recovery   : QuotaCircuitBreaker resets when Gemini quota window expires

Intent routing (no manual model selection needed):
  IMAGE_GEN     → /image, draw, generate image, create an image, paint, illustrate …
  OCR_VISION    → image_data attached OR read/extract/describe/ocr keywords
  DIAGRAM       → diagram, flowchart, visualize, show how X works → text + inline image
  TEXT (default)→ Gemini streaming → Groq fallback on 429
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import random
import re
import time
import urllib.parse
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple

import aiohttp
from groq import AsyncGroq

from server.app.core.config import settings

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Real Gemini models confirmed working — ordered primary → fallback
GEMINI_TEXT_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
GEMINI_IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"]

# Groq confirmed working models — automatic failover chain
GROQ_TEXT_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b"

IMAGE_GEN_TRIGGERS = (
    "/image", "generate image", "draw ", "create an image", "generate an image",
    "paint ", "illustrate ", "make an image", "make image", "show image of",
    "picture of", "photo of"
)
OCR_TRIGGERS = (
    "read this image", "extract text", "what does this image say", "ocr",
    "transcribe this", "read the image", "describe this image", "what is in the image",
    "what's in the image", "analyze this image", "read image", "scan this"
)
DIAGRAM_TRIGGERS = (
    "diagram", "flowchart", "visualize", "show how", "architecture diagram",
    "draw a diagram", "create a diagram", "make a diagram"
)


# ---------------------------------------------------------------------------
# Quota Circuit Breaker  (in-memory; resets on process restart)
# ---------------------------------------------------------------------------

class QuotaCircuitBreaker:
    def __init__(self):
        self._blocked_until: Optional[float] = None  # epoch seconds

    def gemini_available(self) -> bool:
        if self._blocked_until is None:
            return True
        if time.time() >= self._blocked_until:
            self._blocked_until = None   # auto-recover
            return True
        return False

    def report_429(self, retry_after_seconds: int = 60):
        self._blocked_until = time.time() + retry_after_seconds

    @property
    def seconds_remaining(self) -> int:
        if self._blocked_until is None:
            return 0
        remaining = self._blocked_until - time.time()
        return max(0, int(remaining))


# ---------------------------------------------------------------------------
# Intent Detection
# ---------------------------------------------------------------------------

def _detect_intent(messages: List[Dict[str, Any]], has_image_data: bool = False) -> str:
    """Returns one of: IMAGE_GEN | OCR_VISION | DIAGRAM | TEXT"""
    if has_image_data:
        return "OCR_VISION"

    last_content = ""
    for m in reversed(messages):
        content = m.get("content", "")
        if isinstance(content, str):
            last_content = content
            break
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    last_content = part.get("text", "")
                    break
            break

    lower = last_content.lower().strip()

    # Check image generation first (highest priority keyword match)
    if any(lower.startswith(t) or t.strip() in lower for t in IMAGE_GEN_TRIGGERS):
        return "IMAGE_GEN"

    # OCR / vision keywords
    if any(t in lower for t in OCR_TRIGGERS):
        return "OCR_VISION"

    return "TEXT"


def _extract_image_prompt(text: str) -> str:
    """Strip command prefix, return clean prompt text."""
    lower = text.lower()
    prefixes = [
        "/image", "generate image of", "generate image",
        "draw a picture of", "draw a ", "draw ",
        "create an image of", "create an image",
        "generate an image of", "generate an image",
        "paint a picture of", "paint a ", "paint ",
        "illustrate ", "make an image of", "make an image",
        "make image of", "make image", "show image of",
        "picture of", "photo of"
    ]
    for prefix in prefixes:
        if lower.startswith(prefix):
            return text[len(prefix):].strip()
    return text.strip()


def _extract_retry_seconds(error: Exception) -> int:
    """Parse retry-after seconds from Gemini 429 error message."""
    msg = str(error)
    # Look for retryDelay patterns like "retryDelay":"30s" or "retry_after: 60"
    match = re.search(r'retryDelay["\s:]+(\d+)', msg)
    if match:
        return int(match.group(1))
    match = re.search(r'retry.after["\s:]+(\d+)', msg, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 60  # safe default


# ---------------------------------------------------------------------------
# Image Generation Helpers
# ---------------------------------------------------------------------------

async def _generate_gemini_image(prompt: str, gemini_api_key: str) -> Tuple[Optional[str], Optional[str]]:
    """Try Gemini image generation models. Returns (data_uri, error_reason)."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_api_key)

        for model_name in GEMINI_IMAGE_MODELS:
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda m=model_name: client.models.generate_content(
                        model=m,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_modalities=["TEXT", "IMAGE"]
                        )
                    )
                )
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                        mime = part.inline_data.mime_type or "image/png"
                        return f"data:{mime};base64,{b64}", None
            except Exception as model_err:
                err_str = str(model_err)
                if "limit: 0" in err_str or "quota" in err_str.lower():
                    return None, "Gemini image quota = 0 on this free tier (requires linked billing profile)."
                if "429" in err_str:
                    return None, f"Gemini image rate-limited: {err_str}"
                continue

        return None, "No Gemini image model returned an image part."
    except Exception as e:
        return None, str(e)


HF_IMAGE_API = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"


async def _generate_hf_image(prompt: str, hf_token: str) -> Optional[str]:
    """HuggingFace FLUX.1-schnell — secondary free generator."""
    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {"inputs": prompt, "parameters": {"num_inference_steps": 4}}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                HF_IMAGE_API, json=payload, headers=headers,
                timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                if resp.status == 200:
                    image_bytes = await resp.read()
                    b64 = base64.b64encode(image_bytes).decode("utf-8")
                    return f"data:image/jpeg;base64,{b64}"
                return None
    except Exception:
        return None


def _pollinations_url(prompt: str) -> str:
    """Build a Pollinations high-res image URL with prompt enhancement."""
    enhanced = prompt
    if not any(k in enhanced.lower() for k in ["photorealistic", "8k", "cinematic", "masterpiece", "detailed"]):
        enhanced = f"{prompt}, highly detailed, photorealistic, cinematic lighting, 8k resolution, sharp focus, masterpiece"
    seed = random.randint(10000, 999999)
    encoded = urllib.parse.quote(enhanced)
    return f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&seed={seed}&nologo=true"


# ---------------------------------------------------------------------------
# Gemini Message Format Converter
# ---------------------------------------------------------------------------

def _to_gemini_contents(messages: List[Dict[str, Any]]) -> Tuple[str, List[Dict]]:
    """
    Convert OpenAI-style messages → (system_instruction, gemini_contents).
    Roles: 'assistant' → 'model'. System messages extracted as instruction.
    """
    system_instruction = ""
    contents = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            if isinstance(content, str):
                system_instruction = content
            continue

        gemini_role = "model" if role == "assistant" else "user"

        if isinstance(content, str):
            if content.strip():
                contents.append({"role": gemini_role, "parts": [{"text": content}]})
        elif isinstance(content, list):
            # Multimodal content list (text + image_url parts)
            parts = []
            for part in content:
                if part.get("type") == "text":
                    parts.append({"text": part.get("text", "")})
                elif part.get("type") == "image_url":
                    url = part.get("image_url", {}).get("url", "")
                    if url.startswith("data:"):
                        # Parse data URI
                        header, b64data = url.split(",", 1)
                        mime = header.split(":")[1].split(";")[0]
                        image_bytes = base64.b64decode(b64data)
                        parts.append({
                            "inline_data": {"mime_type": mime, "data": image_bytes}
                        })
            if parts:
                contents.append({"role": gemini_role, "parts": parts})

    return system_instruction, contents


# ---------------------------------------------------------------------------
# Main Intelligent Router
# ---------------------------------------------------------------------------

class IntelligentRouter:
    """
    Single entry point for all LLM operations.
    Automatically routes to the right model/mode based on intent.
    """

    def __init__(self):
        self.gemini_api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.groq_api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        self.hf_token = getattr(settings, "HF_TOKEN", "") or os.getenv("HF_TOKEN", "")

        # Gemini client (lazy-init per request to avoid startup errors)
        self._gemini_client = None

        # Groq fallback client
        self.groq_client = AsyncGroq(api_key=self.groq_api_key) if self.groq_api_key else None

        # Circuit breaker — tracks Gemini 429 windows
        self.circuit_breaker = QuotaCircuitBreaker()

    def _get_gemini_client(self):
        if self._gemini_client is None and self.gemini_api_key:
            from google import genai
            self._gemini_client = genai.Client(api_key=self.gemini_api_key)
        return self._gemini_client

    def is_configured(self) -> bool:
        return bool(self.gemini_api_key or self.groq_api_key)

    # ------------------------------------------------------------------
    # Public API — same signature as old HostedLLMService
    # ------------------------------------------------------------------

    async def stream_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        image_data: Optional[str] = None,   # base64 data URI from frontend
    ) -> AsyncGenerator[str, None]:
        """
        Yields text chunks (SSE deltas) for the entire response.
        Routes automatically based on intent; never needs manual model selection.
        """
        has_image = bool(image_data)
        intent = _detect_intent(messages, has_image_data=has_image)

        # ---- Manual override: user explicitly picked image-gen model ----
        if model == "flux-image-gen":
            intent = "IMAGE_GEN"

        # ---- Route ----
        if intent == "IMAGE_GEN":
            async for chunk in self._handle_image_gen(messages):
                yield chunk

        elif intent == "OCR_VISION":
            async for chunk in self._handle_vision(messages, image_data):
                yield chunk

        else:  # TEXT & Interactive Visual Diagrams (Mermaid.js)
            async for chunk in self._handle_text(messages, temperature, max_tokens, preferred_model=model):
                yield chunk

    # ------------------------------------------------------------------
    # TEXT — Automatic multi-model failover (Gemini → Groq chain)
    # ------------------------------------------------------------------

    async def _handle_text(
        self,
        messages: List[Dict[str, Any]],
        temperature: float,
        max_tokens: int,
        preferred_model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        # Filter empty messages to prevent API errors
        clean_messages = [
            m for m in messages if (isinstance(m.get("content"), str) and m.get("content").strip()) or isinstance(m.get("content"), list)
        ]
        if not clean_messages:
            clean_messages = messages

        # If user explicitly picked a Gemini model from the picker
        if preferred_model and preferred_model in GEMINI_TEXT_MODELS:
            yielded_gemini = False
            if self.circuit_breaker.gemini_available() and self.gemini_api_key:
                async for chunk in self._stream_gemini_text(clean_messages, temperature, max_tokens, preferred_model=preferred_model):
                    yield chunk
                    yielded_gemini = True
            if not yielded_gemini:
                yield "*[Gemini unavailable — auto-switched to Groq LPU fallback]*\n\n"
                async for chunk in self._stream_groq_text(clean_messages, temperature, max_tokens):
                    yield chunk
            return

        # 1. AUTO MODE & GROQ: Ultra-fast Groq LPU primary (sub-second TTFT, 1-2s completion)
        yielded_groq = False
        if self.groq_client:
            async for chunk in self._stream_groq_text(clean_messages, temperature, max_tokens, preferred_model=preferred_model):
                yield chunk
                yielded_groq = True

        # 2. Seamless fallback to Gemini if Groq is unavailable or exhausted
        if not yielded_groq and self.circuit_breaker.gemini_available() and self.gemini_api_key:
            yield "*[Groq quota reached — auto-switched to Gemini fallback]*\n\n"
            async for chunk in self._stream_gemini_text(clean_messages, temperature, max_tokens):
                yield chunk

    async def _stream_gemini_text(
        self,
        messages: List[Dict[str, Any]],
        temperature: float,
        max_tokens: int,
        preferred_model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        try:
            from google import genai
            from google.genai import types

            client = self._get_gemini_client()
            if not client:
                return

            system_instruction, contents = _to_gemini_contents(messages)

            # Order models with preferred first if applicable
            candidate_models = list(GEMINI_TEXT_MODELS)
            if preferred_model and preferred_model in candidate_models:
                candidate_models.remove(preferred_model)
                candidate_models.insert(0, preferred_model)

            for model_name in candidate_models:
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda m=model_name: client.models.generate_content_stream(
                            model=m,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction or None,
                                temperature=temperature,
                                max_output_tokens=max_tokens,
                            )
                        )
                    )

                    yielded_any = False
                    for chunk in response:
                        if chunk.text:
                            yield chunk.text
                            yielded_any = True
                    if yielded_any:
                        return  # Success!

                except Exception as model_err:
                    err_str = str(model_err)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        retry_secs = _extract_retry_seconds(model_err)
                        self.circuit_breaker.report_429(retry_secs)
                    # Continue loop to try next Gemini model in the chain
                    continue

        except Exception:
            return  # Let caller failover to Groq

    async def _stream_groq_text(
        self,
        messages: List[Dict[str, Any]],
        temperature: float,
        max_tokens: int,
        preferred_model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        if not self.groq_client:
            yield "⚠️ No Groq API key configured. Please add GROQ_API_KEY to .env as a fallback.\n"
            return

        # Prepare candidate models with preferred first
        candidate_models = list(GROQ_TEXT_MODELS)
        if preferred_model and preferred_model in candidate_models:
            candidate_models.remove(preferred_model)
            candidate_models.insert(0, preferred_model)

        last_error = None
        for model_name in candidate_models:
            try:
                response = await self.groq_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                yielded_any = False
                async for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                        yielded_any = True
                if yielded_any:
                    return  # Success!
            except Exception as e:
                last_error = e
                continue  # Try next Groq model in failover chain

        if last_error:
            yield f"\n\n[All models temporarily exhausted]: {str(last_error)}\n"

    # ------------------------------------------------------------------
    # OCR / VISION — Gemini multimodal
    # ------------------------------------------------------------------

    async def _handle_vision(
        self,
        messages: List[Dict[str, Any]],
        image_data: Optional[str]
    ) -> AsyncGenerator[str, None]:
        try:
            from google import genai
            from google.genai import types

            client = self._get_gemini_client()
            if not client:
                # Fall back to Groq vision if available
                async for chunk in self._stream_groq_vision(messages):
                    yield chunk
                return

            # Extract the user's text prompt
            user_text = "Please read and analyze this image. Extract all text (OCR) and describe the visual content."
            for m in reversed(messages):
                if m.get("role") == "user":
                    content = m.get("content", "")
                    if isinstance(content, str) and content.strip():
                        user_text = content
                    break

            # Build multimodal parts
            parts = [{"text": user_text}]

            if image_data and image_data.startswith("data:"):
                header, b64data = image_data.split(",", 1)
                mime = header.split(":")[1].split(";")[0]
                image_bytes = base64.b64decode(b64data)
                parts.append({
                    "inline_data": {"mime_type": mime, "data": image_bytes}
                })

            # System instruction from messages
            system_instruction = ""
            for m in messages:
                if m.get("role") == "system":
                    system_instruction = m.get("content", "")
                    break

            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.models.generate_content_stream(
                    model="gemini-3.5-flash",
                    contents=[{"parts": parts}],
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction or None,
                        temperature=0.3,
                        max_output_tokens=2048,
                    )
                )
            )

            for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                retry_secs = _extract_retry_seconds(e)
                self.circuit_breaker.report_429(retry_secs)
                yield "*[Gemini vision quota hit — trying Groq vision fallback]*\n\n"
                async for chunk in self._stream_groq_vision(messages):
                    yield chunk
            else:
                yield f"\n\n[Vision Error]: {err_str}\n"

    async def _stream_groq_vision(self, messages: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """Groq vision fallback using openai/gpt-oss-120b."""
        if not self.groq_client:
            yield "⚠️ No Groq API key configured for vision fallback.\n"
            return
        try:
            response = await self.groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                temperature=0.3,
                max_tokens=2048,
                stream=True,
            )
            async for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            yield f"\n\n[Groq Vision Error]: {str(e)}\n"

    # ------------------------------------------------------------------
    # IMAGE GENERATION — Gemini → HF FLUX → Pollinations
    # ------------------------------------------------------------------

    async def _handle_image_gen(self, messages: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        # Extract the prompt text
        raw_prompt = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                content = m.get("content", "")
                if isinstance(content, str):
                    raw_prompt = content
                elif isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            raw_prompt = part.get("text", "")
                break

        prompt = _extract_image_prompt(raw_prompt)
        if not prompt:
            prompt = "A futuristic AI laboratory with holographic interfaces, photorealistic, 8K"

        # ---- Try Gemini image ----
        if self.gemini_api_key:
            yield "🎨 **Generating AI image with Gemini Flash...**\n\n"
            await asyncio.sleep(0.1)
            data_uri, err = await _generate_gemini_image(prompt, self.gemini_api_key)
            if data_uri:
                yield f"### 🖼️ Prompt: *\"{prompt}\"*\n\n"
                yield f"![{prompt}]({data_uri})\n\n"
                yield f"> **Model:** Gemini Flash Image Generation (Google)\n"
                yield f"> **Quality:** Photorealistic · Daily User Quota: 10 images/day\n"
                return
            else:
                yield f"⚠️ *Gemini image: {err}*\n\n"

        # ---- Try HuggingFace FLUX.1-schnell ----
        if self.hf_token:
            yield "🎨 **Generating AI image with FLUX.1-schnell (HuggingFace)...**\n\n"
            await asyncio.sleep(0.1)
            data_uri = await _generate_hf_image(prompt, self.hf_token)
            if data_uri:
                yield f"### 🖼️ Prompt: *\"{prompt}\"*\n\n"
                yield f"![{prompt}]({data_uri})\n\n"
                yield f"> **Model:** FLUX.1-schnell (Black Forest Labs via HuggingFace)\n"
                yield f"> **Quality:** State-of-the-art 4-step ultra-fast diffusion\n"
                return
            else:
                yield "⚠️ FLUX model is loading — falling back to Pollinations...\n\n"

        # ---- Pollinations (always available, no key) ----
        image_url = _pollinations_url(prompt)
        yield f"🎨 **Generating AI image with Pollinations (Free Hosted Model)...**\n\n"
        yield f"### 🖼️ Prompt: *\"{prompt}\"*\n\n"
        yield f"![{prompt}]({image_url})\n\n"
        yield f"> **Model:** SDXL-Turbo / Pollinations (1024×1024)\n"
        yield f"> **Status:** Free & Unlimited (Zero API Key Required)\n"
        yield f"\n[📥 Download Full-Res Image]({image_url})\n"
        if not self.gemini_api_key:
            yield "\n💡 Add a free `GEMINI_API_KEY` in `.env` to use Gemini for much better quality! (~1500 images/day free)\n"

    # ------------------------------------------------------------------
    # DIAGRAM — text explanation + inline diagram image
    # ------------------------------------------------------------------

    async def _handle_diagram(
        self,
        messages: List[Dict[str, Any]],
        temperature: float
    ) -> AsyncGenerator[str, None]:
        """Stream text explanation, then optionally append a diagram image."""

        # First stream the textual explanation
        async for chunk in self._handle_text(messages, temperature, 2048):
            yield chunk

        # Then attempt to generate a visual diagram
        raw_prompt = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                content = m.get("content", "")
                if isinstance(content, str):
                    raw_prompt = content
                break

        if raw_prompt:
            yield "\n\n---\n*📊 Generating visual diagram...*\n\n"
            diagram_prompt = f"Clean technical diagram, flowchart, or architecture illustration of: {raw_prompt}. White background, labeled nodes, professional style."
            image_url = _pollinations_url(diagram_prompt)
            yield f"![Diagram: {raw_prompt[:60]}]({image_url})\n"


# ---------------------------------------------------------------------------
# Singleton instance — imported by chat.py as `hosted_llm`
# ---------------------------------------------------------------------------
hosted_llm = IntelligentRouter()
# Also export under new name for clarity
router = hosted_llm
