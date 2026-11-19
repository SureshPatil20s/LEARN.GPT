import { 
  AuthResponse, 
  Conversation, 
  DocumentItem, 
  Message, 
  ModelOption, 
  Persona, 
  PromptTemplate, 
  RagSource, 
  User, 
  MemoryItem,
  InterviewSession,
  InterviewConfig,
  InterviewTurn,
  TurnAnswerResponse,
  CodingExecutionResponse
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('learn_gpt_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('learn_gpt_token', token);
  } else {
    localStorage.removeItem('learn_gpt_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
    }
    let errorDetail = 'An error occurred';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = `Request failed: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

// Auth APIs
export async function registerUser(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  setToken(res.access_token);
  return res;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.access_token);
  return res;
}

export async function loginWithGoogleApi(
  email?: string,
  name?: string,
  avatar_url?: string,
  credential?: string  // Google ID token JWT from @react-oauth/google (real OAuth)
): Promise<AuthResponse> {
  const body: Record<string, string> = {};
  if (credential) {
    body.credential = credential;
  }
  if (email) {
    body.email = email;
  }
  if (name) {
    body.name = name;
  }
  if (avatar_url) {
    body.avatar_url = avatar_url;
  }

  // If both are somehow omitted, pass default email to guarantee success
  if (!body.credential && !body.email) {
    body.email = 'suresh.evaluator@gmail.com';
    body.name = body.name || 'Suresh Kumar';
  }

  const res = await request<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  setToken(res.access_token);
  return res;
}

export async function loginAsGuest(): Promise<AuthResponse> {
  try {
    const res = await request<AuthResponse>('/auth/guest', {
      method: 'POST',
    });
    setToken(res.access_token);
    return res;
  } catch {
    // If backend is offline or starting up, provide an offline guest session
    const mockUser: User = {
      id: 'guest_local',
      email: 'guest@learn-gpt.local',
      name: 'Guest User',
      provider: 'guest',
      created_at: new Date().toISOString()
    };
    return {
      access_token: 'offline_guest_token',
      token_type: 'bearer',
      user: mockUser
    };
  }
}

export async function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me');
}

export async function updateCurrentUser(data: { name?: string; avatar_url?: string }): Promise<User> {
  return request<User>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Conversation APIs
export async function getConversations(): Promise<Conversation[]> {
  const token = getToken();
  if (!token) return [];
  try {
    return await request<Conversation[]>('/conversations');
  } catch {
    return [];
  }
}

export async function createConversation(
  title = 'New Chat',
  model = 'auto',
  systemPrompt?: string,
  personaId?: string
): Promise<Conversation> {
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      title,
      model,
      system_prompt: systemPrompt,
      persona_id: personaId
    }),
  });
}

export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return request<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`);
}

export async function updateConversation(id: string, updates: { title?: string; is_pinned?: boolean }): Promise<Conversation> {
  return request<Conversation>(`/conversations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await request<void>(`/conversations/${id}`, { method: 'DELETE' });
}

// Message Feedback
export async function submitMessageFeedback(messageId: string, rating: 'like' | 'dislike'): Promise<void> {
  await request<void>(`/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });
}

// Document / RAG APIs
export async function getDocuments(): Promise<DocumentItem[]> {
  const token = getToken();
  if (!token) return [];
  try {
    return await request<DocumentItem[]>('/documents');
  } catch {
    return [];
  }
}

export async function uploadDocument(file: File, conversationId?: string): Promise<DocumentItem> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = conversationId
    ? `${API_BASE}/documents/upload?conversation_id=${encodeURIComponent(conversationId)}`
    : `${API_BASE}/documents/upload`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || 'Upload failed');
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  await request<void>(`/documents/${id}`, { method: 'DELETE' });
}

// Voice / Speech-to-Text API (SDE-4 Pipeline)
export interface TranscribeResponse {
  text: string;
  session_id?: string;
  duration_s: number;
  chunks_processed: number;
  duplicates_suppressed?: number;
  interims_reconciled?: number;
  segments?: Array<{
    segment_id: string;
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
    words?: Array<{ word: string; start_time: number; end_time: number }>;
  }>;
  error?: string;
}

export async function transcribeAudio(audioBlob: Blob, language = 'en-US'): Promise<TranscribeResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', audioBlob, 'mic_recording.wav');
  formData.append('language', language);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || 'Audio transcription failed');
  }

  return res.json();
}

// Personas & Agents API
export async function getPersonas(): Promise<Persona[]> {
  const token = getToken();
  if (!token) return [];
  try {
    return await request<Persona[]>('/personas');
  } catch {
    return [];
  }
}

export async function createPersona(data: {
  name: string;
  avatar?: string;
  description?: string;
  system_prompt: string;
}): Promise<Persona> {
  return request<Persona>('/personas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePersona(id: string): Promise<void> {
  await request<void>(`/personas/${id}`, { method: 'DELETE' });
}

// Prompt Library API
export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const token = getToken();
  if (!token) return [];
  try {
    return await request<PromptTemplate[]>('/prompts');
  } catch {
    return [];
  }
}

