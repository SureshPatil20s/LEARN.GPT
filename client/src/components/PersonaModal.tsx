'use client';

import React, { useState } from 'react';
import { Persona } from '@/types';
import {
  X,
  Plus,
  Trash2,
  Check,
  Bot,
  Sparkles,
  Info,
  Shield,
  Briefcase,
  GraduationCap,
  Code2,
} from 'lucide-react';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  activePersonaId?: string | null;
  onSelectPersona: (persona: Persona) => void;
  onCreatePersona: (data: { name: string; avatar: string; description: string; system_prompt: string }) => Promise<void>;
  onDeletePersona: (id: string) => Promise<void>;
}

const PRESET_AVATARS = ['🤖', '💻', '🎓', '🛡️', '✍️', '⚡', '🧠', '🔬', '🎨', '🚀', '🧙‍♂️', '⚖️'];

export default function PersonaModal({
  isOpen,
  onClose,
  personas,
  activePersonaId,
  onSelectPersona,
  onCreatePersona,
  onDeletePersona,
}: PersonaModalProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Character name and system prompt instructions are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreatePersona({
        name: name.trim(),
        avatar,
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
      });
      setName('');
      setDescription('');
      setSystemPrompt('');
      setTab('browse');
    } catch (err: any) {
      setError(err.message || 'Failed to create persona');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800/60 flex items-center justify-center text-purple-700 dark:text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">AI Characters & Custom Personas</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Select or save reusable system prompts to change how your AI thinks, responds, and writes
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
          <button
            onClick={() => setTab('browse')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'browse'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            Available Personas ({personas.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'create'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Agent</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Browse Tab */}
        {tab === 'browse' && (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
            {personas.map((p) => {
              const isActive = activePersonaId === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                    isActive
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/60 flex items-center justify-center text-xl shrink-0">
                      {p.avatar || '🤖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{p.name}</span>
                        {p.is_builtin ? (
                          <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 px-1.5 py-0.2 rounded font-mono">
                            Built-in
                          </span>
                        ) : (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 px-1.5 py-0.2 rounded font-mono">
                            Custom
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">{p.description}</p>
                      )}
                      <p className="text-[11px] text-zinc-700 dark:text-zinc-400 font-mono mt-1 line-clamp-2 bg-zinc-100 dark:bg-black/40 p-1.5 rounded border border-zinc-200 dark:border-zinc-800/60">
                        {p.system_prompt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    <button
                      onClick={() => {
                        onSelectPersona(p);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-purple-600 text-white cursor-default'
                          : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Apply'}
                    </button>
                    {!p.is_builtin && (
                      <button
                        onClick={() => onDeletePersona(p.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Delete custom persona"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Tab */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Avatar Icon</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition ${
                      avatar === emoji
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/60'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#121212] hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Socratic Math Tutor, Legal Contract Reviewer, Rust Specialist"
                className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Short Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Explains complex algorithms step-by-step with zero assumptions"
                className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                System Prompt Instructions
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                placeholder="You are an expert... You always speak with... You format your answers by..."
                className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none font-mono"
                required
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                These instructions are injected into the system prompt for any conversation using this persona.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setTab('browse')}
                className="px-4 py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Character'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
