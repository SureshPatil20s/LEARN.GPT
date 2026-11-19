'use client';

import React from 'react';
import { ModelOption } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import {
  Menu,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  Settings,
  Check,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onOpenSettings?: () => void;
}

export default function Navbar({
  onToggleSidebar,
  models,
  selectedModel,
  onSelectModel,
  onOpenSettings,
}: NavbarProps) {
  const { toggleTheme, isDark } = useTheme();

  const currentModel = models.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel === 'auto' ? '🤖 Qwen 2.5 1.5B (Smart Router)' : selectedModel.replace(/-/g, ' ').toUpperCase(),
    provider: 'Smart Router',
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-[#212121] bg-white dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 px-4 flex items-center justify-between z-20 shrink-0 transition-colors">
      {/* Left: Sidebar Toggle + Clean Model Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Toggle navigation"
          title="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Model Dropdown Selector */}
        <div className="relative group">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#1c1c1c] border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 cursor-pointer text-xs text-zinc-900 dark:text-white transition shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="font-semibold">{currentModel.name}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono hidden sm:inline">
              ({currentModel.provider})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 ml-1" />
          </div>

          {/* Model dropdown menu */}
          <div className="absolute left-0 mt-1 w-84 bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-2 hidden group-hover:block z-50">
            <div className="px-3.5 py-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              SELECT MODEL ENGINE
            </div>
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition ${
                  selectedModel === model.id ? 'bg-zinc-100/90 dark:bg-zinc-800/70 text-zinc-900 dark:text-white font-medium' : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-zinc-900 dark:text-white truncate">{model.name}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {model.provider}
                  </span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-4 h-4 text-blue-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Only Light/Dark Theme Toggle and Settings */}
      <div className="flex items-center gap-2">
        {/* Light / Dark Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#181818] dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Settings & Tools Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#181818] dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition"
            title="Open Workspace Tools & Settings"
          >
            <Settings className="w-4 h-4 text-zinc-600 dark:text-zinc-400 hover:rotate-45 transition-transform" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
      </div>
    </header>
  );
}