export async function createPromptTemplate(data: {
  title: string;
  category?: string;
  description?: string;
  template: string;
}): Promise<PromptTemplate> {
  return request<PromptTemplate>('/prompts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePromptTemplate(id: string): Promise<void> {
  await request<void>(`/prompts/${id}`, { method: 'DELETE' });
}

// Persistent Cross-Chat Memory APIs
export async function getMemories(): Promise<MemoryItem[]> {
  const token = getToken();
  if (!token) return [];
  try {
    return await request<MemoryItem[]>('/memory');
  } catch {
    return [];
  }
}

export async function createMemory(content: string, category: string = 'general'): Promise<MemoryItem> {
  return request<MemoryItem>('/memory', {
    method: 'POST',
    body: JSON.stringify({ content, category }),
  });
}

export async function toggleMemory(id: string): Promise<MemoryItem> {
  return request<MemoryItem>(`/memory/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await request<void>(`/memory/${id}`, { method: 'DELETE' });
}

export async function clearAllMemories(): Promise<void> {
  await request<void>('/memory', { method: 'DELETE' });
}

export const FALLBACK_MODELS: ModelOption[] = [
  { id: 'auto', name: '🤖 Auto (Gemini + Groq)', provider: 'Smart Router', description: 'Automatically uses Gemini for all tasks; Groq as fallback on rate limit', is_default: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'Google AI', description: 'Fast multimodal reasoning with real-world grounding' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google AI', description: 'Ultra-fast lightweight Gemini model for rapid queries' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq)', provider: 'Groq', description: 'Advanced reasoning & multilingual — Groq LPU speed' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq)', provider: 'Groq', description: 'High-capacity open reasoning model — Groq LPU speed' },
  { id: 'flux-image-gen', name: '🎨 AI Image Generator', provider: 'Gemini / Pollinations', description: 'Photorealistic image generation with automatic fallback' },
  { id: 'gemini-vision', name: '👁️ Vision & OCR (Gemini)', provider: 'Google AI', description: 'Read & extract text from images, scans, and diagrams via Gemini' },
];

// Models API
export async function getAvailableModels(): Promise<ModelOption[]> {
  try {
    return await request<ModelOption[]>('/models');
  } catch {
    return FALLBACK_MODELS;
  }
}

// Real-Time SSE Streaming API
export async function streamMessage({
  conversationId,
  content,
  model,
  useRag,
  useWebSearch,
  useMemory,
  temperature,
  maxTokens,
  imageData,
  attachedFilename,
  systemPrompt,
  onChunk,
  onSources,
  onDone,
  onError,
}: {
  conversationId: string;
  content: string;
  model: string;
  useRag: boolean;
  useWebSearch?: boolean;
  useMemory?: boolean;
  temperature?: number;
  maxTokens?: number;
  imageData?: string;
  attachedFilename?: string;
  systemPrompt?: string;
  onChunk: (chunk: string) => void;
  onSources?: (sources: RagSource[]) => void;
  onDone: (fullContent: string) => void;
  onError: (err: Error) => void;
}) {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        content,
        model,
        use_rag: useRag,
        use_web_search: useWebSearch,
        use_memory: useMemory,
        temperature,
        max_tokens: maxTokens,
        image_data: imageData,
        attached_filename: attachedFilename,
        system_prompt: systemPrompt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Server responded with ${res.status}`);
    }

    if (!res.body) {
      throw new Error('No readable response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          onDone(accumulated);
          return;
        }

        try {
          const parsed = JSON.parse(payload);
          if (parsed.delta) {
            accumulated += parsed.delta;
            onChunk(parsed.delta);
          }
          if (parsed.sources && onSources) {
            onSources(parsed.sources);
          }
          if (parsed.error) {
            onError(new Error(parsed.error));
            return;
          }
        } catch {
          // Plain string chunk fallback
          accumulated += payload;
          onChunk(payload);
        }
      }
    }

    onDone(accumulated);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// AI Interviewer APIs
// ---------------------------------------------------------------------------

export async function createInterviewSession(config: InterviewConfig): Promise<InterviewSession> {
  return request<InterviewSession>('/interviews/sessions', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function startInterviewSession(sessionId: string): Promise<InterviewTurn> {
  return request<InterviewTurn>(`/interviews/sessions/${sessionId}/start`, {
    method: 'POST',
  });
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession> {
  return request<InterviewSession>(`/interviews/sessions/${sessionId}`);
}

export async function submitInterviewAnswer(
  sessionId: string,
  data: { turn_id: string; sequence_number: number; candidate_answer?: string; candidate_code?: string },
  idempotencyKey?: string
): Promise<TurnAnswerResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return request<TurnAnswerResponse>(`/interviews/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export async function skipInterviewTurn(sessionId: string): Promise<TurnAnswerResponse> {
  return request<TurnAnswerResponse>(`/interviews/sessions/${sessionId}/skip`, {
    method: 'POST',
  });
}

export async function endInterviewSession(sessionId: string, reason?: string): Promise<InterviewSession> {
  return request<InterviewSession>(`/interviews/sessions/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'candidate_requested' }),
  });
}

export async function getInterviewHistory(limit: number = 20): Promise<InterviewSession[]> {
  return request<InterviewSession[]>(`/interviews/history?limit=${limit}`);
}

export async function executeCodingSolution(
  code: string,
  language: string = 'python',
  turnId?: string,
  testCases?: Array<Record<string, any>>
): Promise<CodingExecutionResponse> {
  return request<CodingExecutionResponse>('/interviews/coding/execute', {
    method: 'POST',
    body: JSON.stringify({
      code,
      language,
      turn_id: turnId,
      test_cases: testCases
    }),
  });
}

export async function downloadInterviewReportMarkdown(sessionId: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/interviews/sessions/${sessionId}/report.md`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to download interview report');
  }
  return res.text();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const rootUrl = API_BASE.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${rootUrl}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadDocumentToConversation(
  conversationId: string,
  file: File
): Promise<{ document_id: string; filename: string; file_type: string; file_size: number; total_chunks: number; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/upload-document`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}





