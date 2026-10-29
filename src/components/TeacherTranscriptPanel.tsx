import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Minus,
  Plus,
  Trash2,
  
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
  Volume2,
  Send,
  Languages,
  Sparkles,
  Settings,
  Server,
  Check,
} from 'lucide-react';
import type {
  SpeechRecognitionStatus,
  TeacherTranscriptSegment,
  TranscriptDeliveryStats,
} from '../types';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type SpeechEngine,
} from '../hooks/useTeacherSpeechRecognition';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';

interface TeacherTranscriptPanelProps {
  engine: SpeechEngine;
  onEngineChange: (engine: SpeechEngine) => void;
  status: SpeechRecognitionStatus;
  statusMessage: string;
  segments: TeacherTranscriptSegment[];
  interimText: string;
  micLevel: number;
  isSupported: boolean;
  isListening: boolean;
  isPaused: boolean;
  deliveryStats: TranscriptDeliveryStats;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onSendManualText: (text: string) => void;
  onStartListening: () => void;
  onPauseListening: () => void;
  onResumeListening: () => void;
  onStopListening: () => void;
  onClear: () => void;
  onRetryFailed: () => void;
}

const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;
type FontSize = typeof FONT_SIZES[number];
const FONT_LABELS = ['S', 'M', 'L', 'XL'];

