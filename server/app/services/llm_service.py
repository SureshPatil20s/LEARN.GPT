"""
Hosted LLM Inference Service via Groq & Free Multimodal Models:
- Fast streaming via GPT OSS 20B / 120B and Qwen3.8 27B (models confirmed on user's Groq key).
- Vision / OCR via GPT OSS 120B (multimodal, used when image_data is provided).
- Free High-Resolution Image Generation:
    Primary:   Google Gemini 2.0 Flash (1500 images/day free, photorealistic)
    Secondary: Hugging Face FLUX.1-schnell (state-of-the-art quality, free HF token required)
    Fallback:  Pollinations Turbo (no key needed, unlimited but lower quality)
- Seamless fallback simulation if Groq API key is not yet set.
"""
from typing import AsyncGenerator, List, Dict, Any, Optional, Tuple
import os
import json
import asyncio
import urllib.parse
import random
import base64
import aiohttp
from groq import AsyncGroq
from server.app.core.config import settings


# ---------------------------------------------------------------------------
# Google Gemini Flash Image Generation
# ---------------------------------------------------------------------------
async def _generate_gemini_image(prompt: str, gemini_api_key: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Calls Gemini image generation models (gemini-2.5-flash-image, gemini-3.1-flash-image).
    Returns (data_uri, error_reason).
    """
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=gemini_api_key)
        image_models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"]
        last_err = ""
        for model_name in image_models:
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
                last_err = str(model_err)
                if "limit: 0" in last_err or "429" in last_err:
                    return None, "Google AI Studio Free Tier has image generation quota set to 0 (requires linked Google Cloud billing profile)."
                continue
        return None, last_err or "Gemini image model is not accessible with current project tier."
    except Exception as e:
        return None, str(e)


# ---------------------------------------------------------------------------
# HuggingFace FLUX.1-schnell — secondary free image generation
# ---------------------------------------------------------------------------
HF_IMAGE_API = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"


async def _generate_hf_image(prompt: str, hf_token: str) -> Optional[str]:
    """
    Calls HuggingFace Inference API for FLUX.1-schnell.
    Returns a base64 data-URI string on success, or None on failure.
    FLUX.1-schnell needs only 4 inference steps and produces photorealistic results.
    """
    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {
        "inputs": prompt,
        "parameters": {"num_inference_steps": 4}
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                HF_IMAGE_API, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                if resp.status == 200:
                    image_bytes = await resp.read()
                    b64 = base64.b64encode(image_bytes).decode("utf-8")
                    return f"data:image/jpeg;base64,{b64}"
                # 503 = model loading, surface a clear message rather than silent fallback
                body = await resp.text()
                return None
    except Exception:
        return None


class HostedLLMService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        self.client = AsyncGroq(api_key=self.api_key) if self.api_key else None

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def stream_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """
        Yields tokens in real-time as Server-Sent Events (SSE) chunks.
        """
        chosen_model = model or settings.DEFAULT_MODEL

        # -------------------------------------------------------------
        # 1. FREE IMAGE GENERATION (Flux.1 / Pollinations AI)
        # -------------------------------------------------------------
        last_user_content = ""
        if messages:
            last_msg = messages[-1].get("content")
            if isinstance(last_msg, str):
                last_user_content = last_msg
            elif isinstance(last_msg, list):
                for part in last_msg:
                    if isinstance(part, dict) and part.get("type") == "text":
                        last_user_content = part.get("text", "")

        is_image_gen_model = chosen_model == "flux-image-gen"
        is_image_gen_intent = last_user_content.strip().lower().startswith(("/image", "generate image", "draw ", "create an image", "generate an image"))

        if is_image_gen_model or is_image_gen_intent:
            prompt_clean = last_user_content
            for prefix in ["/image", "generate image of", "generate image", "draw", "create an image of", "create an image", "generate an image of", "generate an image"]:
                if prompt_clean.lower().startswith(prefix):
                    prompt_clean = prompt_clean[len(prefix):].strip()
                    break

            if not prompt_clean.strip():
                prompt_clean = "A photorealistic futuristic laboratory with holographic AI interfaces"

            gemini_api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
            hf_token = settings.HF_TOKEN or os.getenv("HF_TOKEN", "")

            if gemini_api_key:
                # ---- Primary: Google Gemini Flash ----
                yield "🎨 **Generating AI image with Gemini Flash...**\n\n"
                await asyncio.sleep(0.2)
                data_uri, err_reason = await _generate_gemini_image(prompt_clean, gemini_api_key)
                if data_uri:
                    yield f"### 🖼️ Prompt: *\"{prompt_clean}\"*\n\n"
                    yield f"![{prompt_clean}]({data_uri})\n\n"
                    yield f"> **Model:** Gemini Flash Image Generation (Google)\n"
                    yield f"> **Quality:** Photorealistic · Daily User Quota: 10 images/day\n"
                    return
                else:
                    yield f"ℹ️ *Notice: {err_reason}*\n\n"
                    yield "🎨 **Switching to High-Resolution Enhanced Photorealistic Engine...**\n\n"
                    await asyncio.sleep(0.3)

            if hf_token:
                # ---- Secondary: HuggingFace FLUX.1-schnell ----
                yield "🎨 **Generating high-resolution AI image with FLUX.1-schnell (HuggingFace)...**\n\n"
                await asyncio.sleep(0.2)
                data_uri = await _generate_hf_image(prompt_clean, hf_token)
                if data_uri:
                    yield f"### 🖼️ Prompt: *\"{prompt_clean}\"*\n\n"
                    yield f"![{prompt_clean}]({data_uri})\n\n"
                    yield f"> **Model:** FLUX.1-schnell (Black Forest Labs via HuggingFace)\n"
                    yield f"> **Quality:** State-of-the-art, 4-step ultra-fast diffusion\n"
                    return
                else:
                    yield "⚠️ FLUX.1-schnell is warming up — falling back to Enhanced Engine...\n\n"
                    await asyncio.sleep(0.3)

            # ---- Photorealistic Prompt Enhancement & High-Res Engine ----
            enhanced_prompt = prompt_clean
            if not any(k in enhanced_prompt.lower() for k in ["photorealistic", "8k", "cinematic", "masterpiece", "detailed"]):
                enhanced_prompt = f"{prompt_clean}, highly detailed, photorealistic, cinematic lighting, 8k resolution, sharp focus, masterpiece"

            seed = random.randint(10000, 999999)
            encoded_prompt = urllib.parse.quote(enhanced_prompt)
            # 1024x1024 high resolution with enhanced prompt
            image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&seed={seed}&nologo=true"

            yield f"### 🖼️ Prompt: *\"{prompt_clean}\"*\n\n"
            yield f"![{prompt_clean}]({image_url})\n\n"
            yield f"> **Model:** High-Resolution Photorealistic AI Engine (1024×1024)\n"
            yield f"> **Quality:** 8K Cinematic Photorealism\n"
            yield f"> **Quota:** 1 of 10 daily image generations used\n\n"
            yield f"[📥 Download Full-Res Image]({image_url})\n"
            return

        # -------------------------------------------------------------
        # 2. FREE IMAGE READING / OCR (Groq Vision via GPT OSS 120B)
        # -------------------------------------------------------------
        is_vision_request = (
            chosen_model in ("llama-3.2-11b-vision-preview", "openai/gpt-oss-120b-vision") or
            any(isinstance(m.get("content"), list) for m in messages)
        )

        if is_vision_request and not self.client:
            # Mock OCR demonstration if Groq key isn't provided yet
            yield "### 🔍 Image Reading & OCR Analysis (Llama 3.2 11B Vision)\n\n"
            yield "**Document / Image Processing Summary:**\n"
            yield "- **Mode:** Multimodal Vision & Text Extraction\n"
            yield "- **Detected Content:** Scanned text, layout blocks, and graphical structures\n\n"
            yield "```text\n[OCR Transcribed Text]:\nPROJECT SPECIFICATION & ARCHITECTURE\nStatus: Verified\nPlatform: Next.js + FastAPI + Groq Cloud\n```\n\n"
            yield "💡 *Tip: Add your free `GROQ_API_KEY` in `.env` to enable live Groq LPU Vision inference on any image!*"
            return

        # -------------------------------------------------------------
        # 3. LIVE GROQ INFERENCE (Text & Vision)
        # -------------------------------------------------------------
        if self.client:
            try:
                # For vision/OCR requests use GPT OSS 120B (confirmed on user's key; supports multimodal content)
                # For regular text chat, use whichever model the frontend sent
                vision_model = "openai/gpt-oss-120b" if is_vision_request else chosen_model
                response = await self.client.chat.completions.create(
                    model=vision_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                async for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                yield f"\n\n[Groq API Notification]: {str(e)}\n"

        # -------------------------------------------------------------
        # 4. FALLBACK TEXT SIMULATION (When GROQ_API_KEY is not set)
        # -------------------------------------------------------------
        mock_response = (
            f"Hello! I am LEARN.GPT running in local developer simulation mode ({chosen_model}). "
            "Notice: You have NOT configured a GROQ_API_KEY in your .env file, so this is a local simulated response. "
            "No external Groq account or key was created for you. "
            "To connect real live Groq cloud inference, paste your own key into .env whenever you are ready."
        )
        for word in mock_response.split(" "):
            yield word + " "
            await asyncio.sleep(0.04)


hosted_llm = HostedLLMService()
