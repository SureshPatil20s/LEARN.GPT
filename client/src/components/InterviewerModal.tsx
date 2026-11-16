'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Briefcase,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  FastForward,
  LogOut,
  Mic,
  MicOff,
  Code2,
  GraduationCap,
  Users,
  Terminal,
  FolderGit2,
  Building2,
  Award,
  BookOpen,
  ChevronRight,
  Loader2,
  History,
  FileText,
  Copy,
  Check,
  ShieldAlert,
  PlayCircle,
  CheckCircle,
  XCircle,
  Cpu,
  Download,
  Calendar,
  Sparkles,
  TrendingUp,
  Target
} from 'lucide-react';
import {
  InterviewSession,
  InterviewTurn,
  InterviewConfig,
  InterviewEvaluation,
  DocumentItem,
  CodingExecutionResponse
} from '@/types';
import {
  createInterviewSession,
  startInterviewSession,
  getInterviewSession,
  submitInterviewAnswer,
  skipInterviewTurn,
  endInterviewSession,
  getInterviewHistory,
  transcribeAudio,
  executeCodingSolution,
  downloadInterviewReportMarkdown
} from '@/lib/api';
import { AudioRecorder } from '@/lib/audioRecorder';

interface InterviewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents?: DocumentItem[];
}

const PRESET_ROLES = [
  'Python Backend Engineer',
  'Data Structures & Algorithms',
  'Operating Systems & System Design',
  'Full-Stack React & Node',
  'DBMS & Database Architecture',
  'Computer Networks & Security',
  'Machine Learning & AI',
  'Object-Oriented Programming (Java/C++)'
];

const TRACK_PRESETS: Record<string, string[]> = {
  technical: [
    'Python Backend & Architecture',
    'C Programming & Memory Internals',
    'Java & Spring Boot Engineering',
    'Data Structures & Algorithms',
    'Operating Systems & Concurrency',
    'DBMS & SQL Query Optimization',
    'Computer Networks & TCP/IP',
    'Full-Stack React & Node.js',
    'Machine Learning & Transformers',
  ],
  coding: [
    'Arrays & Two Pointers (Python/C++)',
    'Dynamic Programming & Memoization',
    'Trees, Tries & Graph Traversal',
    'Sliding Window & Substring Algorithms',
    'Linked Lists & In-Place Reversals',
    'Binary Search & Complexity Analysis',
  ],
  hr: [
    'STAR Behavioral: Conflict Resolution',
    'Leadership, Mentorship & Ownership',
    'Prioritization & Managing Deadlines',
    'Overcoming Technical Failures',
    'Cross-Functional Team Collaboration',
  ],
  behavioral: [
    'STAR Behavioral: Conflict Resolution',
    'Leadership, Mentorship & Ownership',
    'Prioritization & Managing Deadlines',
    'Overcoming Technical Failures',
    'Cross-Functional Team Collaboration',
  ],
  viva: [
    'Operating Systems Viva Voce',
    'Computer Networks Theory Viva',
    'Database Management Systems Viva',
    'Compiler Design & Automata Viva',
    'Computer Organization & Architecture',
    'Theory of Computation & Formal Proofs',
  ],
  project: [
    'End-to-End System Architecture',
    'Database Schema & Indexing Tradeoffs',
    'Microservices vs Monolith Decisions',
    'Security, Authentication & Threat Modeling',
    'Performance Bottlenecks & Optimization',
  ],
  placement: [
    'Software Engineer Campus Placement Drive',
    'Full-Stack Developer Placement Test',
    'Backend Systems Campus Interview',
    'Core CS & Aptitude Placement Drive',
  ]
};

