'use client';

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  HelpCircle,
  ClipboardList,
  Eye,
  Brain,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export type LearningMode =
  | 'standard'
  | 'adaptive_tutor'
  | 'socratic'
  | 'quiz'
  | 'visual';

interface LearningModeOption {
  id: LearningMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: string;
  color: string;
}

const MODES: LearningModeOption[] = [
  {
    id: 'standard',
    label: 'Standard Chat',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Regular AI assistant with no special teaching mode.',
    color: 'emerald',
  },
  {
    id: 'adaptive_tutor',
    label: 'Adaptive Tutor',
    icon: <Brain className="w-5 h-5" />,
    description:
      'The AI assesses your knowledge level and tailors explanations — beginner to expert — in real time.',
    badge: 'Smart',
    color: 'violet',
  },
  {
    id: 'socratic',
    label: 'Socratic Mode',
    icon: <HelpCircle className="w-5 h-5" />,
    description:
      "Guides you to answers through targeted questions. The AI won't give away solutions — it helps you think.",
    badge: 'Deep Learning',
    color: 'amber',
  },
  {
    id: 'quiz',
    label: 'Quiz Generator',
    icon: <ClipboardList className="w-5 h-5" />,
    description:
      'Generate interactive multiple-choice quizzes on any topic or from your uploaded documents.',
    badge: 'Interactive',
    color: 'sky',
  },
  {
    id: 'visual',
    label: 'Visual Learning',
    icon: <Eye className="w-5 h-5" />,
    description:
      'Responses include Mermaid diagrams, flowcharts, timelines, and visual comparisons automatically.',
    badge: 'Diagrams',
    color: 'rose',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-400 dark:border-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/20',
    border: 'border-violet-400 dark:border-violet-600',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-950/20',
    border: 'border-sky-400 dark:border-sky-600',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-400 dark:border-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  },
};

interface LearningModePanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: LearningMode;
  onSelectMode: (mode: LearningMode) => void;
}

export default function LearningModePanel({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
}: LearningModePanelProps) {
  if (!isOpen) return null;

  const handleSelect = (mode: LearningMode) => {
    onSelectMode(mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Learning Mode</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium">
              AI-Powered
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Switch how the AI teaches and responds. Each mode adapts prompts, structure, and format.
        </p>

        {/* Mode cards */}
        <div className="space-y-2">
          {MODES.map((mode) => {
            const isActive = currentMode === mode.id;
            const colors = colorMap[mode.color];
            return (
              <button
                key={mode.id}
                onClick={() => handleSelect(mode.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                  isActive
                    ? `${colors.bg} ${colors.border} ring-1 ring-inset ring-current`
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#1a1a1a] hover:bg-zinc-50 dark:hover:bg-[#202020]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? `${colors.bg} ${colors.text}` : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {mode.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isActive ? colors.text : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {mode.label}
                    </span>
                    {mode.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isActive ? colors.badge : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {mode.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${colors.text}`}>
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {mode.description}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? colors.text : 'text-zinc-400'}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
