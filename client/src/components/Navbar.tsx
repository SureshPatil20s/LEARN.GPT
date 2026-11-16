'use client';

import React from 'react';
import { ModelOption, Persona } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import {
  Menu,
  ChevronDown,
  Cpu,
  FileText,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Database,
  ExternalLink,
  Bot,
  Sliders,
  Sun,
  Moon,
  Globe,
  Settings,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { LearningMode } from '@/components/LearningModePanel';

interface NavbarProps {
  onToggleSidebar: () => void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  useRag: boolean;
  onToggleRag: () => void;
  useWebSearch?: boolean;
  onToggleWebSearch?: () => void;
  docCount: number;
  onOpenDocuments: () => void;
  activePersona?: Persona | null;
  onOpenPersonas: () => void;
  onOpenPromptLibrary: () => void;
  onOpenSettings?: () => void;
  learningMode?: LearningMode;
  onOpenLearningMode?: () => void;
  onOpenQuiz?: () => void;
  onOpenInterviewer?: () => void;
}

export default function Navbar({
  onToggleSidebar,
  models,
  selectedModel,
  onSelectModel,
  useRag,
  onToggleRag,
  useWebSearch = false,
  onToggleWebSearch,
  docCount,
  onOpenDocuments,
  activePersona,
  onOpenPersonas,
  onOpenPromptLibrary,
  onOpenSettings,
  learningMode = 'standard',
  onOpenLearningMode,
  onOpenQuiz,
  onOpenInterviewer,
}: NavbarProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  const currentModel = models.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel.replace(/-/g, ' ').toUpperCase(),
    provider: 'Groq',
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-[#212121] bg-white dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 px-4 flex items-center justify-between z-20 shrink-0 transition-colors">
      {/* Left: Sidebar Hamburger + Model Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Model Dropdown Selector */}
        <div className="relative group">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#1c1c1c] border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 cursor-pointer text-xs text-zinc-900 dark:text-white transition">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="font-semibold">{currentModel.name}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">({currentModel.provider})</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 ml-1" />
          </div>

          {/* Model dropdown menu */}
          <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1 hidden group-hover:block z-50">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Autonomous Router</span>
              <span className="text-[9px] text-orange-500 font-medium">⚡ Groq LPU</span>
            </div>
            <div className="mx-2 mb-1 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-zinc-600 dark:text-zinc-300">
              <strong className="text-orange-600 dark:text-orange-400">Powered by Groq:</strong> It uses Groq-hosted AI for fast, high-performance processing.
            </div>
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition ${
                  selectedModel === model.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium' : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-white">{model.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-mono">
                    {model.provider}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{model.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Theme Toggle, Personas, Prompt Library, RAG toggle & Documents */}
      <div className="flex items-center gap-2">
        {/* Light / Dark Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#181818] dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Learning Mode Selector */}
        {onOpenLearningMode && (
          <button
            onClick={onOpenLearningMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
              learningMode !== 'standard'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-600/70 text-emerald-800 dark:text-emerald-300 shadow-sm font-semibold'
                : 'bg-zinc-100 dark:bg-[#181818] border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500/70 hover:text-emerald-600 dark:hover:text-white'
            }`}
            title="Educational Modes: Adaptive AI Tutor, Socratic Method, Quiz Generator, Visual Learning"
          >
            <GraduationCap className={`w-3.5 h-3.5 ${learningMode !== 'standard' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="truncate max-w-[110px] hidden sm:inline">
              {learningMode === 'adaptive_tutor'
                ? 'Adaptive Tutor'
                : learningMode === 'socratic'
                ? 'Socratic'
                : learningMode === 'quiz'
                ? 'Quiz Mode'
                : learningMode === 'visual'
                ? 'Visual'
                : 'Learning Modes'}
            </span>
            {learningMode !== 'standard' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            )}
          </button>
        )}

        {/* Persona / Character Selector */}
        <button
          onClick={onOpenPersonas}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-zinc-100 dark:bg-[#181818] border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:border-purple-500/70 dark:hover:border-purple-600/70 hover:text-purple-600 dark:hover:text-white transition"
          title="Choose or create AI character personas"
        >
          <span className="text-sm leading-none">{activePersona?.avatar || '🤖'}</span>
          <span className="font-medium truncate max-w-[110px] hidden sm:inline">
            {activePersona?.name || 'Persona'}
          </span>
        </button>

        {/* Prompt Library */}
        <button
          onClick={onOpenPromptLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-zinc-100 dark:bg-[#181818] border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:border-amber-500/70 dark:hover:border-amber-600/70 hover:text-amber-600 dark:hover:text-white transition"
          title="Open Prompt Library with variable forms"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span className="hidden sm:inline">Prompts</span>
        </button>

        {/* AI Interviewer Button */}
        {onOpenInterviewer && (
          <button
            onClick={onOpenInterviewer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600/10 to-teal-600/10 dark:from-emerald-950/60 dark:to-teal-950/60 border border-emerald-500/40 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 hover:from-emerald-600/20 hover:to-teal-600/20 hover:border-emerald-500 transition"
            title="AI Interview Simulation Suite — Technical, HR, Coding, Project & Viva"
          >
            <Briefcase className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden sm:inline">Interviewer</span>
          </button>
        )}

        {/* Web Search Toggle */}
        {onToggleWebSearch && (
          <button
            onClick={onToggleWebSearch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              useWebSearch
                ? 'bg-blue-100 dark:bg-blue-950/60 border-blue-500 dark:border-blue-600/70 text-blue-800 dark:text-blue-300 shadow-sm'
                : 'bg-zinc-100 dark:bg-[#181818] border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Enable or disable real-time Web Search & Website inspection"
          >
            <Globe className={`w-3.5 h-3.5 ${useWebSearch ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
            <span className="hidden sm:inline">Web</span>
            {useWebSearch && (
              <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse ml-0.5" />
            )}
          </button>
        )}

        {/* RAG Toggle */}
        <button
          onClick={onToggleRag}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            useRag
              ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-600/70 text-emerald-800 dark:text-emerald-300 shadow-sm'
              : 'bg-zinc-100 dark:bg-[#181818] border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
          title="Enable or disable document context retrieval"
        >
          <Database className={`w-3.5 h-3.5 ${useRag ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
          <span>RAG</span>
          {useRag ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-0.5" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 ml-0.5" />
          )}
        </button>

        {/* Knowledge Base Modal Button */}
        <button
          onClick={onOpenDocuments}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-zinc-100 dark:bg-[#181818] border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition"
          title="Manage uploaded documents"
        >
          <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Docs</span>
          {docCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500 text-black">
              {docCount}
            </span>
          )}
        </button>

        {/* Settings & Tools Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#181818] dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
            title="Settings & Tools"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 hover:rotate-45 transition-transform" />
          </button>
        )}
      </div>
    </header>
  );
}

