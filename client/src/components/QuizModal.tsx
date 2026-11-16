'use client';

import React, { useState, useCallback } from 'react';
import {
  X,
  ClipboardList,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Lightbulb,
  Trophy,
  ChevronRight,
} from 'lucide-react';

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // index of correct option
  explanation: string;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateQuiz: (topic: string, numQuestions: number) => Promise<QuizQuestion[]>;
}

export default function QuizModal({ isOpen, onClose, onGenerateQuiz }: QuizModalProps) {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'quiz' | 'results'>('setup');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setPhase('setup');
    setTopic('');
    setNumQuestions(5);
    setQuestions([]);
    setCurrentQ(0);
    setSelected([]);
    setRevealed([]);
    setError('');
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or question area.');
      return;
    }
    setError('');
    setPhase('loading');
    try {
      const qs = await onGenerateQuiz(topic.trim(), numQuestions);
      if (!qs || qs.length === 0) {
        setError('No questions were generated. Try a more specific topic.');
        setPhase('setup');
        return;
      }
      setQuestions(qs);
      setSelected(new Array(qs.length).fill(null));
      setRevealed(new Array(qs.length).fill(false));
      setCurrentQ(0);
      setPhase('quiz');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate quiz. Please try again.');
      setPhase('setup');
    }
  };

  const handleSelect = (optIdx: number) => {
    if (revealed[currentQ]) return;
    setSelected((prev) => {
      const next = [...prev];
      next[currentQ] = optIdx;
      return next;
    });
  };

  const handleReveal = () => {
    setRevealed((prev) => {
      const next = [...prev];
      next[currentQ] = true;
      return next;
    });
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      setPhase('results');
    }
  };

  const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct ? 1 : 0), 0);

  if (!isOpen) return null;

  const q = questions[currentQ];
  const isRevealed = revealed[currentQ];
  const chosenOpt = selected[currentQ];

  const scorePercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const scoreLabel =
    scorePercent >= 90 ? 'Excellent!' : scorePercent >= 70 ? 'Good Job!' : scorePercent >= 50 ? 'Keep Practicing' : 'Need Review';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl z-10 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">AI Quiz Generator</h2>
            {phase === 'quiz' && (
              <span className="text-xs text-zinc-500 font-mono">
                {currentQ + 1} / {questions.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── SETUP ── */}
          {phase === 'setup' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Generate an adaptive quiz on any topic or based on your uploaded documents. The AI crafts questions, options, and explanations.
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Topic or Subject</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. Machine Learning, React Hooks, Photosynthesis…"
                  className="w-full bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-sky-400 dark:focus:border-sky-600 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Number of Questions: <span className="text-sky-600 dark:text-sky-400">{numQuestions}</span>
                </label>
                <div className="flex gap-2">
                  {[3, 5, 7, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumQuestions(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        numQuestions === n
                          ? 'bg-sky-500 border-sky-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#1a1a1a] hover:border-sky-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
              <button
                onClick={handleGenerate}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <Lightbulb className="w-4 h-4" /> Generate Quiz
              </button>
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              <p className="text-sm text-zinc-500">Generating {numQuestions} questions on <strong className="text-zinc-700 dark:text-zinc-200">{topic}</strong>…</p>
            </div>
          )}

          {/* ── QUIZ ── */}
          {phase === 'quiz' && q && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Question */}
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed">{q.question}</p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  let cls =
                    'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all duration-150 ';
                  if (!isRevealed) {
                    cls +=
                      chosenOpt === i
                        ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-medium'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1e1e1e] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600';
                  } else {
                    if (i === q.correct) {
                      cls += 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium';
                    } else if (i === chosenOpt) {
                      cls += 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300';
                    } else {
                      cls += 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 opacity-60';
                    }
                  }
                  return (
                    <button key={i} onClick={() => handleSelect(i)} className={cls}>
                      <span className="inline-block w-5 h-5 mr-2 text-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-bold leading-5 shrink-0 align-middle">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                      {isRevealed && i === q.correct && (
                        <CheckCircle2 className="inline w-4 h-4 ml-2 text-emerald-500" />
                      )}
                      {isRevealed && i === chosenOpt && i !== q.correct && (
                        <XCircle className="inline w-4 h-4 ml-2 text-red-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {isRevealed && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">💡 Explanation: </span>
                  {q.explanation}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!isRevealed ? (
                  <button
                    onClick={handleReveal}
                    disabled={chosenOpt === null}
                    className="flex-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition disabled:opacity-40"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    {currentQ < questions.length - 1 ? <>Next <ChevronRight className="w-4 h-4" /></> : <>Finish <Trophy className="w-4 h-4" /></>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── RESULTS ── */}
          {phase === 'results' && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <div className="text-5xl font-black mb-1">
                  {scorePercent >= 90 ? '🏆' : scorePercent >= 70 ? '🎉' : scorePercent >= 50 ? '📚' : '💪'}
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{scoreLabel}</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  You scored <strong className="text-sky-600 dark:text-sky-400">{score}</strong> out of{' '}
                  <strong>{questions.length}</strong> ({scorePercent}%)
                </p>
              </div>

              {/* Score bar */}
              <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scorePercent >= 70 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>

              {/* Per-question summary */}
              <div className="space-y-1">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {selected[i] === q.correct ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="truncate">{q.question}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={reset}
                  className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> New Quiz
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
