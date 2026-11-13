"""
Voice & Speech-to-Text Subsystem (SDE 4 Pipeline).
Integrates chunk-to-text transcription orchestrator, VAD, and Google Speech Recognition.
"""
import os
import sys

# Ensure voice packages (academia_audio and sde4_stt) resolve cleanly
_pkg_dir = os.path.dirname(__file__)
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

from academia_audio.schemas import AudioFormat, AudioChunk
from academia_audio.chunker import chunk_pcm, frames_per_chunk
from sde4_stt.adapters.real_transcriber import RealSpeechTranscriber
from sde4_stt.adapters.fake_transcriber import FakeTranscriber
from sde4_stt.orchestrator import TranscriptionOrchestrator, TranscriptionResult
from sde4_stt.preprocessing import AudioPreprocessor
from sde4_stt.vad import VoiceActivityDetector, VADConfig
from sde4_stt.retry import RetryConfig
from sde4_stt.accumulator import SegmentAccumulator

__all__ = [
    "AudioFormat",
    "AudioChunk",
    "chunk_pcm",
    "frames_per_chunk",
    "RealSpeechTranscriber",
    "FakeTranscriber",
    "TranscriptionOrchestrator",
    "TranscriptionResult",
    "VoiceActivityDetector",
    "VADConfig",
    "AudioPreprocessor",
    "RetryConfig",
    "SegmentAccumulator",
]