const QUICK_PHRASES = [
  'Good morning class',
  'Please open your books',
  'Look at the board',
  'Do you have any questions?',
  'Thank you everyone',
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function getStatusBadge(status: SpeechRecognitionStatus, statusMessage: string) {
  switch (status) {
    case 'ready':
      return {
        label: 'Ready to start',
        dot: 'bg-slate-400',
        text: 'text-slate-600 dark:text-slate-300',
        bg: 'bg-slate-500/10 border-slate-500/25',
      };
    case 'permission-required':
      return {
        label: 'Microphone permission required',
        dot: 'bg-amber-400 animate-pulse',
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-500/10 border-amber-500/30',
      };
    case 'listening':
      return {
        label: 'Listening',
        dot: 'bg-emerald-500 animate-pulse',
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
      };
    case 'speech-detected':
      return {
        label: 'Speech detected',
        dot: 'bg-indigo-500 animate-ping',
        text: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-500/10 border-indigo-500/30',
      };
    case 'paused':
      return {
        label: 'Paused',
        dot: 'bg-amber-500',
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-500/10 border-amber-500/30',
      };
    case 'sending':
      return {
        label: 'Streaming to backend',
        dot: 'bg-indigo-400 animate-spin',
        text: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-500/10 border-indigo-500/30',
      };
    case 'sent':
      return {
        label: 'Sent to backend',
        dot: 'bg-emerald-400',
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
      };
    case 'connection-lost':
      return {
        label: 'Backend unreachable',
        dot: 'bg-rose-500',
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-500/10 border-rose-500/30',
      };
    case 'unsupported':
      return {
        label: 'Microphone unsupported',
        dot: 'bg-rose-500',
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-500/10 border-rose-500/30',
      };
    default:
      return {
        label: statusMessage || 'Standby',
        dot: 'bg-slate-400',
        text: 'text-slate-600 dark:text-slate-300',
        bg: 'bg-slate-500/10 border-slate-500/25',
      };
  }
}

export default function TeacherTranscriptPanel({
  engine,
  onEngineChange,
  status,
  statusMessage,
  segments,
  interimText,
  micLevel,
  isListening,
  isPaused,
  deliveryStats,
  language,
  onLanguageChange,
  onSendManualText,
  onStartListening,
  onPauseListening,
  onResumeListening,
  onStopListening,
  onClear,
  onRetryFailed,
}: TeacherTranscriptPanelProps) {
  const [fontIdx, setFontIdx] = useState<number>(1);
  const [manualInput, setManualInput] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [configUrl, setConfigUrl] = useState<string>(() => getApiBaseUrl());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const fontSize = FONT_SIZES[fontIdx] as FontSize;
  const statusInfo = getStatusBadge(status, statusMessage);
  const hasSegments = segments.length > 0;

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (!isPaused && !userScrolled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [segments, interimText, isPaused, userScrolled]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  }, []);



  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onSendManualText(manualInput.trim());
    setManualInput('');
  };

  const handleSaveConfig = () => {
    setApiBaseUrl(configUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <section
      aria-labelledby="teacher-transcript-heading"
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--card-glow)] flex flex-col h-full min-h-[540px] transition-colors overflow-hidden"
    >
      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-2)]/40 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h2 id="teacher-transcript-heading" className="text-[var(--text)] font-bold text-sm sm:text-base">
              Live Transcript & Speech Broadcaster
            </h2>
            <p className="text-[var(--text-muted)] text-[11px]">
              Microphone Audio → Whisper / ISL Grammar Engine → Student Broadcast
            </p>
          </div>
        </div>

        {/* Header controls: Engine Toggle, Language, Settings */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Engine Selector */}
          <div className="flex items-center p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs">
            <button
              type="button"
              onClick={() => onEngineChange('whisper')}
              title="Backend Whisper AI model — highly accurate multilingual speech recognition"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                engine === 'whisper'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Whisper AI</span>
            </button>
            <button
              type="button"
              onClick={() => onEngineChange('webspeech')}
              title="Fast browser native speech recognition"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                engine === 'webspeech'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Fast STT</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs">
            <Languages className="w-3.5 h-3.5 text-indigo-500" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              aria-label="Speech Recognition Language"
              className="bg-transparent text-[var(--text)] text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[var(--surface)] text-[var(--text)]">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Backend Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowConfig(s => !s)}
            title="Configure Backend API Server URL"
            className="p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-indigo-500 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Backend Settings Drawer (if toggled) */}
      {showConfig && (
        <div className="p-3 bg-indigo-500/5 border-b border-[var(--border)] flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Server className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-medium text-[var(--text)]">Backend API URL:</span>
            <input
              type="text"
              value={configUrl}
              onChange={(e) => setConfigUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveConfig}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors text-xs"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{savedSuccess ? 'Saved!' : 'Save URL'}</span>
          </button>
        </div>
      )}

      {/* Speech control bar */}
      <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/20 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Mic Action Controls */}
        <div className="flex items-center gap-2">
          {!isListening ? (
            <button
              onClick={onStartListening}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-sm active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Start Speaking</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onStopListening}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-sm active:scale-95"
              >
                <MicOff className="w-4 h-4" />
                <span>Stop & Send</span>
              </button>

              {isPaused ? (
                <button
                  onClick={onResumeListening}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] font-medium text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={onPauseListening}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] font-medium text-xs transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pause</span>
                </button>
              )}
            </div>
          )}

          {/* Mic Volume Level Visualizer */}
          <div
            title={`Mic Audio Level: ${micLevel}%`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs"
          >
            <Volume2 className={`w-3.5 h-3.5 ${micLevel > 15 ? 'text-indigo-500' : 'text-slate-400'}`} />
            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-75"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Status Pill & Utility Actions */}
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.bg}`}>
            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span className={statusInfo.text}>{statusInfo.label}</span>
          </div>

          {/* Font Resizer */}
          <div className="flex items-center p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <button
              onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
              disabled={fontIdx === 0}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
              title="Decrease font size"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-bold text-[var(--text)]">
              {FONT_LABELS[fontIdx]}
            </span>
            <button
              onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
              disabled={fontIdx === FONT_SIZES.length - 1}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
              title="Increase font size"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clear button */}
          <button
            onClick={onClear}
            disabled={!hasSegments}
            className="p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 disabled:opacity-30 transition-colors"
            title="Clear transcript history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Retry banner if any segment delivery failed */}
      {deliveryStats.failedCount > 0 && (
        <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>
              {deliveryStats.failedCount} transcript segment{deliveryStats.failedCount > 1 ? 's' : ''} failed to deliver to backend.
            </span>
          </div>
          <button
            onClick={onRetryFailed}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Delivery</span>
          </button>
        </div>
      )}

      {/* Transcript body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-4"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Live teacher transcript"
      >
        {!hasSegments && !interimText ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mb-3 text-[var(--text-faint)]">
              <Volume2 className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-[var(--text)] font-semibold text-sm">
              Microphone ready for lecture
            </h3>
            <p className="text-[var(--text-muted)] text-xs max-w-sm mt-1 leading-relaxed">
              Click <strong className="text-indigo-500 font-semibold">Start Speaking</strong> using{' '}
              <strong>{engine === 'whisper' ? 'Whisper AI Audio' : 'Fast Browser STT'}</strong>. Your spoken lecture is converted to text, translated to ISL grammar, and broadcasted to students in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((seg, idx) => (
              <div
                key={seg.segmentId}
                className="group p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/30 hover:border-indigo-500/30 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                      Segment #{idx + 1}
                    </span>
                    {/* Delivery Status Tag */}
                    {seg.deliveryStatus === 'delivered' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Delivered & Broadcasted
                      </span>
                    ) : seg.deliveryStatus === 'sending' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                        Transcribing…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Delivery failed
                      </span>
                    )}
                  </div>

                  <time dateTime={seg.timestamp} className="text-[10px] text-[var(--text-faint)] font-mono">
                    {formatTime(seg.timestamp)}
                  </time>
                </div>

                {/* Transcribed Speech */}
                <p className={`${fontSize} text-[var(--text)] leading-relaxed font-normal`}>
                  {seg.text}
                </p>

                {seg.deliveryError && (
                  <p className="mt-1 text-[10px] text-rose-500 dark:text-rose-400 font-mono">
                    Delivery error: {seg.deliveryError}
                  </p>
                )}
              </div>
            ))}

            {/* Interim live speech currently being uttered */}
            {interimText && (
              <div className="p-3.5 rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-indigo-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  <span>Transcribing speech in real-time…</span>
                </div>
                <p className={`${fontSize} text-[var(--text)] italic leading-relaxed`}>
                  {interimText}
                </p>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      {/* Quick Phrase Chips */}
      <div className="px-3 pt-2 bg-[var(--surface-2)]/40 border-t border-[var(--border)] flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0 mr-1">
          Quick:
        </span>
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => onSendManualText(phrase)}
            className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[11px] font-medium hover:border-indigo-500/50 hover:text-indigo-500 shrink-0 transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Manual Input Fallback & Testing Bar */}
      <div className="p-3 bg-[var(--surface-2)]/60">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type custom text to stream directly to students (press Enter)..."
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Footer telemetry bar */}
      <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--surface-2)]/40 flex items-center justify-between text-[11px] text-[var(--text-muted)] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>
            Total Segments: <strong className="text-[var(--text)]">{deliveryStats.totalSegments}</strong>
          </span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            Delivered: <strong>{deliveryStats.deliveredCount}</strong>
          </span>
          {deliveryStats.failedCount > 0 && (
            <>
              <span>•</span>
              <span className="text-rose-500">
                Failed: <strong>{deliveryStats.failedCount}</strong>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-indigo-500 font-semibold">
            ● Mode: {engine === 'whisper' ? 'Whisper Audio' : 'Fast STT'}
          </span>
          <span>•</span>
          <span className="text-[var(--text-muted)]">
            Host: {getApiBaseUrl()}
          </span>
        </div>
      </div>
    </section>
  );
}
