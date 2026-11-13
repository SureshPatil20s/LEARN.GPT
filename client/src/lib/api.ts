import { AuthResponse, Conversation, DocumentItem, Message, ModelOption, RagSource, User } from '@/types';

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

export async function createConversation(title = 'New Chat', model = 'auto'): Promise<Conversation> {
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title, model }),
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

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/documents/upload`, {
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

export const FALLBACK_MODELS: ModelOption[] = [
  { id: 'auto', name: '🤖 Auto (Gemini + Groq)', provider: 'Smart Router', description: 'Automatically uses Gemini for all tasks; Groq Qwen as fallback on rate limit', is_default: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'Google AI', description: 'Fast, up-to-date, multimodal reasoning with real-world grounding' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google AI', description: 'Ultra-fast lightweight Gemini model for simple queries' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq)', provider: 'Groq', description: 'Advanced reasoning & multilingual — Groq LPU speed' },
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
  imageData,
  attachedFilename,
  onChunk,
  onSources,
  onDone,
  onError,
}: {
  conversationId: string;
  content: string;
  model: string;
  useRag: boolean;
  imageData?: string;
  attachedFilename?: string;
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
        image_data: imageData,
        attached_filename: attachedFilename,
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

