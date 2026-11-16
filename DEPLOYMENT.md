# LEARN.GPT — Cloud Deployment Guide (Free Tier)

This guide documents the complete step-by-step process for deploying **LEARN.GPT** to free cloud hosting providers with continuous automated deployment on `git push`:

| Layer | Free Cloud Provider | Purpose |
| :--- | :--- | :--- |
| **Frontend** | **Vercel** | Next.js 16 (App Router) + React 19 + Tailwind CSS |
| **Backend** | **Render** | FastAPI ASGI Web Service with auto-deploy on push |
| **Database** | **Supabase** | Managed PostgreSQL (500 MB free storage, SSL enabled) |
| **Authentication** | **Firebase Auth** | Google OAuth & Email/Password authentication |
| **AI Inference** | **Groq + Google AI Studio** | LPU speed inference & Gemini multimodal free tiers |
| **RAG & Storage** | **Supabase PostgreSQL** | 100% database-persisted text chunks & 384-d vector embeddings |

---

## 1. Prerequisites & Accounts (All 100% Free)

Ensure you have free accounts created on:
1. **GitHub** ([github.com](https://github.com)) — holds your repository.
2. **Supabase** ([supabase.com](https://supabase.com)) — free managed PostgreSQL.
3. **Render** ([render.com](https://render.com)) — free Python web service hosting.
4. **Vercel** ([vercel.com](https://vercel.com)) — free Next.js frontend hosting.
5. **Firebase Console** ([console.firebase.google.com](https://console.firebase.google.com)) — existing authentication project.
6. **Google AI Studio** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) — free Gemini API key.
7. **Groq Cloud** ([console.groq.com/keys](https://console.groq.com/keys)) — free Groq API key.

---

## 2. Step 1: Set Up Supabase PostgreSQL Database

1. Log in to [Supabase](https://supabase.com/dashboard) and click **"New Project"**.
2. Fill in:
   - **Name:** `learn-gpt-db`
   - **Database Password:** Enter a strong password and save it securely.
   - **Region:** Choose a region close to your target users (e.g., `US East` or `Central Europe`).
3. Once the database is provisioned (~2 minutes), navigate to:
   - **Project Settings (⚙️) → Database → Connection String**.
4. Select the **URI** tab:
   - **Mode:** Select **Session** (Port `5432`) or **Direct connection** (Port `5432`).
   - The connection string will look like:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
     ```
   - Replace `[YOUR-PASSWORD]` with your actual database password.
   - Ensure `?sslmode=require` is present at the end of the URL.
5. Save this URI; you will pass it to Render as `DATABASE_URL`.

---

## 3. Step 2: Initialize Database Tables via Alembic

Before launching the backend, run the initial schema migration so your Supabase database is populated with all tables.

From your local machine terminal:
```bash
# 1. Set your remote Supabase connection string temporarily
$env:DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"

# 2. Run Alembic upgrade head to build the schema
alembic upgrade head
```
*(On Linux/macOS, use `export DATABASE_URL="..."` instead of `$env:DATABASE_URL=...`)*

All 13 core relational tables (`users`, `conversations`, `messages`, `documents`, `document_chunks`, `image_generation_logs`, `memories`, `personas`, `prompt_templates`, `interview_sessions`, `interview_turns`, `interview_evaluations`, `idempotency_records`) will be created in Supabase with indexes and foreign keys.

---

## 4. Step 3: Deploy Backend on Render

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **"New +" → "Web Service"**.
3. Connect your GitHub repository: `LLM-XRAY_PROJECT`.
4. Configure the web service:
   - **Name:** `learn-gpt-backend` (or a name of your choice)
   - **Region:** Choose the region matching or closest to your Supabase region (e.g. `Oregon (US West)` or `Frankfurt (EU)`).
   - **Branch:** `main` (or your active default branch)
   - **Root Directory:** Leave blank (defaults to repository root).
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     python -m uvicorn server.app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free` (0.5 CPU, 512 MB RAM)

5. Under **Advanced Settings**:
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** `Yes` (automatically rebuilds and redeploys on every `git push`)

6. Under **Environment Variables**, add the following:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `ENVIRONMENT` | `production` | Enables production mode and strict CORS |
   | `DATABASE_URL` | `postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres?sslmode=require` | Supabase PostgreSQL URI |
   | `SECRET_KEY` | *(Click "Generate" or enter a 32+ char random string)* | JWT encryption secret |
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini Studio key |
   | `GROQ_API_KEY` | `gsk_...` | Your Groq LPU key |
   | `FRONTEND_URL` | `https://your-frontend-app.vercel.app` | *(Fill this in after Step 4, or enter your planned Vercel URL)* |
   | `HF_TOKEN` | *(Optional)* | HuggingFace token for FLUX image generator |

7. Click **"Create Web Service"**.
8. Wait for the build and deployment to complete (~3–5 minutes).
9. Copy your public Render URL:
   `https://learn-gpt-backend.onrender.com`
10. Verify by visiting `https://learn-gpt-backend.onrender.com/health` in your browser. You should receive:
    ```json
    {
      "status": "healthy",
      "service": "LEARN.GPT Platform",
      "default_model": "auto",
      "groq_configured": true
    }
    ```

---

## 5. Step 4: Deploy Frontend on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..." → "Project"**.
3. Import your GitHub repository: `LLM-XRAY_PROJECT`.
4. In the Project Configuration screen:
   - **Project Name:** `learn-gpt` (or custom name)
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and select **`client`** *(Crucial: Next.js is inside the `client` folder)*.
5. In **Build and Output Settings**:
   - **Build Command:** `next build` (leave default)
   - **Output Directory:** `.next` (leave default)
   - **Install Command:** `npm install` (leave default)

6. In **Environment Variables**, add:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://learn-gpt-backend.onrender.com/api/v1` | **Must include `/api/v1`** |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | From Firebase Web App Config |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-app.firebaseapp.com` | From Firebase Web App Config |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `your-app` | From Firebase Web App Config |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| `your-app.firebasestorage.app` | From Firebase Web App Config |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | From Firebase Web App Config |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123...:web:...` | From Firebase Web App Config |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | *(Optional, if using Google OAuth popup)* |

7. Click **"Deploy"**.
8. Vercel will run `npm install` and `next build`. Once finished (~1 minute), Vercel will assign you a live URL:
   `https://learn-gpt-suresh.vercel.app`

---

## 6. Step 5: Final Cross-Service Wiring

Now that both services have their live URLs:

### 1. Update Render `FRONTEND_URL`
- Go to **Render Dashboard → learn-gpt-backend → Environment**.
- Set `FRONTEND_URL` to your exact Vercel URL (e.g. `https://learn-gpt-suresh.vercel.app`, no trailing slash).
- Save changes. Render will perform an instant zero-downtime hot reload.

### 2. Whitelist Vercel Domain in Firebase Console
- Open **[Firebase Console](https://console.firebase.google.com) → Your Project**.
- In the left sidebar, click **Build → Authentication**.
- Click the **Settings** tab at the top.
- Select **Authorized Domains**.
- Click **"Add domain"** and enter your Vercel domain:
  `learn-gpt-suresh.vercel.app`
- Click **Save**.
*(If this step is skipped, Google sign-in popups will display `auth/unauthorized-domain` error).*

---

## 7. RAG Vector Storage & Persistence Verification

- **Uploaded Documents & Chunks:**
  When a candidate or user uploads a PDF/DOCX/TXT file:
  - Document metadata is stored in `documents` in Supabase PostgreSQL.
  - Chunked text is saved in `document_chunks.content` in Supabase PostgreSQL.
  - 384-dimensional dense vector embeddings generated by SentenceTransformers are stored in `document_chunks.embedding_json` in Supabase PostgreSQL.
- **Stateless Execution:**
  Because all text and vector embeddings are stored in PostgreSQL, **Render container shutdowns or redeployments cause zero data loss**. When a query occurs, FAISS loads the user's vector embeddings into memory on the fly and performs cosine ranking in $<1\text{ms}$.

---

## 8. Free-Tier Quirks & Cold-Start Behavior

| Platform | Free-Tier Behavior | Impact & Mitigation |
| :--- | :--- | :--- |
| **Render** | Spins down after **15 minutes of inactivity**. | The first API request after sleep takes **30–45 seconds** to cold-boot. The frontend displays a smooth connection badge and handles the cold start gracefully. Once awake, response latency is $<1\text{s}$. |
| **Supabase** | Pauses inactive databases after **7 days without queries**. | Logging in or querying once a week keeps it active. Includes 500 MB database storage (plenty for 10 users). |
| **Groq LPU** | Free tier rate-limited to ~30 requests/min. | The multi-model router in `llm_service.py` automatically handles 429s by falling back to Gemini and resetting smoothly. |
| **Google Gemini** | Free tier rate-limited to 15 requests/min. | The built-in circuit breaker temporarily routes overflow traffic to Groq LPU until Gemini quota resets. |

---

## 9. Continuous Automated Deployments (`git push`)

Continuous integration and deployment is already fully active:
- **Pushing code to GitHub (`git push origin main`)**:
  1. **Vercel** automatically detects changes in `client/`, runs `npm run build`, and updates the frontend in ~45 seconds.
  2. **Render** automatically detects changes in `server/` or `requirements.txt`, rebuilds the Python container, and hot-swaps the ASGI server with zero downtime.