const INTERVIEW_PRESETS = [
  {
    type: 'technical',
    title: 'Technical Interview',
    desc: 'Deep dive into programming, computer science fundamentals & frameworks',
    icon: Code2,
    color: 'emerald'
  },
  {
    type: 'coding',
    title: 'Coding Challenge',
    desc: 'Algorithmic problem solving, constraints, edge cases & starter code',
    icon: Terminal,
    color: 'blue'
  },
  {
    type: 'hr',
    title: 'HR & Behavioral',
    desc: 'Culture fit, STAR situational judgment, leadership & collaboration',
    icon: Users,
    color: 'purple'
  },
  {
    type: 'project',
    title: 'Resume & Project Defense',
    desc: 'Architectural decisions, tech stacks, tradeoffs & project challenges',
    icon: FolderGit2,
    color: 'amber'
  },
  {
    type: 'viva',
    title: 'University Viva',
    desc: 'Academic rigor, definitions, derivations & foundational theory',
    icon: GraduationCap,
    color: 'indigo'
  },
  {
    type: 'placement',
    title: 'Campus Placement',
    desc: 'Comprehensive placement test simulation across tech & communication',
    icon: Building2,
    color: 'rose'
  }
];

export default function InterviewerModal({
  isOpen,
  onClose,
  documents = []
}: InterviewerModalProps) {
  // Navigation & lifecycle
  const [tab, setTab] = useState<'setup' | 'active' | 'evaluation' | 'history'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup Form State
  const [interviewType, setInterviewType] = useState('technical');
  const [subjectRole, setSubjectRole] = useState('Python Backend Engineer');
  const [experienceLevel, setExperienceLevel] = useState('fresher');
  const [difficulty, setDifficulty] = useState('medium');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [allocatedTimeMin, setAllocatedTimeMin] = useState(20);
  const [language, setLanguage] = useState('English');
  const [interactionMode, setInteractionMode] = useState<'text' | 'voice'>('text');
  const [resumeDocId, setResumeDocId] = useState<string>('');

  // Active Session State
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [currentTurn, setCurrentTurn] = useState<InterviewTurn | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [candidateCode, setCandidateCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [executingCode, setExecutingCode] = useState(false);
  const [executionResult, setExecutionResult] = useState<CodingExecutionResponse | null>(null);
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(20 * 60);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Evaluation & History State
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [pastSessions, setPastSessions] = useState<InterviewSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [evalSubTab, setEvalSubTab] = useState<'overview' | 'teach_back' | 'roadmap' | 'full_report'>('overview');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Countdown Timer handler
  useEffect(() => {
    if (tab === 'active' && currentSession?.status === 'in_progress') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [tab, currentSession?.status]);

  // Clean up audio recorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current?.isRecording) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start new interview simulation
  const handleStartInterview = async () => {
    if (!subjectRole.trim()) {
      setError('Please provide a subject or job role for the interview.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const config: InterviewConfig = {
        interview_type: interviewType,
        subject_role: subjectRole.trim(),
        experience_level: experienceLevel,
        difficulty,
        total_main_questions: totalQuestions,
        allocated_time_min: allocatedTimeMin,
        language,
        interaction_mode: interactionMode,
        resume_document_id: resumeDocId || null
      };

      const created = await createInterviewSession(config);
      const turn1 = await startInterviewSession(created.id);
      const freshSession = await getInterviewSession(created.id);

      setCurrentSession(freshSession);
      setCurrentTurn(turn1);
      setCandidateAnswer('');
      setCandidateCode(turn1.coding_starter_code || '');
      setExecutionResult(null);
      setSecondsRemaining(allocatedTimeMin * 60);
      setTab('active');
    } catch (err: any) {
      setError(err?.message || 'Failed to start interview simulation.');
    } finally {
      setLoading(false);
    }
  };

  // Submit candidate answer
  const handleSubmitAnswer = async () => {
    if (!currentSession || !currentTurn) return;
    const ansText = candidateAnswer.trim();
    const codeText = candidateCode.trim();

    if (!ansText && !codeText) {
      setError('Please type or dictate your answer before submitting.');
      return;
    }

    setError(null);
    setSubmittingTurn(true);

    // Generate unique idempotency key for this submission attempt
    const idempotencyKey = `turn-${currentTurn.id}-seq-${currentTurn.sequence_number}-${Date.now()}`;

    try {
      const res = await submitInterviewAnswer(
        currentSession.id,
        {
          turn_id: currentTurn.id,
          sequence_number: currentTurn.sequence_number,
          candidate_answer: ansText || undefined,
          candidate_code: codeText || undefined
        },
        idempotencyKey
      );

      if (res.is_completed && res.evaluation) {
        setEvaluation(res.evaluation);
        const updatedSession = await getInterviewSession(currentSession.id);
        setCurrentSession(updatedSession);
        setTab('evaluation');
      } else if (res.next_turn) {
        setCurrentTurn(res.next_turn);
        setCandidateAnswer('');
        setCandidateCode(res.next_turn.coding_starter_code || '');
        setExecutionResult(null);
        const updatedSession = await getInterviewSession(currentSession.id);
        setCurrentSession(updatedSession);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit answer.');
    } finally {
      setSubmittingTurn(false);
    }
  };

  // Skip turn
  const handleSkipTurn = async () => {
    if (!currentSession || !currentTurn) return;
    if (!confirm('Are you sure you want to skip this question? This will be marked in your final evaluation.')) {
      return;
    }
    setError(null);
    setSubmittingTurn(true);

    try {
      const res = await skipInterviewTurn(currentSession.id);
      if (res.is_completed && res.evaluation) {
        setEvaluation(res.evaluation);
        const updatedSession = await getInterviewSession(currentSession.id);
        setCurrentSession(updatedSession);
        setTab('evaluation');
      } else if (res.next_turn) {
        setCurrentTurn(res.next_turn);
        setCandidateAnswer('');
        setCandidateCode(res.next_turn.coding_starter_code || '');
        setExecutionResult(null);
        const updatedSession = await getInterviewSession(currentSession.id);
        setCurrentSession(updatedSession);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to skip question.');
    } finally {
      setSubmittingTurn(false);
    }
  };

  // Execute candidate code in sandbox
  const handleExecuteCode = async () => {
    if (!candidateCode.trim()) {
      setError('Please write some code before executing.');
      return;
    }
    setError(null);
    setExecutingCode(true);

    let parsedTestCases: any[] | undefined = undefined;
    if (currentTurn?.coding_test_specs) {
      try {
        parsedTestCases = JSON.parse(currentTurn.coding_test_specs);
      } catch (e) {
        console.warn('Could not parse coding_test_specs:', e);
      }
    }

    try {
      const res = await executeCodingSolution(
        candidateCode,
        selectedLanguage,
        currentTurn?.id,
        parsedTestCases
      );
      setExecutionResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute code in sandbox.');
    } finally {
      setExecutingCode(false);
    }
  };

  // Download Markdown Evaluation Report (Stage 5)
  const handleDownloadReport = async () => {
    if (!currentSession?.id) return;
    setDownloadingReport(true);
    try {
      const mdContent = await downloadInterviewReportMarkdown(currentSession.id);
      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `interview_report_${currentSession.subject_role.replace(/\s+/g, '_')}_${currentSession.id.slice(0, 8)}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to download report.');
    } finally {
      setDownloadingReport(false);
    }
  };

  // Copy Markdown Report
  const handleCopyReport = () => {
    if (!evaluation?.full_report_markdown) return;
    navigator.clipboard.writeText(evaluation.full_report_markdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // End interview early
  const handleEndEarly = async () => {
    if (!currentSession) return;
    if (!confirm('Are you sure you want to conclude the interview now? Your report will be evaluated on your completed questions.')) {
      return;
    }
    setLoading(true);
    try {
      const ended = await endInterviewSession(currentSession.id, 'candidate_requested');
      if (ended.evaluation) {
        setEvaluation(ended.evaluation);
        setCurrentSession(ended);
        setTab('evaluation');
      } else {
        alert('Interview ended. No answers were submitted.');
        setTab('setup');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to conclude interview.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle voice dictation (Dual engine: Web Speech API streaming + Groq Whisper high-accuracy fallback)
  const handleToggleVoice = async () => {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

    if (isRecording) {
      // STOP recording & transcribe
      setIsRecording(false);
      let capturedText = '';

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
        speechRecognitionRef.current = null;
      }

      if (recorderRef.current) {
        setIsTranscribing(true);
        try {
          const audioBlob = await recorderRef.current.stop();
          const transcription = await transcribeAudio(audioBlob);
          if (transcription.text && transcription.text.trim()) {
            capturedText = transcription.text.trim();
            setCandidateAnswer((prev) => (prev ? `${prev} ${capturedText}` : capturedText));
          } else if (!candidateAnswer.trim()) {
            setError('No speech recognized. Please speak close to your microphone or type your answer.');
          }
        } catch (err: any) {
          if (!candidateAnswer.trim()) {
            setError('Voice transcription failed. You can type your answer in the box below.');
          }
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      // START recording
      setError(null);

      // 1. Start browser native continuous speech recognition for instant real-time text display
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = currentSession?.language === 'Hindi' ? 'hi-IN' : 'en-US';

          const baselineAnswer = candidateAnswer.trim();
          recognition.onresult = (event: any) => {
            let sessionTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
              sessionTranscript += event.results[i][0].transcript;
            }
            if (sessionTranscript.trim()) {
              setCandidateAnswer(baselineAnswer ? `${baselineAnswer} ${sessionTranscript.trim()}` : sessionTranscript.trim());
            }
          };

          recognition.onerror = () => {
            // Native recognition errored; fallback to audio blob transcribeAudio
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          // Native speech recognition unavailable or blocked
        }
      }

      // 2. Also start AudioRecorder for Groq Whisper transcription
      try {
        const recorder = new AudioRecorder();
        await recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
      } catch (err: any) {
        setError(err?.message || 'Microphone access denied. Please allow microphone permissions.');
      }
    }
  };

  // Load Past History
  const handleLoadHistory = async () => {
    setLoadingHistory(true);
    setTab('history');
    try {
      const list = await getInterviewHistory(20);
      setPastSessions(list);
    } catch (err: any) {
      setError('Failed to load past interview history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // View past session report
  const handleViewPastSession = async (sessId: string) => {
    setLoading(true);
    try {
      const sess = await getInterviewSession(sessId);
      if (sess.evaluation) {
        setEvaluation(sess.evaluation);
        setCurrentSession(sess);
        setEvalSubTab('overview');
        setTab('evaluation');
      } else {
        alert(`Session status: ${sess.status} (No completed report available).`);
      }
    } catch (err: any) {
      setError('Failed to fetch session evaluation.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#151515] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">AI Interviewer</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Simulation Suite
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Realistic technical, HR, coding, project & viva mock interviews with comprehensive scoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tab !== 'setup' && (
              <button
                onClick={() => setTab('setup')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                New Interview
              </button>
            )}
            {tab !== 'history' && (
              <button
                onClick={handleLoadHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:underline font-semibold">Dismiss</button>
          </div>
        )}

        {/* Main Body Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ============================================================= */}
          {/* 1. SETUP TAB                                                 */}
          {/* ============================================================= */}
          {tab === 'setup' && (
            <div className="space-y-6">
              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5">
                  1. Select Interview Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {INTERVIEW_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = interviewType === preset.type;
                    return (
                      <button
                        key={preset.type}
                        onClick={() => setInterviewType(preset.type)}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-[#1a1a1a]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-500' : 'text-zinc-400'}`} />
                          <span className="text-xs font-bold">{preset.title}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {preset.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject / Job Role */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    2. Subject / Target Job Role
                  </label>
                  {interviewType in ['hr', 'behavioral'] && (
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      STAR Method Focused
                    </span>
                  )}
                  {interviewType === 'viva' && (
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      Academic Rigor & Proofs
                    </span>
                  )}
                  {interviewType === 'coding' && (
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      Complexity & Edge Cases
                    </span>
                  )}
                  {interviewType === 'project' && (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Architectural Defense
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={subjectRole}
                  onChange={(e) => setSubjectRole(e.target.value)}
                  placeholder="e.g. Python Backend Engineer, OS Viva, React Frontend, etc."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-2"
                />

                {/* Dynamic Track Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {(TRACK_PRESETS[interviewType] || PRESET_ROLES).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSubjectRole(role)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        subjectRole === role
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration Controls (2-column grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Experience Level */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Experience Level
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="student">Student / Intern</option>
                    <option value="fresher">Fresher (0 - 1 year)</option>
                    <option value="junior">Junior (1 - 3 years)</option>
                    <option value="senior">Senior (3+ years)</option>
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="easy">Easy (Fundamentals & Core definitions)</option>
                    <option value="medium">Medium (Realistic Industry Interview)</option>
                    <option value="hard">Hard (Deep edge cases & Complex scenarios)</option>
                    <option value="adaptive">Adaptive (Dynamically scales with performance)</option>
                  </select>
                </div>

                {/* Question Count */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Number of Questions
                    </label>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {totalQuestions} Questions
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                    <span>3 (Quick)</span>
                    <span>5 (Standard)</span>
                    <span>10 (Exhaustive)</span>
                  </div>
                </div>

                {/* Interview Duration */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time Allocation
                    </label>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {allocatedTimeMin} Minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={45}
                    step={5}
                    value={allocatedTimeMin}
                    onChange={(e) => setAllocatedTimeMin(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                    <span>10m</span>
                    <span>20m</span>
                    <span>45m</span>
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Interview Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                    <option value="German">German (Deutsch)</option>
                  </select>
                </div>

                {/* Optional Resume Document */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Resume / Project Document (Optional)
                  </label>
                  <select
                    value={resumeDocId}
                    onChange={(e) => setResumeDocId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">None (Standard Question Pool)</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        📄 {doc.filename} ({doc.chunk_count} chunks)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Button */}
              <div className="pt-2">
                <button
                  onClick={handleStartInterview}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting Up Simulation Room...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Begin Interview Simulation
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* 2. ACTIVE INTERVIEW TAB                                      */}
          {/* ============================================================= */}
          {tab === 'active' && currentSession && currentTurn && (
            <div className="space-y-4">
              {/* Progress and Timer Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Topic {currentTurn.main_question_index} of {currentSession.total_main_questions}
                  </span>
                  {currentTurn.turn_type === 'follow_up' && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      Follow-Up #{currentTurn.follow_up_index}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {currentSession.subject_role} ({currentSession.difficulty})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Countdown Clock */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                    secondsRemaining < 120
                      ? 'bg-red-500/10 text-red-500 border-red-500/40 animate-pulse'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(secondsRemaining)}</span>
                  </div>

                  <button
                    onClick={handleEndEarly}
                    disabled={submittingTurn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Conclude Early
                  </button>
                </div>
              </div>

              {/* Question Display Card */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c1c] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Briefcase className="w-4 h-4" />
                    <span>{currentTurn.turn_type === 'follow_up' ? 'Contextual Follow-Up Probe' : 'Interviewer Question'}</span>
                  </div>
                  {currentTurn.turn_type === 'follow_up' && (
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                      🔍 Probing deeper into your previous explanation
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {currentTurn.question_text}
                </div>

                {/* Coding Starter Code Box if present */}
                {currentTurn.coding_starter_code && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-zinc-100">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 text-[11px] font-mono text-zinc-400">
                      <span>Starter Template</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentTurn.coding_starter_code || '');
                          setCandidateCode(currentTurn.coding_starter_code || '');
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="flex items-center gap-1 hover:text-white transition"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedCode ? 'Copied to Editor' : 'Copy Starter Code'}
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono overflow-x-auto">
                      <code>{currentTurn.coding_starter_code}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Candidate Code Box & Sandbox Runner */}
              {(currentSession.interview_type === 'coding' || currentTurn.coding_starter_code) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-500" />
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                        Interactive Code Sandbox
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Isolated Sandbox
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Language Selector */}
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="python">Python 3</option>
                        <option value="javascript">JavaScript (Node)</option>
                      </select>

                      {/* Reset to starter code */}
                      {currentTurn.coding_starter_code && (
                        <button
                          type="button"
                          onClick={() => setCandidateCode(currentTurn.coding_starter_code || '')}
                          className="px-2 py-1 text-[11px] rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Reset code to starter template"
                        >
                          Reset
                        </button>
                      )}

                      {/* Run Code Button */}
                      <button
                        type="button"
                        onClick={handleExecuteCode}
                        disabled={executingCode || !candidateCode.trim()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition disabled:opacity-50"
                      >
                        {executingCode ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Executing...</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Run Sandbox Tests</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Code Editor Area */}
                  <div className="relative rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-[#141414] focus-within:ring-1 focus-within:ring-emerald-500">
                    <div className="flex items-center justify-between px-3 py-1 bg-[#1a1a1a] border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
                      <span>solution.{selectedLanguage === 'python' ? 'py' : 'js'}</span>
                      <span>3.0s timeout limit</span>
                    </div>
                    <textarea
                      rows={8}
                      value={candidateCode}
                      onChange={(e) => setCandidateCode(e.target.value)}
                      placeholder={selectedLanguage === 'python' ? '# Write your solution function here\ndef solve(*args):\n    pass' : '// Write your solution here\nfunction solve(...args) {\n}'}
                      className="w-full p-3 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none resize-y leading-relaxed"
                      spellCheck={false}
                    />
                  </div>

                  {/* Execution Results Console */}
                  {executionResult && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181818] p-3.5 space-y-3 animate-in fade-in duration-200">
                      {/* Security Violation Alert */}
                      {executionResult.status === 'security_violation' && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">Security Policy Triggered</div>
                            <div className="text-[11px] mt-0.5 leading-relaxed">{executionResult.error_message}</div>
                          </div>
                        </div>
                      )}

                      {/* Timeout Alert */}
                      {executionResult.status === 'timeout' && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">Execution Timeout (3.0s limit)</div>
                            <div className="text-[11px] mt-0.5 leading-relaxed">{executionResult.error_message}</div>
                          </div>
                        </div>
                      )}

                      {/* Runtime Error Alert */}
                      {executionResult.status === 'error' && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-bold">Execution Error</div>
                            <div className="text-[11px] font-mono mt-0.5 whitespace-pre-wrap leading-relaxed">{executionResult.error_message}</div>
                          </div>
                        </div>
                      )}

                      {/* Success / Test Results Summary */}
                      {executionResult.status === 'success' && (
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            {executionResult.total_tests > 0 ? (
                              executionResult.all_passed ? (
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle className="w-4 h-4" />
                                  All {executionResult.total_tests} Tests Passed!
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                  <XCircle className="w-4 h-4" />
                                  {executionResult.passed_tests} / {executionResult.total_tests} Tests Passed
                                </span>
                              )
                            ) : (
                              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="w-4 h-4" />
                                Code Executed Successfully
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            Execution Time: {executionResult.total_execution_time_ms} ms
                          </span>
                        </div>
                      )}

                      {/* Test Case Detail Cards */}
                      {executionResult.test_results && executionResult.test_results.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {executionResult.test_results.map((tr) => (
                            <div
                              key={tr.test_index}
                              className={`p-2.5 rounded-lg border text-xs font-mono transition ${
                                tr.passed
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-zinc-700 dark:text-zinc-300'
                                  : 'bg-rose-500/5 border-rose-500/20 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold flex items-center gap-1.5">
                                  {tr.passed ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  )}
                                  Test Case #{tr.test_index}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {tr.execution_time_ms} ms
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-zinc-400 block text-[10px] uppercase font-sans">Input:</span>
                                  <span className="text-zinc-600 dark:text-zinc-300 break-all">{tr.input_data}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 block text-[10px] uppercase font-sans">Expected:</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 break-all">{tr.expected_output}</span>
                                </div>
                              </div>
                              {tr.actual_output !== undefined && tr.actual_output !== null && (
                                <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[11px]">
                                  <span className="text-zinc-400 block text-[10px] uppercase font-sans">Your Output:</span>
                                  <span className={tr.passed ? 'text-emerald-500' : 'text-rose-500 font-bold'}>
                                    {tr.actual_output}
                                  </span>
                                </div>
                              )}
                              {tr.error && (
                                <div className="mt-1 text-rose-500 text-[10px] whitespace-pre-wrap">
                                  Error: {tr.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Raw Terminal Output Preview */}
                      {executionResult.output && executionResult.output.trim() && (
                        <div className="mt-2 rounded-lg bg-black/90 p-2.5 text-zinc-300 font-mono text-[11px] overflow-x-auto border border-zinc-800">
                          <div className="text-[10px] uppercase text-zinc-500 mb-1 font-sans">Console Standard Output:</div>
                          <pre className="whitespace-pre-wrap">{executionResult.output.trim()}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Verbal / Explanation Answer Area */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {currentSession.interview_type === 'coding' ? 'Solution Explanation & Complexity' : 'Your Answer'}
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {candidateAnswer.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    rows={5}
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Articulate your thought process, answer, or technical justification..."
                    className="w-full p-3.5 pb-12 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  {/* Audio Dictation inside textarea */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      disabled={isTranscribing}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isRecording
                          ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                          : isTranscribing
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      title="Speak answer via Whisper voice transcription"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Transcribing...
                        </>
                      ) : isRecording ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          Recording (Click to stop)
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          Dictate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleSkipTurn}
                  disabled={submittingTurn}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  Skip Question
                </button>

                <button
                  onClick={handleSubmitAnswer}
                  disabled={submittingTurn}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {submittingTurn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Evaluating & Generating Next Turn...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit Answer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* 3. EVALUATION TAB (Teach-After-Interview — Stage 5)          */}
          {/* ============================================================= */}
          {tab === 'evaluation' && evaluation && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Assessment Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <Award className="w-4 h-4 text-emerald-500" />
                      <span>Executive Evaluation</span>
                    </div>

                    {/* Hire Recommendation Badge */}
                    {(evaluation.hire_recommendation || evaluation.evidence_by_category?.hire_recommendation) && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        (evaluation.hire_recommendation || evaluation.evidence_by_category?.hire_recommendation) === 'Strong Hire'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                          : (evaluation.hire_recommendation || evaluation.evidence_by_category?.hire_recommendation) === 'Hire'
                          ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border-teal-500/40'
                          : (evaluation.hire_recommendation || evaluation.evidence_by_category?.hire_recommendation) === 'Borderline'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                      }`}>
                        {evaluation.hire_recommendation || evaluation.evidence_by_category?.hire_recommendation}
                      </span>
                    )}

                    {/* Peer Band Badge */}
                    {(evaluation.peer_band || evaluation.evidence_by_category?.peer_band) && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                        <Sparkles className="w-3 h-3 text-purple-500" />
                        <span>{evaluation.peer_band || evaluation.evidence_by_category?.peer_band}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    {currentSession ? `${currentSession.subject_role} Simulation Review` : 'Interview Assessment Report'}
                  </h3>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 max-w-xl leading-relaxed">
                    {evaluation.summary_verdict}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                    <span>Rubric v{evaluation.rubric_version}</span>
                    <span>•</span>
                    <span>Completed {new Date(evaluation.generated_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      disabled={downloadingReport}
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                    >
                      <Download className="w-3 h-3" />
                      {downloadingReport ? 'Preparing Download...' : 'Download Report (.md)'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-semibold"
                    >
                      {copiedReport ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedReport ? 'Copied Markdown!' : 'Copy Markdown'}
                    </button>
                  </div>
                </div>

                {/* Score Circle Gauge */}
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 shadow-md shrink-0 min-w-[140px]">
                  <div className="relative flex items-center justify-center">
                    <span className="text-3xl font-black font-mono text-emerald-500">
                      {Math.round(evaluation.overall_score)}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
                    Overall Score
                  </span>
                </div>
              </div>

              {/* Sub-Tabs Navigation for Evaluation Suite */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setEvalSubTab('overview')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    evalSubTab === 'overview'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  Overview & Dimensions
                </button>
                <button
                  type="button"
                  onClick={() => setEvalSubTab('teach_back')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    evalSubTab === 'teach_back'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Teach-After-Interview Coaching
                </button>
                <button
                  type="button"
                  onClick={() => setEvalSubTab('roadmap')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    evalSubTab === 'roadmap'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Spaced Repetition Roadmap
                </button>
                <button
                  type="button"
                  onClick={() => setEvalSubTab('full_report')}
                  className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 ${
                    evalSubTab === 'full_report'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Full Markdown Report
                </button>
              </div>

              {/* Sub-Tab 1: Overview & Dimensions */}
              {evalSubTab === 'overview' && (
                <div className="space-y-6">
                  {/* Performance Dimensions with Progress Bars */}
                  {evaluation.dimension_scores && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                        Normalized Rubric Breakdown
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {Object.entries(evaluation.dimension_scores).map(([dim, score]) => {
                          const numScore = Math.round(Number(score));
                          const barColor =
                            numScore >= 75
                              ? 'bg-emerald-500'
                              : numScore >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500';
                          return (
                            <div key={dim} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 capitalize truncate">
                                  {dim.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                  {numScore} <span className="text-[10px] text-zinc-400 font-normal">/ 100</span>
                                </span>
                              </div>
                              {/* Visual Progress Bar */}
                              <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                <div
                                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                  style={{ width: `${Math.max(4, Math.min(100, numScore))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Knowledge Gaps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Key Strengths Demonstrated
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {(evaluation.key_strengths || []).map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Knowledge Gaps */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        Target Areas for Improvement
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {(evaluation.knowledge_gaps || []).map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Teach-After-Interview Coaching */}
              {evalSubTab === 'teach_back' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Review detailed question-by-question coaching, candidate attempt evaluations, and ideal expert answers.
                    </span>
                  </div>

                  {evaluation.teach_after_feedback && evaluation.teach_after_feedback.length > 0 ? (
                    <div className="space-y-4">
                      {evaluation.teach_after_feedback.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4.5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c1c] border border-zinc-200 dark:border-zinc-800 text-xs space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Q{item.question_number}
                              </span>
                              <span>{item.question_topic}</span>
                            </div>

                            {/* Key Concepts Pills */}
                            {item.key_concepts && item.key_concepts.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.key_concepts.map((kc, kIdx) => (
                                  <span
                                    key={kIdx}
                                    className="px-2 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                  >
                                    #{kc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Candidate Attempt Critique */}
                          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-[#151515] text-zinc-700 dark:text-zinc-300">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                              Interviewer Feedback on Your Answer:
                            </span>
                            <p className="leading-relaxed whitespace-pre-wrap">{item.candidate_attempt_review}</p>
                          </div>

                          {/* Common Mistakes Avoidance */}
                          {item.common_mistakes && item.common_mistakes.length > 0 && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                              <span className="font-bold block mb-1">Common Candidate Pitfalls:</span>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                {item.common_mistakes.map((cm, cIdx) => (
                                  <li key={cIdx}>{cm}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Expert Ideal Explanation */}
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-950 dark:text-emerald-100 space-y-1.5">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 block text-[11px] uppercase tracking-wider">
                              Expert Ideal Model Answer:
                            </span>
                            <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                              {item.ideal_model_answer}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-zinc-400 border border-dashed rounded-xl">
                      Detailed teach-back items were incorporated directly into the summary report.
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 3: Spaced Repetition Study Roadmap */}
              {evalSubTab === 'roadmap' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Automated spaced-repetition plan targeting identified gaps to reinforce retention before your next interview.
                    </span>
                  </div>

                  {evaluation.study_roadmap && evaluation.study_roadmap.length > 0 ? (
                    <div className="space-y-2.5">
                      {evaluation.study_roadmap.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span>{item.topic}</span>
                            </div>
                            <div className="text-zinc-600 dark:text-zinc-300 text-[11px] leading-relaxed">
                              {item.action_item}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Spaced Repetition Countdown Badge */}
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                              <Calendar className="w-3 h-3 text-emerald-500" />
                              Review in {item.review_in_days || (item.priority === 'high' ? 1 : item.priority === 'medium' ? 3 : 7)} {item.review_in_days === 1 ? 'day' : 'days'}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                item.priority === 'high'
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                                  : item.priority === 'medium'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                  : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-zinc-400 border border-dashed rounded-xl">
                      No specific roadmap items generated for this session.
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 4: Full Markdown Report */}
              {evalSubTab === 'full_report' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Complete evaluation document with full rubric breakdowns and evidence.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                      >
                        {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedReport ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadReport}
                        disabled={downloadingReport}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .md
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-200 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-96 border border-zinc-800">
                    {evaluation.full_report_markdown}
                  </pre>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="pt-2 flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setTab('setup')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                >
                  Start New Interview
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Close Suite
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* 4. HISTORY TAB                                               */}
          {/* ============================================================= */}
          {tab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Your Past Interview Simulations
              </h3>

              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs text-zinc-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading interview records...
                </div>
              ) : pastSessions.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  No previous interview simulations found. Begin your first session from the New Interview tab!
                </div>
              ) : (
                <div className="space-y-2">
                  {pastSessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span>{s.subject_role}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {s.interview_type}
                          </span>
                          {s.evaluation && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              {Math.round(s.evaluation.overall_score)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {new Date(s.created_at).toLocaleDateString()} • {s.main_questions_answered} of {s.total_main_questions} answered • Status: {s.status}
                        </div>
                      </div>

                      <button
                        onClick={() => handleViewPastSession(s.id)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition shrink-0"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
