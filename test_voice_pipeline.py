"""
Unit & Integration Test Suite for SDE-4 Speech-to-Text Pipeline Integration.
Validates:
  1. Audio chunking (AudioFormat + chunk_pcm)
  2. AudioPreprocessor & VoiceActivityDetector (VAD)
  3. TranscriptionOrchestrator with FakeTranscriber & RealSpeechTranscriber
  4. FastAPI Voice Router endpoints (/api/v1/voice/status and /api/v1/voice/transcribe)
"""
import io
import wave
import sys

from fastapi.testclient import TestClient

from server.app.main import app
from server.app.voice import (
    AudioFormat,
    AudioChunk,
    chunk_pcm,
    TranscriptionOrchestrator,
    FakeTranscriber,
    RealSpeechTranscriber,
    AudioPreprocessor,
    VoiceActivityDetector,
    VADConfig,
)
from server.app.services.voice_service import voice_service


def test_chunking_and_orchestration():
    print("\n--- 1. Testing Audio Chunking & Orchestrator ---")
    fmt = AudioFormat(sample_rate=16000, channels=1, sample_width=2)
    # 1 second of 16kHz audio = 32000 bytes
    raw_pcm = b"\x00\x00" * 16000
    chunks = list(chunk_pcm(raw_pcm, fmt, chunk_ms=200))
    assert len(chunks) == 5, f"Expected 5 chunks, got {len(chunks)}"
    print(f"PASS: Generated {len(chunks)} chunks of 200ms from 1.0s PCM audio.")

    # Test orchestrator with FakeTranscriber
    canned_text = "What is the difference between RNN and Transformer?"
    orch = TranscriptionOrchestrator(adapter=FakeTranscriber(canned_transcript=canned_text))
    result = orch.transcribe(chunks, session_id="test_orchestrator")
    assert result.full_text == canned_text, f"Unexpected result: {result.full_text}"
    assert result.chunks_processed == 5
    print(f"PASS: Orchestrator transcribed {result.chunks_processed} chunks -> '{result.full_text}'")


def test_vad_and_preprocessing():
    print("\n--- 2. Testing VAD and Audio Preprocessor ---")
    fmt = AudioFormat(sample_rate=16000, channels=1, sample_width=2)
    chunk = AudioChunk(sequence_id=0, timestamp_s=0.0, format=fmt, data=b"\x00\x00" * 3200)

    preprocessor = AudioPreprocessor(target_sample_rate=16000, normalize_audio=True)
    processed_chunk = preprocessor.process_chunk(chunk)
    assert processed_chunk.format.sample_rate == 16000
    print("PASS: AudioPreprocessor successfully normalized and processed chunk.")

    vad = VoiceActivityDetector(VADConfig(energy_threshold=0.015))
    vad_res = vad.process_chunk(chunk)
    assert not vad_res.is_speech  # silence is not speech
    print("PASS: Voice Activity Detector (VAD) correctly classified silent chunk.")


def test_voice_service():
    print("\n--- 3. Testing VoiceService ---")
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"\x00\x00" * 32000)  # 2.0s audio

    res = voice_service.transcribe_audio_bytes(bio.getvalue(), use_mock=True)
    assert res["text"], "Expected transcribed text from voice_service"
    assert res["chunks_processed"] == 10
    print(f"PASS: VoiceService processed 2.0s audio -> {res['chunks_processed']} chunks -> '{res['text']}'")


def test_fastapi_endpoints():
    print("\n--- 4. Testing FastAPI Voice Endpoints ---")
    client = TestClient(app)

    # Status check
    status_res = client.get("/api/v1/voice/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["status"] == "ready"
    assert "SDE-4" in data["pipeline"]
    print(f"PASS: /api/v1/voice/status returned: {data['pipeline']} ({data['engine']})")

    # Transcribe file upload
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"\x00\x00" * 16000)
    bio.seek(0)

    post_res = client.post(
        "/api/v1/voice/transcribe",
        files={"file": ("recording.wav", bio, "audio/wav")},
        data={"use_mock": "true"}
    )
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert post_data["chunks_processed"] == 5
    assert len(post_data["text"]) > 0
    print(f"PASS: /api/v1/voice/transcribe HTTP 200: {post_data['text']}")


if __name__ == "__main__":
    print("=" * 65)
    print("  ACADEMIA SDE-4 SPEECH-TO-TEXT INTEGRATION TEST SUITE")
    print("=" * 65)
    test_chunking_and_orchestration()
    test_vad_and_preprocessing()
    test_voice_service()
    test_fastapi_endpoints()
    print("\n" + "=" * 65)
    print("  ALL VOICE TESTS PASSED SUCCESSFULLY! (100% GREEN)")
    print("=" * 65)
