# 🤖 LEARN.GPT — Phase 3: ChatGPT-Style AI Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Groq Cloud](https://img.shields.io/badge/Groq-LPU_Hosted_Inference-F55036.svg)](https://groq.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791.svg?logo=postgresql)](https://www.postgresql.org/)

An enterprise-grade, multi-user ChatGPT-style web platform built with **Next.js (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and a high-performance **FastAPI** backend. Powered by hosted cloud LLMs (**Groq Cloud**) with zero local GPU required.

---

## 🚀 How to Run the Project

### Option 1: 1-Click Launch (Windows — Recommended)
Simply double-click the launch script in the project root:
```cmd
run_phase3.bat
```
This automatically starts both the **FastAPI Backend** and the **Next.js Frontend** in separate terminal windows.

---

### Option 2: Manual Terminal Launch

#### Step 1: Start the FastAPI Backend
Open a terminal in the project root and run:
```bash
python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Backend API:** http://localhost:8000
- **Interactive Swagger Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

> **Troubleshooting `[WinError 10013]` (Port 8000 already in use):**
> If another background python or uvicorn instance is already bound to port 8000, run in PowerShell:
> ```powershell
> Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
> ```

#### Step 2: Database Migrations (Optional / Initial Setup)
To apply the database schema via Alembic:
```bash
alembic upgrade head
```

#### Step 3: Start the Next.js Frontend
Open a second terminal, navigate into the `client` directory, and start the development server:
```bash
cd client
npm run dev
```
- **Web Application:** http://localhost:3000

---

## ⚙️ Configuration

### Required — `.env` (project root)

```ini
# 1. Groq Hosted LLM API Key
# Free key at: https://console.groq.com/keys
GROQ_API_KEY=gsk_your_key_here

# 2. Default Model (confirmed working on your Groq key)
DEFAULT_MODEL=openai/gpt-oss-20b
```

### Optional — Google OAuth (any user can sign in with their Google account)

**Step 1:** Go to https://console.cloud.google.com → APIs & Services → Credentials  
**Step 2:** Create OAuth 2.0 Client ID → Application type: **Web application**  
**Step 3:** Add authorized origins: `http://localhost:3000`  
**Step 4:** Copy the Client ID and add to both files:

```ini
# .env (backend — for ID token verification)
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

```ini
# client/.env.local (frontend — for the sign-in popup)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

---

## 🎙️ Speech-to-Text Voice Subsystem (SDE-4 Pipeline)

Integrated directly from the [`Rishikeshn2007/SDE-4`](https://github.com/Rishikeshn2007/SDE-4/tree/suresh) (`suresh` branch) voice pipeline:

- **Audio Chunking (`academia_audio.chunker`):** Slices incoming microphone PCM audio into deterministic 200ms `AudioChunk` objects with monotonic sequence IDs and timestamps.
- **Audio Preprocessor (`sde4_stt.preprocessing`):** Sinc-FIR low-pass downsampling and RMS gain normalization.
- **Voice Activity Detection (`sde4_stt.vad`):** Energy-based speech vs. silence classification.
- **Transcription Orchestrator (`sde4_stt.orchestrator`):** Wires chunks → preprocessing → `RealSpeechTranscriber` (Google Web Speech API, 100% free with no API keys required) → deduplication & interim reconciliation.
- **Web UI Mic Button:** Click the 🎙️ button in the chat box to dictate questions directly into LEARN.GPT.
- **Test Suite:** Run `python test_voice_pipeline.py` to verify all components.

> When configured, the "Continue with Google" button opens a real Google account picker — any Google account works, not just one specific person. The backend verifies the credential JWT cryptographically.

> Without it, the Google button shows a setup notice and email/password login still works normally.

### Optional — FLUX.1-schnell Image Generation (much better quality)

**Step 1:** Create a free account at https://huggingface.co  
**Step 2:** Go to Settings → Access Tokens → New Token (Read access, free)  
**Step 3:** Add to `.env`:

```ini
# .env
HF_TOKEN=hf_your_token_here
```

> With `HF_TOKEN`: uses **FLUX.1-schnell** (Black Forest Labs, state-of-the-art quality, 4-step ultra-fast diffusion)  
> Without `HF_TOKEN`: falls back to **Pollinations Turbo** (unlimited, no key, lower quality)

### Optional — PostgreSQL (Cloud Database)

```ini
# .env — leave blank for auto SQLite fallback
# DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 🌟 Core Features

### 1. Modern ChatGPT-Style UI
- Sleek dark theme with emerald accents.
- Sidebar with **+ New chat**, real-time search, pinned chats, and date-sorted conversation history.
- Markdown and code block syntax highlighting with **1-click Copy Code**.
- Message actions: Copy, Regenerate, Thumbs Up / Down rating.

### 2. Hosted LLM Inference & Free Multimodal
- **GPT OSS 20B / 120B & Qwen3.8 27B:** Ultra-fast streaming via Groq Cloud API.
- **AI Image Generator:** Type `/image <prompt>` to generate 1024×1024 images inline.
  - Primary: FLUX.1-schnell via HuggingFace (best quality, free HF token)
  - Fallback: Pollinations Turbo (no key, unlimited)
- **Vision & OCR:** Attach images for automatic text extraction and visual analysis.

### 3. Document Knowledge Base (RAG)
- Multi-format ingestion: **PDF, DOCX, TXT, CSV, JSON**.
- Semantic retrieval with provenance citation chips (file name, page, similarity score).
- Real-time **RAG Toggle** in the header.

### 4. Authentication & Data Privacy
- **Email/Password:** Salted bcrypt hashing with 7-day JWT tokens.
- **Google OAuth:** Real sign-in popup via Google Identity Services — any Google account works, with backend cryptographic token verification.
- **Guest Mode:** Instant access without login; chats are ephemeral and not persisted.
- **Persistent Storage:** Registered users get cross-device conversation history.

### 5. AI Interview Simulator (Optional & User-Controlled)
- **Multi-Role Simulation:** Technical (C, Python, Java, DSA, OS, DBMS, Networks, ML), Coding challenges with starter code, HR/Behavioral (STAR method), Project & Resume Defense, University Viva, and Campus Placement.
- **Interactive State Machine:** One question at a time, candidate response capture (text or Whisper speech-to-text dictation), live countdown timer, and sequence progression.
- **Comprehensive Rubric Evaluation:** Overall score (0–100), dimensional scoring (Technical Accuracy, Communication, Problem Solving, Depth of Knowledge), executive verdict, strengths, knowledge gaps, targeted study roadmap, and **Teach-After-Interview** model answers.
- **User-Controlled Visibility:** The Interviewer button is **optional** — users decide whether to display it via **Settings (⚙️) → Tools & Capabilities → AI Interview Simulator** toggle.

---

## 🧪 Testing & Verification

```bash
# 1. Main End-to-End Chat & Multimodal Test:
python test_phase3_e2e.py

# 2. AI Interviewer Stage 1 (Core Lifecycle & State Machine):
python test_interview_smoke.py

# 3. AI Interviewer Stage 2 (Adaptive Probing & Dynamic Difficulty):
python test_stage2_adaptive.py

# 4. AI Interviewer Stage 3 (Track Rubrics & Specialized Modes):
python test_stage3_tracks.py

# 5. AI Interviewer Stage 4 (AST Secure Isolated Coding Sandbox):
python test_stage4_coding_sandbox.py

# 6. AI Interviewer Stage 5 (Teach-Back, Spaced Repetition & Report Export):
python test_stage5_teach_back_report.py

# 7. Audio & Voice Transcription Pipeline Test:
python test_voice_pipeline.py
```

Test coverage:
- `✓ Health Check & Model Catalog`
- `✓ Bcrypt Registration & JWT Login`
- `✓ Google OAuth Sign-In`
- `✓ Guest Seamless Session`
- `✓ Multi-format Document Ingestion & Chunking`
- `✓ Real-time SSE Chat Streaming with RAG Citations`
- `✓ Free Image Generation (FLUX.1-schnell / Pollinations fallback)`
- `✓ Free Vision & OCR (GPT OSS 120B Vision)`
- `✓ AI Interviewer Suite (Stages 1-5 Complete)`:
  - `Stage 1`: Session lifecycle, durable idempotency, state machine & database schemas
  - `Stage 2`: Adaptive intelligence, rolling difficulty scaling, contextual follow-up probing & Groq Whisper STT
  - `Stage 3`: Specialized track personas (Technical, Coding, HR STAR, Behavioral, Viva Voce, Placement) with normalized 5-dimension rubrics
  - `Stage 4`: AST security auditing, isolated ephemeral code execution sandbox & interactive test-runner
  - `Stage 5`: Teach-After-Interview coaching, spaced repetition review timers, peer banding & markdown report download

---

## 📁 Project Structure

```text
LLM-XRAY_PROJECT/
├── client/                     # Next.js 16 + React 19 + TypeScript Frontend
│   ├── src/
│   │   ├── app/                # App router (page.tsx, layout.tsx, globals.css)
│   │   ├── components/         # Sidebar, Navbar, ChatArea, ChatInput, InterviewerModal, Modals
│   │   │                       # GoogleOAuthWrapper (real Google sign-in)
│   │   ├── context/            # AuthContext (JWT & session state), ThemeContext
│   │   ├── lib/                # API client (chat, voice, interviews), audioRecorder.ts
│   │   └── types/              # Strict TypeScript interfaces (Session, Turn, Evaluation)
│   ├── .env.local              # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
│   └── package.json
│
├── server/                     # FastAPI Python Backend
│   ├── alembic/                # Database migrations & revision history
│   └── app/
│       ├── api/                # auth.py, chat.py, documents.py, interviews.py, voice.py
│       ├── core/               # config.py, security.py (JWT & password hashing)
│       ├── db/                 # session.py (SQLAlchemy engine & Base)
│       ├── models/             # entities.py (User, Session, Turn, Evaluation, IdempotencyRecord)
│       ├── schemas/            # schemas.py (Pydantic v2 schemas)
│       ├── services/           # llm_service.py (Groq + Gemini fallback), interview_service.py
│       │                       # code_sandbox.py (AST static security & ephemeral execution)
│       │                       # rag_service.py (Document chunking & vector search)
│       └── main.py             # FastAPI application entry point
│
├── alembic.ini                 # Alembic migration configuration
├── run_phase3.bat              # 1-Click Windows launcher for both servers
├── run_backend.bat             # FastAPI backend runner script
├── run_frontend.bat            # Next.js frontend runner script
├── test_phase3_e2e.py          # Automated verification test suite
├── test_interview_smoke.py     # Stage 1 E2E verification test suite
├── test_stage2_adaptive.py     # Stage 2 Adaptive Probing verification suite
├── test_stage3_tracks.py       # Stage 3 Track Rubrics verification suite
├── test_stage4_coding_sandbox.py # Stage 4 Code Sandbox verification suite
├── test_stage5_teach_back_report.py # Stage 5 Teach-Back & Report Export suite
├── test_voice_pipeline.py      # Speech-to-text pipeline test suite
├── .env                        # Environment configuration (Groq, Google, HF, DB)
└── README.md                   # Project documentation
```
