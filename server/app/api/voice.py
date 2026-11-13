"""
Voice & Speech-to-Text API Router (SDE 4 Pipeline).
Exposes endpoints for audio chunking and speech-to-text transcription.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Optional

from server.app.services.voice_service import voice_service

router = APIRouter(prefix="/voice", tags=["Voice & Speech-to-Text"])


@router.get("/status")
def get_voice_status():
    """Returns speech recognition engine status and supported audio formats."""
    return {
        "status": "ready",
        "pipeline": "SDE-4 Chunk-to-Text Orchestrator",
        "engine": "Google Speech Recognition (free, no API key required)",
        "offline_fallback": "FakeTranscriber",
        "supported_input": ["WAV (16kHz 16-bit PCM)", "Raw PCM chunks"],
        "features": [
            "Deterministic 200ms audio chunking",
            "Anti-aliasing sinc-FIR downsampling",
            "RMS gain normalization",
            "Voice Activity Detection (VAD)",
            "Deduplication & interim reconciliation",
            "Bounded exponential backoff retries"
        ]
    }


@router.post("/transcribe")
async def transcribe_audio_file(
    file: UploadFile = File(...),
    language: Optional[str] = Form("en-US"),
    use_mock: Optional[bool] = Form(False)
):
    """
    Accepts an audio recording from the browser, chunks it into AudioChunk objects,
    and executes the full SDE-4 TranscriptionOrchestrator pipeline.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio file uploaded"
            )

        result = voice_service.transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            language=language or "en-US",
            use_mock=bool(use_mock)
        )

        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech transcription failed: {str(exc)}"
        )
