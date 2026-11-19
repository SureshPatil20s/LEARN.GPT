'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ChatArea from '@/components/ChatArea';
import ChatInput from '@/components/ChatInput';
import AuthModal from '@/components/AuthModal';
import DocumentModal from '@/components/DocumentModal';
import PersonaModal from '@/components/PersonaModal';
import PromptLibraryModal from '@/components/PromptLibraryModal';
import SettingsModal from '@/components/SettingsModal';
import LearningModePanel, { LearningMode } from '@/components/LearningModePanel';
import QuizModal, { QuizQuestion } from '@/components/QuizModal';
import InterviewerModal from '@/components/InterviewerModal';
import { getLearningModeSystemPrompt, buildQuizGenerationPrompt, parseQuizResponse } from '@/lib/learningMode';
import { useAuth } from '@/context/AuthContext';
import {
  createConversation,
  deleteConversation,
  getAvailableModels,
  getConversation,
  getConversations,
  getDocuments,
  getPersonas,
  createPersona,
  deletePersona,
  getPromptTemplates,
  createPromptTemplate,
  deletePromptTemplate,
  getMemories,
  createMemory,
  toggleMemory,
  deleteMemory,
  clearAllMemories,
  streamMessage,
  submitMessageFeedback,
  updateConversation,
  uploadDocument,
  uploadDocumentToConversation,
  deleteDocument,
  checkBackendHealth,
} from '@/lib/api';
import { AppSettings, Conversation, DocumentItem, MemoryItem, Message, ModelOption, Persona, PromptTemplate, RagSource } from '@/types';

