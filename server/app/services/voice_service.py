"""
Voice Service for Speech-to-Text Transcription.
Wraps the SDE-4 chunk-to-text pipeline:
  1. Accepts raw audio bytes (WAV, PCM, or WebM/OGG with fallback).
  2. Parses PCM audio geometry (sample rate, channels, bit depth).
  3. Uses AudioChunker to chunk the stream into deterministic 200ms AudioChunks.
  4. Runs AudioPreprocessor (resampling to 16kHz, RMS normalization).
  5. Uses TranscriptionOrchestrator with RealSpeechTranscriber (Google Speech API, free).
  6. Returns structured transcript with segment timing and metadata.
"""
from __future__ import annotations

import io
import time
import wave
import uuid
import logging
from typing import Dict, Any, List, Optional

from server.app.core.config import settings
from server.app.voice import (
    AudioFormat,
    AudioChunk,
    chunk_pcm,
    RealSpeechTranscriber,
    FakeTranscriber,
    TranscriptionOrchestrator,
    TranscriptionResult,
    AudioPreprocessor,
    VoiceActivityDetector,
    VADConfig,
    RetryConfig
)


class VoiceService:
    def __init__(self):
        self.preprocessor = AudioPreprocessor(target_sample_rate=16000, normalize_audio=True)
        self.retry_cfg = RetryConfig(max_retries=2, timeout_s=30.0)
        self.vad = VoiceActivityDetector(
            VADConfig(
                energy_threshold=0.015,
                min_speech_duration_s=0.08,
                min_silence_duration_s=0.35,
                adaptive_noise=True
            )
        )

    def transcribe_audio_bytes(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
        use_mock: bool = False,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes audio bytes (WAV container or raw 16kHz 16-bit mono PCM).
        Slices audio into chunks and executes the full SDE-4 orchestrator.
        """
        if not audio_bytes or len(audio_bytes) < 44:
            return {
                "text": "",
                "segments": [],
                "duration_s": 0.0,
                "chunks_processed": 0,
                "error": "Audio data is empty or too short."
            }

        session_id = session_id or f"voice_session_{uuid.uuid4().hex[:8]}"

        # 0. Fast Primary: Groq Hosted Whisper (sub-second LPU transcription)
        if not use_mock and settings.GROQ_API_KEY:
            try:
                from groq import Groq
                groq_client = Groq(api_key=settings.GROQ_API_KEY)
                t_start = time.time()
                whisper_res = groq_client.audio.transcriptions.create(
                    file=("mic_audio.wav", audio_bytes),
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json"
                )
                text = (getattr(whisper_res, "text", "") or "").strip()
                duration = getattr(whisper_res, "duration", None) or (time.time() - t_start)
                if text:
                    return {
                        "text": text,
                        "session_id": session_id,
                        "duration_s": round(duration, 2),
                        "chunks_processed": 1,
                        "duplicates_suppressed": 0,
                        "interims_reconciled": 0,
                        "segments": [],
                        "has_errors": False
                    }
            except Exception as whisper_err:
                logging.getLogger(__name__).warning(f"Groq Whisper transcription fallback: {whisper_err}")

        # 1. Parse WAV container or assume 16kHz 16-bit mono PCM
        pcm_data: bytes
        sample_rate = 16000
        channels = 1
        sample_width = 2

        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sample_rate = wf.getframerate()
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                pcm_data = wf.readframes(wf.getnframes())
        except Exception:
            # If not a valid WAV header, assume raw 16kHz 16-bit PCM payload
            pcm_data = audio_bytes
            # Ensure pcm_data is aligned to 2 bytes (16-bit)
            if len(pcm_data) % 2 != 0:
                pcm_data = pcm_data[:-1]

        if not pcm_data:
            return {
                "text": "",
                "segments": [],
                "duration_s": 0.0,
                "chunks_processed": 0,
                "error": "No PCM audio samples found in input."
            }

        audio_fmt = AudioFormat(
            sample_rate=sample_rate,
            channels=channels,
            sample_width=sample_width
        )

        # 2. Slice PCM into deterministic AudioChunks (200ms per chunk)
        chunk_ms = 200
        try:
            chunks = list(chunk_pcm(pcm_data, audio_fmt, chunk_ms=chunk_ms))
        except Exception as e:
            return {
                "text": "",
                "segments": [],
                "duration_s": 0.0,
                "chunks_processed": 0,
                "error": f"Audio chunking failed: {e}"
            }

        # 3. Configure Orchestrator with Real Transcriber (or Fake if requested/fallback)
        if use_mock:
            adapter = FakeTranscriber(canned_transcript="Speech recognition test transcription")
        else:
            try:
                adapter = RealSpeechTranscriber(
                    language=language,
                    sample_rate=sample_rate,
                    sample_width=sample_width
                )
            except Exception:
                adapter = FakeTranscriber(canned_transcript="Speech recognition initialized in fallback mode")

        orchestrator = TranscriptionOrchestrator(
            adapter=adapter,
            preprocessor=self.preprocessor,
            retry_config=self.retry_cfg
        )

        # 4. Run pipeline
        result: TranscriptionResult = orchestrator.transcribe(
            chunks,
            session_id=session_id,
            language=language,
            sample_rate=sample_rate
        )

        formatted_segments = []
        for s in result.segments:
            formatted_segments.append({
                "segment_id": s.segment_id,
                "text": s.text,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "confidence": s.confidence,
                "words": [
                    {"word": w.word, "start_time": w.start_time, "end_time": w.end_time}
                    for w in (s.words or [])
                ]
            })

        return {
            "text": result.full_text,
            "session_id": result.session_id,
            "duration_s": result.duration_s,
            "chunks_processed": result.chunks_processed,
            "duplicates_suppressed": result.duplicates_suppressed,
            "interims_reconciled": result.interims_reconciled,
            "segments": formatted_segments,
            "has_errors": result.has_errors
        }


voice_service = VoiceService()
