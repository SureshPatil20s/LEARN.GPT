'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, RagSource } from '@/types';
import {
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  BookOpen,
  AlertTriangle,
  Eye,
} from 'lucide-react';

let mermaidInitialized = false;

const MERMAID_DIAGRAM_TYPES = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|zenuml|sankey-beta|xychart-beta|block-beta)\b/m;

function sanitizeMermaid(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/^`(?:mermaid)?\s*\n?/i, '').replace(/\n?`\s*$/, '').trim();
  clean = clean.replace(/\[([^"\]\n\r]+[\(\)\/\&\:\-][^"\]\n\r]*)\]/g, '["$1"]');
  clean = clean.replace(/\["([^"\n\r]*)$/gm, '["$1"]');
  return clean;
}

function MermaidDiagram({ code, id, isStreaming }: { code: string; id: string; isStreaming?: boolean }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sanitized = sanitizeMermaid(code);

    if (!sanitized || !MERMAID_DIAGRAM_TYPES.test(sanitized)) {
      if (isStreaming) {
        setLoading(true);
        return;
      }
    }

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, system-ui, sans-serif',
            suppressErrorRendering: true,
          });
          mermaidInitialized = true;
        }

        const isValid = await mermaid.parse(sanitized).catch(() => false);
        if (!isValid) {
          if (isStreaming) {
            setLoading(true);
            return;
          }
          throw new Error('Diagram syntax is incomplete or contains unsupported tokens');
        }

        const safeId = "mermaid-" + id.replace(/[^a-zA-Z0-9_-]/g, '') + "-" + Math.floor(Math.random() * 1000);
        const { svg: rendered } = await mermaid.render(safeId, sanitized);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          if (isStreaming) {
            setLoading(true);
          } else {
            setError(e?.message || 'Diagram syntax error');
            setLoading(false);
          }
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, id, isStreaming]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || (isStreaming && !svg)) {
    return (
      <div className="my-3 flex items-center gap-2.5 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 text-xs text-violet-700 dark:text-violet-300">
        <Sparkles className="w-4 h-4 animate-spin-slow text-violet-500 shrink-0" />
        <span className="font-medium">Constructing visual diagram...</span>
      </div>
    );
  }

  if (error && !svg) {
    return (
      <div className="my-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141414] overflow-hidden text-xs">
        <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-50 dark:bg-[#1a1a1a] border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2 font-medium">
            <Eye className="w-3.5 h-3.5 text-violet-500" />
            <span>Visual Diagram (Raw Format)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline"
            >
              {showRaw ? 'Hide Code' : 'View Code'}
            </button>
            <button
              onClick={handleCopyCode}
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              title="Copy diagram code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {showRaw && (
          <pre className="p-3 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50/50 dark:bg-[#101010] overflow-x-auto whitespace-pre-wrap">
            {code}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/40 dark:bg-[#121118] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-violet-100 dark:border-violet-900/30 bg-violet-100/40 dark:bg-violet-950/20 text-[11px] text-violet-700 dark:text-violet-300">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span>Interactive Diagram</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div
        className="p-4 overflow-x-auto flex justify-center text-zinc-900 dark:text-zinc-100"
        dangerouslySetInnerHTML={{ __html: svg! }}
      />
    </div>
  );
}
interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSources?: RagSource[];
  onRegenerate: () => void;
  onSelectPrompt: (prompt: string) => void;
  onFeedback: (messageId: string, rating: 'like' | 'dislike') => void;
}

export default function ChatArea({
  messages,
  isStreaming,
  streamingContent,
  streamingSources,
  onRegenerate,
  onSelectPrompt,
  onFeedback,
}: ChatAreaProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSourceExpand = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const suggestions = [
    { title: 'Explain neural networks with a flowchart diagram', subtitle: 'Visual Learning — auto-renders inline Mermaid diagrams' },
    { title: 'Guide me step-by-step: Why does gravity cause orbital motion?', subtitle: 'Socratic Mode — guided discovery through questions' },
    { title: 'Explain machine learning algorithms for beginners vs experts', subtitle: 'Adaptive Tutor — adjusts depth to your knowledge level' },
    { title: 'Create a 5-question quiz on Python concurrency & asyncio', subtitle: 'Quiz Generator — interactive MCQ evaluation with scoring' },
  ];

  // â”€â”€ Custom code block renderer with Mermaid support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderCodeBlock = useCallback(
    ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match?.[1] || '';
      const codeContent = String(children).replace(/\n$/, '');
      const codeId = `code-${Math.random().toString(36).slice(2, 8)}`;

      // Mermaid: render as interactive diagram
      if (!inline && lang === 'mermaid') {
        return <MermaidDiagram code={codeContent} id={codeId} isStreaming={isStreaming} />;
      }

      if (!inline && lang) {
        return (
          <div className="rounded-xl overflow-hidden my-3 border border-zinc-800 bg-[#0d0d0d]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#171717] border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span>{lang}</span>
              <button
                onClick={() => handleCopy(codeId, codeContent)}
                className="flex items-center gap-1 hover:text-white transition"
              >
                {copiedId === codeId ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /><span>Copy code</span></>
                )}
              </button>
            </div>
            <pre className="p-3 text-xs font-mono overflow-x-auto text-zinc-200 bg-[#0a0a0a]">
              <code>{children}</code>
            </pre>
          </div>
        );
      }
      return (
        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono text-xs" {...props}>
          {children}
        </code>
      );
    },
    [copiedId, isStreaming]
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
      {/* Welcome Empty State */}
      {messages.length === 0 && !isStreaming && (
        <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-emerald-950/40 mb-4 animate-bounce-slow">
            <Sparkles className="w-7 h-7 text-black" />
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-600 dark:text-orange-400 text-xs font-medium mb-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span><strong>Powered by Groq:</strong> It uses Groq-hosted AI for fast, high-performance processing.</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">What can I help you with today?</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8 max-w-md">
            Ultra-fast inference via Groq LPUs with multi-document RAG knowledge base.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(s.title)}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] hover:bg-zinc-100 dark:hover:bg-[#202020] hover:border-zinc-300 dark:hover:border-zinc-700 text-left transition shadow-xs group"
              >
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {s.title}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">{s.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Feed */}
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isLast = index === messages.length - 1;

          return (
            <div
              key={msg.id || index}
              className={`flex items-start gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Assistant Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-black flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
              )}

              {/* Message Box */}
              <div
                className={`flex flex-col max-w-[88%] md:max-w-[82%] rounded-2xl transition-all shadow-md ${
                  isUser
                    ? 'bg-zinc-100 dark:bg-[#1e1e1e] border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white rounded-tr-xs'
                    : 'bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-xs'
                }`}
              >
                {/* Box Header Badge */}
                <div
                  className={`flex items-center justify-between px-3.5 py-1.5 border-b text-[11px] font-semibold tracking-wide ${
                    isUser
                      ? 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-200/50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300'
                      : 'border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#121212]/70 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isUser ? (
                      <>
                        <UserIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span>Input / Prompt</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>AI Response Output</span>
                      </>
                    )}
                  </div>
                  {msg.model && !isUser && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800/60">
                      {msg.model}
                    </span>
                  )}
                </div>

                {/* Box Content Body */}
                <div className="p-4">
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">{msg.content}</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Markdown Content with Mermaid support */}
                      <div className="prose dark:prose-invert prose-sm max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{ code: renderCodeBlock }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* RAG Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/80">
                          <button
                            onClick={() => toggleSourceExpand(msg.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>
                              {msg.sources.length} Referenced Source{msg.sources.length > 1 ? 's' : ''} (RAG)
                            </span>
                            {expandedSources[msg.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {expandedSources[msg.id] && (
                            <div className="mt-2 space-y-2">
                              {msg.sources.map((src, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="p-2.5 rounded-lg bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
                                >
                                  <div className="flex items-center justify-between font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <span className="truncate">{src.filename}</span>
                                      {src.page_number || (src as any).page ? (
                                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-zinc-700 dark:text-zinc-300">
                                          {String(src.page_number || (src as any).page).startsWith('Page') ? (src.page_number || (src as any).page) : `Page ${src.page_number || (src as any).page}`}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      Score: {Math.round(typeof src.score === 'number' && !isNaN(src.score) ? (src.score <= 1.0 ? src.score * 100 : src.score) : ((src as any).similarity || 100))}%
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic line-clamp-2">
                                    &ldquo;{src.snippet}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assistant Action Bar */}
                      <div className="flex items-center gap-1 pt-1 text-zinc-400 dark:text-zinc-500">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isLast && (
                          <button
                            onClick={onRegenerate}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                            title="Regenerate response"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onFeedback(msg.id, 'like')}
                          className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                            msg.feedback === 'like' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40' : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onFeedback(msg.id, 'dislike')}
                          className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                            msg.feedback === 'dislike' ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40' : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                          title="Poor response"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-300 dark:border-zinc-700 shadow-sm">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div className="flex items-start gap-3.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-black flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="w-4 h-4 text-black animate-spin-slow" />
            </div>
            <div className="flex flex-col max-w-[88%] md:max-w-[82%] rounded-2xl rounded-tl-xs bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-md">
              {/* Box Header Badge */}
              <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#121212]/70 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>AI Response Output (Generating...)</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              </div>

              {/* Streaming Box Content */}
              <div className="p-4 space-y-3">
                <div className="prose dark:prose-invert prose-sm max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed break-words">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ code: renderCodeBlock }}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                  <span className="inline-block w-2 h-4 bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-1 translate-y-0.5" />
                </div>

                {/* Streaming Sources if populated early */}
                {streamingSources && streamingSources.length > 0 && (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Found {streamingSources.length} relevant document excerpts</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
}
