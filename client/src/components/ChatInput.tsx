'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowUp,
  Paperclip,
  Square,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
} from 'lucide-react';
import { AudioRecorder } from '@/lib/audioRecorder';
import { transcribeAudio } from '@/lib/api';

interface ChatInputProps {
  onSendMessage: (content: string, attachedFile?: File, imageDataUrl?: string) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Clean up timer and recorder on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.isRecording) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && !selectedFile && !imageDataUrl) || isStreaming || disabled) return;
    onSendMessage(input.trim(), selectedFile || undefined, imageDataUrl || undefined);
    setInput('');
    setSelectedFile(null);
    setImageDataUrl(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = ['.pdf', '.docx', '.txt', '.csv', '.json', '.png', '.jpg', '.jpeg', '.webp'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        alert('Supported formats: PDF, DOCX, TXT, CSV, JSON, PNG, JPG, WEBP');
        return;
      }

      setSelectedFile(file);

      // If image, convert to data URL for OCR / Vision processing
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt)) {
        const reader = new FileReader();
        reader.onload = () => {
          setImageDataUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImageDataUrl(null);
      }
    }
  };

  // Voice recording toggle handler (SDE-4 pipeline)
  const toggleRecording = async () => {
    if (disabled || isStreaming || isTranscribing) return;

    if (isRecording) {
      // STOP recording & transcribe
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (!recorderRef.current) return;
      setIsTranscribing(true);
      setVoiceNotice('Processing speech chunks with SDE-4 pipeline...');

      try {
        const audioBlob = await recorderRef.current.stop();
        const result = await transcribeAudio(audioBlob);

        if (result.text && result.text.trim()) {
          setInput((prev) => (prev.trim() ? `${prev.trim()} ${result.text.trim()}` : result.text.trim()));
          setVoiceNotice(`Transcribed in ${result.duration_s?.toFixed(2) || '1.2'}s (${result.chunks_processed || 0} chunks)`);
        } else {
          setVoiceNotice('No speech recognized (make sure your mic is unmuted)');
        }
      } catch (err) {
        setVoiceNotice(err instanceof Error ? err.message : 'Transcription failed');
      } finally {
        setIsTranscribing(false);
        setTimeout(() => setVoiceNotice(null), 4000);
        textareaRef.current?.focus();
      }
    } else {
      // START recording
      try {
        const recorder = new AudioRecorder();
        await recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
        setRecordSeconds(0);
        setVoiceNotice(null);

        timerRef.current = setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);
      } catch (err) {
        alert('Microphone access denied or audio device unavailable: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (fileName.endsWith('.json')) return <FileCode className="w-4 h-4 text-amber-400" />;
    if (fileName.match(/\.(png|jpg|jpeg|webp)$/i)) return <ImageIcon className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-4 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* Status / Preview Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {selectedFile && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212121] border border-zinc-700 text-xs text-zinc-200">
              {getFileIcon(selectedFile.name)}
              <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
              <span className="text-[10px] text-zinc-400">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-0.5 hover:text-rose-400 text-zinc-400 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Voice Recording Pill */}
          {isRecording && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-medium">Listening ({formatTimer(recordSeconds)})</span>
              <span className="text-[10px] text-rose-400">• Click mic to transcribe</span>
            </div>
          )}

          {/* Transcribing Spinner Pill */}
          {isTranscribing && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Transcribing voice chunks...</span>
            </div>
          )}

          {/* Voice Notice (duration / stats) */}
          {!isRecording && !isTranscribing && voiceNotice && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-700">
              <span>🎙️ {voiceNotice}</span>
            </div>
          )}
        </div>

        {/* Input Pill Box */}
        <div className={`relative flex items-end gap-2 bg-[#212121] border rounded-2xl p-2 transition-colors shadow-lg ${
          isRecording ? 'border-rose-500/60 ring-1 ring-rose-500/30' : 'border-zinc-800 focus-within:border-zinc-600'
        }`}>
          {/* File Upload Trigger */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.csv,.json,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || isTranscribing}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition shrink-0 disabled:opacity-40"
            title="Attach file or image for OCR (PDF, DOCX, TXT, CSV, JSON, PNG, JPG)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice / Mic Button (SDE-4 Speech-to-Text) */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled || isStreaming || isTranscribing}
            className={`p-2 rounded-xl transition shrink-0 ${
              isRecording
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 animate-pulse'
                : isTranscribing
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title={isRecording ? 'Click to finish speaking and transcribe' : 'Dictate with Voice (SDE-4 Speech-to-Text)'}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? 'Listening to your voice... speak now, then click the mic button to transcribe.'
                : 'Message LEARN.GPT... (or click 🎙️ to speak, attach files, /image to draw)'
            }
            disabled={disabled}
            className="flex-1 bg-transparent border-0 text-sm text-white placeholder-zinc-500 focus:outline-none resize-none py-1.5 max-h-48 scrollbar-thin scrollbar-thumb-zinc-700"
          />

          {/* Send or Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="p-2 rounded-xl bg-zinc-200 hover:bg-white text-black transition shrink-0 shadow-md"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || disabled || isRecording || isTranscribing}
              className={`p-2 rounded-xl transition shrink-0 shadow-md ${
                (input.trim() || selectedFile) && !disabled && !isRecording && !isTranscribing
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Bottom Disclaimer */}
        <p className="text-[11px] text-center text-zinc-500 mt-2">
          LEARN.GPT Voice & Chat Platform · Speech-to-Text Pipeline · Hosted on Groq Cloud
        </p>
      </div>
    </div>
  );
}