export default function Home() {
  const { user } = useAuth();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [useRag, setUseRag] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [docModalOpen, setDocModalOpen] = useState<boolean>(false);
  const [personaModalOpen, setPersonaModalOpen] = useState<boolean>(false);
  const [promptModalOpen, setPromptModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [learningModePanelOpen, setLearningModePanelOpen] = useState<boolean>(false);
  const [quizModalOpen, setQuizModalOpen] = useState<boolean>(false);
  const [interviewerModalOpen, setInterviewerModalOpen] = useState<boolean>(false);
  const [learningMode, setLearningMode] = useState<LearningMode>('standard');
  const [backendOffline, setBackendOffline] = useState<boolean>(false);

  // App Settings & Cross-Chat Memory
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    use_rag: false,
    use_web_search: false,
    use_memory: true,
    temperature: 0.7,
    max_tokens: 2048,
    default_model: 'auto',
    custom_system_prompt: '',
    show_interviewer: false,
  });

  // Personas & Prompt Library state
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [injectedPromptText, setInjectedPromptText] = useState<string>('');

  // Streaming state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingSources, setStreamingSources] = useState<RagSource[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Settings from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('learn_gpt_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Force RAG to stay OFF by default on load/refresh until user explicitly enables it for a chat
        parsed.use_rag = false;
        setSettings((prev) => ({ ...prev, ...parsed, use_rag: false }));
        if (parsed.default_model) setSelectedModel(parsed.default_model);
      }
    } catch {}
    setUseRag(false); // Strictly OFF by default
  }, []);

  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('learn_gpt_settings', JSON.stringify(next));
      } catch {}
      if (updates.default_model) setSelectedModel(updates.default_model);
      if (typeof updates.use_rag === 'boolean') setUseRag(updates.use_rag);
      return next;
    });
  };

  const refreshMemories = useCallback(async () => {
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  }, []);

  // Load Models & Check Backend Connectivity
  useEffect(() => {
    getAvailableModels()
      .then((data) => {
        setModels(data);
        const def = data.find((m) => m.is_default);
        if (def) setSelectedModel(def.id);
      })
      .catch(() => {});

    // Dynamic backend health check
    checkBackendHealth()
      .then((isHealthy) => setBackendOffline(!isHealthy))
      .catch(() => setBackendOffline(true));
  }, []);

  // Load Conversations and Documents on mount / user change
  const refreshConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [activeConversationId]);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  const refreshPersonas = useCallback(async () => {
    try {
      const data = await getPersonas();
      setPersonas(data);
      if (data.length > 0 && !activePersona) {
        setActivePersona(data[0]); // default to General Assistant
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    }
  }, [activePersona]);

  const refreshPromptTemplates = useCallback(async () => {
    try {
      const data = await getPromptTemplates();
      setPromptTemplates(data);
    } catch (err) {
      console.error('Failed to load prompt templates:', err);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshDocuments();
    refreshPersonas();
    refreshPromptTemplates();
    refreshMemories();
  }, [user, refreshConversations, refreshDocuments, refreshPersonas, refreshPromptTemplates, refreshMemories]);

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    getConversation(activeConversationId)
      .then(({ messages: loadedMessages }) => {
        setMessages(loadedMessages);
      })
      .catch((err) => console.error('Failed to load messages:', err));
  }, [activeConversationId]);

  // Create New Chat (inherits active persona/system prompt)
  const handleNewChat = async () => {
    try {
      setUseRag(false); // Reset RAG to OFF by default for every new chat
      const newConv = await createConversation(
        'New Chat',
        selectedModel,
        activePersona?.system_prompt,
        activePersona?.id
      );
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await updateConversation(id, { title: newTitle });
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  // Toggle Pin Conversation
  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      const updated = await updateConversation(id, { is_pinned: isPinned });
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };

  // Upload Document
  const handleUploadDocument = async (file: File) => {
    const uploaded = await uploadDocument(file);
    setDocuments((prev) => [uploaded, ...prev]);
  };

  // Delete Document
  const handleDeleteDocument = async (id: string) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Quiz Generator Callback
  const handleGenerateQuiz = async (topic: string, numQuestions: number): Promise<QuizQuestion[]> => {
    let convId = activeConversationId;
    if (!convId) {
      const newConv = await createConversation(`Quiz: ${topic.slice(0, 24)}`, selectedModel);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      convId = newConv.id;
    }

    const quizPrompt = buildQuizGenerationPrompt(topic, numQuestions);
    let fullResponse = '';

    await streamMessage({
      conversationId: convId,
      content: quizPrompt,
      model: selectedModel,
      useRag: true,
      useWebSearch: false,
      useMemory: false,
      temperature: 0.3,
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onDone: (final) => {
        fullResponse = final;
      },
      onError: (err) => {
        console.error('Quiz generation error:', err);
      },
    });

    return parseQuizResponse(fullResponse);
  };

  // Send Message & Stream (Instant Lag-Free Optimistic Rendering)
  const handleSendMessage = async (content: string, attachedFile?: File, imageDataUrl?: string) => {
    if (!content.trim() && !attachedFile && !imageDataUrl) return;
    if (isStreaming) return; // Prevent concurrent requests collisions

    let convId = activeConversationId;
    const isImageFile = attachedFile && attachedFile.name.match(/\.(png|jpg|jpeg|webp)$/i);

    // 1. Instantly display user message in chat (0ms lag! Never vanishes!)
    const displayContent = imageDataUrl
      ? `![Attached Image](${imageDataUrl})\n\n${content || 'Please extract all text (OCR) from this image and summarize its content.'}`
      : attachedFile
      ? `📄 **[Attached Document: ${attachedFile.name}]**\n\n${content || 'Please explain the contents of this document.'}`
      : content;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: convId || 'pending',
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Instantly activate streaming indicator so screen never goes blank
    setIsStreaming(true);
    setStreamingSources([]);
    if (attachedFile && !isImageFile) {
      setStreamingContent(`📄 Indexing "${attachedFile.name}" into RAG knowledge base...\n\nPlease wait a moment while the document is chunked and analyzed.`);
    } else {
      setStreamingContent('');
    }

    // 3. Auto-create conversation if none is active
    if (!convId) {
      try {
        const titleSnippet = content.trim().slice(0, 30) || (imageDataUrl ? 'Image OCR Analysis' : 'New Chat');
        const newConv = await createConversation(
          titleSnippet,
          selectedModel,
          activePersona?.system_prompt,
          activePersona?.id
        );
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        convId = newConv.id;
        userMsg.conversation_id = newConv.id;
      } catch (err) {
        console.error('Failed to auto-create conversation:', err);
        setIsStreaming(false);
        setStreamingContent('');
        return;
      }
    }

    // 4. Upload attached document if present (user already sees their prompt on screen!)
    let attachedName: string | undefined = undefined;
    if (attachedFile && !isImageFile) {
      try {
        // Try the conversation-specific upload endpoint first (returns structured metadata)
        const uploadResult = await uploadDocumentToConversation(convId!, attachedFile);
        attachedName = uploadResult.filename;
        setStreamingContent(''); // Clear indexing notice as stream starts
      } catch {
        // Fallback to the general upload endpoint
        try {
          await uploadDocument(attachedFile, convId!);
          attachedName = attachedFile.name;
          setStreamingContent('');
        } catch (err: any) {
          console.error('Attachment upload failed:', err);
          setStreamingContent('');
          alert(`Failed to index file: ${err.message}`);
        }
      }
    }

    // 5. Begin streaming completion with learning mode, persistent memory and web search parameters
    let collectedSources: RagSource[] = [];
    const modePrompt = getLearningModeSystemPrompt(learningMode);
    const effectiveSystemPrompt = modePrompt
      ? `${modePrompt}\n\n${activePersona?.system_prompt || ''}`
      : activePersona?.system_prompt;

    await streamMessage({
      conversationId: convId,
      content,
      model: selectedModel,
      useRag: attachedName ? true : useRag,
      useWebSearch: settings.use_web_search,
      useMemory: settings.use_memory,
      temperature: settings.temperature,
      maxTokens: settings.max_tokens,
      imageData: imageDataUrl,
      attachedFilename: attachedName,
      systemPrompt: effectiveSystemPrompt,
      onChunk: (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      onSources: (sources) => {
        collectedSources = sources;
        setStreamingSources(sources);
      },
      onDone: (fullContent) => {
        const assistantMsg: Message = {
          id: `msg-${Date.now()}`,
          conversation_id: convId!,
          role: 'assistant',
          content: fullContent,
          model: selectedModel,
          sources: collectedSources,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingSources([]);
        refreshConversations();
        // Sync messages from DB to guarantee correct chronological order and deduplication
        if (convId) {
          getConversation(convId)
            .then(({ messages: synced, conversation }) => {
              setMessages(synced);
              // Also update title in conversation list if changed
              if (conversation?.title) {
                setConversations((prev) =>
                  prev.map((c) => (c.id === convId ? { ...c, title: conversation.title } : c))
                );
              }
            })
            .catch(() => {});

          // Refresh conversations to update order / intelligent titles
          if (user && user.provider !== 'guest') {
            getConversations()
              .then(setConversations)
              .catch(() => {});
          }
        }
      },
      onError: (err) => {
        console.error('Streaming error:', err);
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          conversation_id: convId!,
          role: 'assistant',
          content: `⚠️ **Error receiving response:** ${err.message}`,
          model: selectedModel,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsStreaming(false);
        setStreamingContent('');
      },
    });
  };

  // Regenerate Response
  const handleRegenerate = async () => {
    if (messages.length === 0 || isStreaming) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Pop the last assistant message
    setMessages((prev) => {
      const idx = prev.map((m) => m.role).lastIndexOf('assistant');
      if (idx !== -1) {
        return prev.slice(0, idx);
      }
      return prev;
    });

    handleSendMessage(lastUserMsg.content);
  };

  // Feedback (Thumbs Up / Down)
  const handleFeedback = async (messageId: string, rating: 'like' | 'dislike') => {
    try {
      await submitMessageFeedback(messageId, rating);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m))
      );
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  // Clear All Conversation History
  const handleClearHistory = async () => {
    try {
      for (const c of conversations) {
        await deleteConversation(c.id).catch(() => {});
      }
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        onOpenDocuments={() => setDocModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        onOpenInterviewer={() => setInterviewerModalOpen(true)}
        onOpenLearningMode={() => setLearningModePanelOpen(true)}
        onOpenPersonas={() => setPersonaModalOpen(true)}
        onOpenPromptLibrary={() => setPromptModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Navbar */}
        <Navbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          useRag={useRag}
          onToggleRag={() => setUseRag((prev) => !prev)}
          useWebSearch={settings.use_web_search}
          onToggleWebSearch={() => handleUpdateSettings({ use_web_search: !settings.use_web_search })}
          docCount={documents.length}
          onOpenDocuments={() => setDocModalOpen(true)}
          activePersona={activePersona}
          onOpenPersonas={() => setPersonaModalOpen(true)}
          onOpenPromptLibrary={() => setPromptModalOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
          learningMode={learningMode}
          onOpenLearningMode={() => setLearningModePanelOpen(true)}
          onOpenQuiz={() => setQuizModalOpen(true)}
          onOpenInterviewer={settings.show_interviewer ? () => setInterviewerModalOpen(true) : undefined}
        />

        {/* Backend Offline Notice */}
        {backendOffline && (
          <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between z-30">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ FastAPI Backend Offline:</span>
              <span>FastAPI is not running on port 8000. Launch <code className="bg-amber-900/60 px-1.5 py-0.5 rounded text-white font-mono">run_backend.bat</code> or <code className="bg-amber-900/60 px-1.5 py-0.5 rounded text-white font-mono">run_phase3.bat</code> to connect.</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-semibold text-[11px] transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Chat Feed */}
        <ChatArea
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          streamingSources={streamingSources}
          onRegenerate={handleRegenerate}
          onSelectPrompt={(prompt) => handleSendMessage(prompt)}
          onFeedback={handleFeedback}
        />

        {/* Bottom Input Dock */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onStopStreaming={() => setIsStreaming(false)}
          externalText={injectedPromptText}
          onClearExternalText={() => setInjectedPromptText('')}
          conversationId={activeConversationId || undefined}
        />
      </div>

      {/* Modals */}
      <AuthModal />
      <DocumentModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        documents={documents}
        onUpload={handleUploadDocument}
        onDelete={handleDeleteDocument}
      />
      <PersonaModal
        isOpen={personaModalOpen}
        onClose={() => setPersonaModalOpen(false)}
        personas={personas}
        activePersonaId={activePersona?.id}
        onSelectPersona={(p) => setActivePersona(p)}
        onCreatePersona={async (data) => {
          const created = await createPersona(data);
          setPersonas((prev) => [created, ...prev]);
          setActivePersona(created);
        }}
        onDeletePersona={async (id) => {
          await deletePersona(id);
          setPersonas((prev) => prev.filter((p) => p.id !== id));
          if (activePersona?.id === id) {
            setActivePersona(personas[0] || null);
          }
        }}
      />
      <PromptLibraryModal
        isOpen={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        templates={promptTemplates}
        onUsePrompt={(filledPrompt) => {
          setInjectedPromptText(filledPrompt);
        }}
        onCreateTemplate={async (data) => {
          const created = await createPromptTemplate(data);
          setPromptTemplates((prev) => [created, ...prev]);
        }}
        onDeleteTemplate={async (id) => {
          await deletePromptTemplate(id);
          setPromptTemplates((prev) => prev.filter((t) => t.id !== id));
        }}
      />
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        memories={memories}
        onAddMemory={async (content, category) => {
          const created = await createMemory(content, category);
          setMemories((prev) => [created, ...prev]);
        }}
        onToggleMemory={async (id) => {
          const updated = await toggleMemory(id);
          setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
        }}
        onDeleteMemory={async (id) => {
          await deleteMemory(id);
          setMemories((prev) => prev.filter((m) => m.id !== id));
        }}
        onClearAllMemories={async () => {
          await clearAllMemories();
          setMemories([]);
        }}
        models={models}
        onClearHistory={handleClearHistory}
      />
      <LearningModePanel
        isOpen={learningModePanelOpen}
        onClose={() => setLearningModePanelOpen(false)}
        currentMode={learningMode}
        onSelectMode={(mode) => {
          setLearningMode(mode);
          if (mode === 'quiz') {
            setQuizModalOpen(true);
          }
        }}
      />
      <QuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onGenerateQuiz={handleGenerateQuiz}
      />
      <InterviewerModal
        isOpen={interviewerModalOpen}
        onClose={() => setInterviewerModalOpen(false)}
        documents={documents}
      />
    </div>
  );
}
