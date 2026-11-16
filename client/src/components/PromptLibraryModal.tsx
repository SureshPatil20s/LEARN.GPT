'use client';

import React, { useState } from 'react';
import { PromptTemplate } from '@/types';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Send,
  Sliders,
  Copy,
  Check,
} from 'lucide-react';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: PromptTemplate[];
  onUsePrompt: (filledPrompt: string) => void;
  onCreateTemplate: (data: { title: string; category: string; description: string; template: string }) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
}

export default function PromptLibraryModal({
  isOpen,
  onClose,
  templates,
  onUsePrompt,
  onCreateTemplate,
  onDeleteTemplate,
}: PromptLibraryModalProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newDesc, setNewDesc] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplate = (t: PromptTemplate) => {
    setSelectedTemplate(t);
    // Initialize empty form fields for variables
    const initialValues: Record<string, string> = {};
    t.variables.forEach((v) => {
      initialValues[v] = '';
    });
    setFormValues(initialValues);
  };

  const getComputedPrompt = (): string => {
    if (!selectedTemplate) return '';
    let result = selectedTemplate.template;
    for (const [key, val] of Object.entries(formValues)) {
      result = result.replaceAll(`{${key}}`, val.trim() || `[${key}]`);
    }
    return result;
  };

  const handleApplyToChat = () => {
    const prompt = getComputedPrompt();
    if (!prompt.trim()) return;
    onUsePrompt(prompt);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getComputedPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTemplate.trim()) {
      setError('Title and prompt template are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateTemplate({
        title: newTitle.trim(),
        category: newCategory.trim() || 'General',
        description: newDesc.trim(),
        template: newTemplate.trim(),
      });
      setNewTitle('');
      setNewDesc('');
      setNewTemplate('');
      setTab('browse');
    } catch (err: any) {
      setError(err.message || 'Failed to save prompt template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Prompt Template Library</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Fill in dynamic variables like <code className="bg-zinc-200 dark:bg-zinc-800 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded text-[10px]">&#123;topic&#125;</code> and <code className="bg-zinc-200 dark:bg-zinc-800 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded text-[10px]">&#123;tone&#125;</code> using an interactive form
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
          <button
            onClick={() => setTab('browse')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'browse'
                ? 'bg-amber-500 text-black font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === 'create'
                ? 'bg-amber-500 text-black font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Custom Template</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Browse & Fill View */}
        {tab === 'browse' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
            {/* Left Column: Template List */}
            <div className="overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 border-r border-zinc-200 dark:border-zinc-800/60 md:pr-3">
              {templates.map((t) => {
                const isSelected = selectedTemplate?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-white truncate">{t.title}</span>
                      <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 px-1.5 py-0.2 rounded font-mono">
                        {t.category}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1 mb-1.5">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {t.variables.map((v) => (
                        <span
                          key={v}
                          className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 px-1.5 py-0.2 rounded font-mono"
                        >
                          &#123;{v}&#125;
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Form Variables Filler */}
            <div className="flex flex-col overflow-y-auto pr-1">
              {selectedTemplate ? (
                <div className="flex flex-col h-full space-y-3">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{selectedTemplate.title}</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{selectedTemplate.description}</p>
                  </div>

                  {/* Dynamic Form Fields */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto">
                    <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Fill Template Variables:
                    </div>
                    {selectedTemplate.variables.map((varName) => (
                      <div key={varName}>
                        <label className="block text-xs font-mono text-amber-700 dark:text-amber-300 mb-1">
                          &#123;{varName}&#125;
                        </label>
                        {varName.toLowerCase() === 'code' ? (
                          <textarea
                            rows={3}
                            value={formValues[varName] || ''}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [varName]: e.target.value }))
                            }
                            placeholder={`Enter ${varName}...`}
                            className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formValues[varName] || ''}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [varName]: e.target.value }))
                            }
                            placeholder={`Enter ${varName}... (e.g. ${
                              varName === 'tone' ? 'humorous, academic, concise' : varName
                            })`}
                            className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    ))}

                    {/* Preview Box */}
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Computed Prompt Output:
                      </div>
                      <div className="p-2.5 bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {getComputedPrompt()}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyToChat}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition shadow-md cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Insert into Chat</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-zinc-400 dark:text-zinc-500">
                  <Sliders className="w-8 h-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs">Select a prompt template on the left to fill its dynamic variables</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Custom Template View */}
        {tab === 'create' && (
          <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Template Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Customer Email Reply, Product Description"
                  className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Marketing, Code, Writing"
                  className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What does this prompt template do?"
                className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Prompt Template (use curly braces like <span className="text-amber-600 dark:text-amber-400 font-mono">&#123;topic&#125;</span>, <span className="text-amber-600 dark:text-amber-400 font-mono">&#123;tone&#125;</span>)
              </label>
              <textarea
                rows={5}
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                placeholder="Write a {tone} email to {recipient} explaining our new {product} features..."
                className="w-full bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono resize-none"
                required
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Any word surrounded by <code className="text-amber-700 dark:text-amber-400 font-mono">&#123;curly_braces&#125;</code> will automatically generate an interactive input field for users when applying the template.
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
