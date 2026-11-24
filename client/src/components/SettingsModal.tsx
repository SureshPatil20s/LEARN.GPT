'use client';

import React, { useState } from 'react';
import { AppSettings, MemoryItem, ModelOption, Persona } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  X,
  Settings,
  Sun,
  Moon,
  Globe,
  Database,
  Brain,
  Sliders,
  Sparkles,
  Trash2,
  Plus,
  Check,
  ToggleLeft,
  ToggleRight,
  Eye,
  Mic,
  Cpu,
  User as UserIcon,
  Briefcase,
  GraduationCap,
  BookOpen,
  Bot,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  memories: MemoryItem[];
  onAddMemory: (content: string, category?: string) => Promise<void>;
  onToggleMemory: (id: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onClearAllMemories: () => Promise<void>;
  onAutoSummarizeMemories?: () => Promise<{ message: string; added_count: number; memories: MemoryItem[] }>;
  models: ModelOption[];
  onClearHistory: () => void;
  // Workspace Tool Launchers
  onOpenLearningMode?: () => void;
  onOpenInterviewer?: () => void;
  onOpenDocuments?: () => void;
  onOpenPersonas?: () => void;
  onOpenPromptLibrary?: () => void;
  docCount?: number;
  learningMode?: string;
  activePersona?: Persona | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  memories,
  onAddMemory,
  onToggleMemory,
  onDeleteMemory,
  onClearAllMemories,
  onAutoSummarizeMemories,
  models,
  onClearHistory,
  onOpenLearningMode,
  onOpenInterviewer,
  onOpenDocuments,
  onOpenPersonas,
  onOpenPromptLibrary,
  docCount = 0,
  learningMode = 'standard',
  activePersona,
}: SettingsModalProps) {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'workspace' | 'general' | 'model'>('workspace');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeFeedback, setSummarizeFeedback] = useState<string | null>(null);

  const handleAutoSummarize = async () => {
    if (!onAutoSummarizeMemories || isSummarizing) return;
    setIsSummarizing(true);
    setSummarizeFeedback(null);
    try {
      const res = await onAutoSummarizeMemories();
      setSummarizeFeedback(res.message);
      setTimeout(() => setSummarizeFeedback(null), 4000);
    } catch {
      setSummarizeFeedback('Could not scan conversations right now.');
      setTimeout(() => setSummarizeFeedback(null), 3000);
    } finally {
      setIsSummarizing(false);
    }
  };

  const getCategoryBadge = (cat?: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'personal':
        return { label: 'Personal', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'preference':
        return { label: 'Preference', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'goal':
        return { label: 'Goal', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'choice':
        return { label: 'Choice', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      default:
        return { label: 'Fact', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    }
  };

  if (!isOpen) return null;

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    setIsAddingMemory(true);
    try {
      await onAddMemory(newMemoryText.trim());
      setNewMemoryText('');
    } finally {
      setIsAddingMemory(false);
    }
  };

  const handleLaunchTool = (launcher?: () => void) => {
    if (launcher) {
      onClose();
      launcher();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[88vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Settings & Workspace Tools</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Access educational tools, configure workspace capabilities, and adjust model preferences
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4 shrink-0">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'workspace'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
          >
            Workspace & Tools
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${activeTab === 'general'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
          >
            <span>General & Personalization</span>
            {memories.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'general' ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-600 dark:text-purple-300'
                }`}>
                {memories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('model')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'model'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
          >
            Model & Parameters
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
          {/* TAB 1: WORKSPACE & TOOLS */}
          {activeTab === 'workspace' && (
            <div className="space-y-4">
              {/* Interactive Tools Suite */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                  Interactive AI Tools
                </div>

                {/* 1. Learning Modes */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between hover:border-emerald-500/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Educational Learning Modes</h4>
                        {learningMode !== 'standard' && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 capitalize">
                            {learningMode.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
                        Adaptive AI Tutor, Socratic Method discovery, Quiz Generator &amp; Visual Learning
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchTool(onOpenLearningMode)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Launch</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. AI Interviewer */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between hover:border-blue-500/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">AI Interview Simulator</h4>
                      <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
                        Simulate Technical, HR, Coding, Project &amp; Viva interviews with AI-scored evaluations
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchTool(onOpenInterviewer)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Start</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 3. Knowledge Base (RAG) */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between hover:border-amber-500/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Knowledge Base &amp; Documents</h4>
                        {docCount > 0 && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            {docCount} files
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
                        Upload and manage PDFs, DOCX, TXT files indexed for semantic RAG citations
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchTool(onOpenDocuments)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Manage</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 4. AI Personas */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between hover:border-purple-500/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 text-base">
                      {activePersona?.avatar || '🤖'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white">AI Character Personas</h4>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ({activePersona?.name || 'General Assistant'})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
                        Custom AI personas, specialized teaching agents, and custom instructions
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchTool(onOpenPersonas)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Customize</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 5. Prompt Library */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between hover:border-rose-500/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Prompt Template Library</h4>
                      <p className="text-[11px] text-zinc-500 max-w-sm mt-0.5">
                        High-yield prompt templates with dynamic variable inputs for research, coding &amp; study
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchTool(onOpenPromptLibrary)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold text-xs transition shadow-xs shrink-0"
                  >
                    <span>Browse</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Workspace Capabilities & Toggles */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                  Workspace Intelligence Capabilities
                </div>

                {/* Web Search Toggle */}
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white">Live Web Search &amp; Grounding</span>
                      <p className="text-[11px] text-zinc-500">Inspect real-time web results when answering questions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ use_web_search: !settings.use_web_search })}
                    className={`p-1.5 rounded-xl border transition ${settings.use_web_search
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                      }`}
                  >
                    {settings.use_web_search ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>

                {/* RAG Toggle */}
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white">Document RAG Retrieval</span>
                      <p className="text-[11px] text-zinc-500">Retrieve relevant excerpts from uploaded documents</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ use_rag: !settings.use_rag })}
                    className={`p-1.5 rounded-xl border transition ${settings.use_rag
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                      }`}
                  >
                    {settings.use_rag ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>

                {/* Cross-Chat Memory Quick Toggle & Shortcut */}
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white">Cross-Chat Memory</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('general')}
                          className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                        >
                          View Summary &rarr;
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500">Inject saved personal context &amp; preferences into chats</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ use_memory: !settings.use_memory })}
                    className={`p-1.5 rounded-xl border transition ${settings.use_memory
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                      }`}
                  >
                    {settings.use_memory ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL & PERSONALIZATION */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Appearance Setting */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Theme &amp; Appearance</h4>
                  <p className="text-[11px] text-zinc-500">
                    Currently set to <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">{theme}</span> theme
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 transition shadow-xs"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                  <span>Switch to {isDark ? 'Light' : 'Dark'}</span>
                </button>
              </div>

              {/* Profile Card */}
              {user && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{user.name}</h4>
                      <p className="text-[11px] text-zinc-500">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
                    {user.provider} mode
                  </span>
                </div>
              )}

              {/* ChatGPT-style Memory & Personalization Summary */}
              <div className="p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent dark:from-purple-950/20 dark:to-transparent space-y-4 shadow-xs">
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                          What LEARN.GPT Remembers About You
                        </h4>
                        {settings.use_memory ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {memories.filter((m) => m.is_active).length} Active Facts
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                            Memory Paused
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Facts and preferences LEARN.GPT applies across all your chats to personalize answers.
                      </p>
                    </div>
                  </div>
                  {/* Master Toggle */}
                  <button
                    onClick={() => onUpdateSettings({ use_memory: !settings.use_memory })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition shrink-0 ${settings.use_memory
                      ? 'bg-purple-600 text-white border-purple-500 shadow-xs hover:bg-purple-500'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                      }`}
                    title={settings.use_memory ? 'Click to pause memory in chats' : 'Click to enable memory in chats'}
                  >
                    {settings.use_memory ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{settings.use_memory ? 'Enabled' : 'Paused'}</span>
                  </button>
                </div>

                {/* Auto-Extract Banner & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>
                      <strong className="text-purple-600 dark:text-purple-400">Auto-Remembers:</strong> Personal details, preferences &amp; goals are automatically saved as you chat.
                    </span>
                  </div>
                  {onAutoSummarizeMemories && (
                    <button
                      type="button"
                      onClick={handleAutoSummarize}
                      disabled={isSummarizing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-xs shrink-0 disabled:opacity-50"
                      title="Scan recent conversations to auto-extract memories"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                      <span>{isSummarizing ? 'Scanning...' : 'Auto-Summarize'}</span>
                    </button>
                  )}
                </div>
                {summarizeFeedback && (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                    ✓ {summarizeFeedback}
                  </div>
                )}

                {/* Quick Add Starter Suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Quick Personalization Starters:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Prefer Python code examples',
                      'I am a Computer Science student',
                      'Explain step-by-step with examples',
                      'Keep explanations concise & direct',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={async () => {
                          await onAddMemory(suggestion);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40 dark:hover:text-purple-300 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 transition"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add New Memory Input */}
                <form onSubmit={handleAddMemorySubmit} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Tell LEARN.GPT what to remember (e.g. 'I am preparing for frontend interviews')..."
                    className="flex-1 bg-white dark:bg-[#181818] border border-zinc-300 dark:border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={isAddingMemory || !newMemoryText.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition disabled:opacity-50 shrink-0 shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingMemory ? 'Saving...' : 'Remember'}</span>
                  </button>
                </form>

                {/* Stored Memories List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {memories.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-1 bg-white/50 dark:bg-[#141414]/50">
                      <Sparkles className="w-5 h-5 text-purple-400 mx-auto" />
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        No persistent memories stored yet
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Add facts above or click one of the quick starters to personalize your AI responses.
                      </p>
                    </div>
                  ) : (
                    memories.map((m) => {
                      const badge = getCategoryBadge(m.category);
                      return (
                        <div
                          key={m.id}
                          className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40 transition shadow-2xs text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <button
                              onClick={() => onToggleMemory(m.id)}
                              className={`shrink-0 transition ${m.is_active ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'
                                }`}
                              title={m.is_active ? 'Active (Click to mute)' : 'Muted (Click to activate)'}
                            >
                              {m.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span
                                className={`flex-1 break-words ${m.is_active
                                  ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                                  : 'text-zinc-400 line-through'
                                  }`}
                              >
                                {m.content}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => onDeleteMemory(m.id)}
                            className="p-1 text-zinc-400 hover:text-rose-500 transition shrink-0 opacity-80 group-hover:opacity-100"
                            title="Forget memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer: Clear All */}
                {memories.length > 0 && (
                  <div className="flex justify-end pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <button
                      onClick={async () => {
                        if (confirm('Clear all stored persistent memories? This cannot be undone.')) {
                          await onClearAllMemories();
                        }
                      }}
                      className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All Memories ({memories.length})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">Clear All Chat History</h4>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
                    Permanently delete all your conversations and start fresh
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete all conversations? This cannot be undone.')) {
                      onClearHistory();
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs"
                >
                  Clear History
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MODEL & PARAMETERS */}
          {activeTab === 'model' && (
            <div className="space-y-4">
              {/* Default Model Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Default Hosted LLM
                </label>
                <select
                  value={settings.default_model}
                  onChange={(e) => onUpdateSettings({ default_model: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-[#181818] border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature Slider */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Sampling Temperature</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {settings.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>0.0 (Deterministic / Code)</span>
                  <span>0.7 (Balanced)</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>

              {/* Max Output Tokens */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Max Generation Tokens</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {settings.max_tokens} tokens
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[512, 1024, 2048, 4096].map((tokens) => (
                    <button
                      key={tokens}
                      type="button"
                      onClick={() => onUpdateSettings({ max_tokens: tokens })}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition ${settings.max_tokens === tokens
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500'
                        }`}
                    >
                      {tokens}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom System Prompt Override */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Custom Global System Instructions (Optional)
                </label>
                <textarea
                  rows={4}
                  value={settings.custom_system_prompt}
                  onChange={(e) => onUpdateSettings({ custom_system_prompt: e.target.value })}
                  placeholder="e.g. Always respond in concise academic tone with equations formatted in LaTeX..."
                  className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0 mt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
