import { useTeacherSession } from '../hooks/useTeacherSession';
import { useTeacherSpeechRecognition } from '../hooks/useTeacherSpeechRecognition';
import TeacherTranscriptPanel from '../components/TeacherTranscriptPanel';
import ConnectionBadge from '../components/ConnectionBadge';
import { Calendar, User, Radio, Play, Square, Clock } from 'lucide-react';
import type { ConnectionStatus } from '../types';

export default function TeacherStreamView() {
  const {
    session,
    formattedDuration,
    isInitializing,
    startClass,
    endClass,
  } = useTeacherSession();

  const isClassActive = session.status === 'active';

  const {
    engine,
    setEngine,
    status,
    statusMessage,
    segments,
    interimText,
    micLevel,
    isSupported,
    isListening,
    isPaused,
    deliveryStats,
    language,
    setLanguage,
    sendManualText,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    clearTranscript,
    retryFailedDeliveries,
  } = useTeacherSpeechRecognition({
    sessionId: session.sessionId || 'sarthi-session-default',
    isSessionActive: isClassActive,
  });

  // Calculate high-level connection badge state
  const connectionStatus: ConnectionStatus = session.isBackendConnected
    ? 'connected'
    : status === 'connection-lost'
    ? 'lost'
    : 'demo';

  const handleEndClass = () => {
    if (isListening) {
      stopListening();
    }
    endClass();
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 flex-1">
        
        {/* Session header bar with title, timer, controls, and connection badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--card-glow)] transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-[var(--text)] font-bold text-base sm:text-lg">
                  {session?.subject || 'Classroom Broadcast Studio'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Radio className={`w-3 h-3 ${isClassActive ? 'animate-pulse text-indigo-500' : ''}`} />
                  {isClassActive ? 'Broadcasting Live' : 'Studio Ready'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                {session?.teacherName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    {session.teacherName} (Instructor)
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {session?.startedAt
                    ? `Started ${new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Class Session Idle'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls: Live Session Clock, Start/End Class, Connection Badge */}
          <div className="flex items-center gap-3 flex-wrap self-end md:self-auto">
            {/* Session Duration Clock */}
            <div
              title="Class Session Duration"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-xs font-bold text-[var(--text)] shadow-sm"
            >
              <Clock className={`w-3.5 h-3.5 ${isClassActive ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
              <span>{formattedDuration}</span>
            </div>

            {/* Start / End Classroom Session Button */}
            {!isClassActive ? (
              <button
                onClick={() => void startClass()}
                disabled={isInitializing}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/25 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition-all duration-150"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isInitializing ? 'Starting…' : 'Start Class'}</span>
              </button>
            ) : (
              <button
                onClick={handleEndClass}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-600/25 hover:bg-rose-500 active:scale-95 transition-all duration-150"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>End Class</span>
              </button>
            )}

            <ConnectionBadge status={connectionStatus} />
          </div>
        </div>

        {/* Full-width Live Transcript Panel */}
        <div className="flex-1 flex flex-col min-h-[580px]">
          <TeacherTranscriptPanel
            engine={engine}
            onEngineChange={setEngine}
            status={status}
            statusMessage={statusMessage}
            segments={segments}
            interimText={interimText}
            micLevel={micLevel}
            isSupported={isSupported}
            isListening={isListening}
            isPaused={isPaused}
            deliveryStats={deliveryStats}
            language={language}
            onLanguageChange={setLanguage}
            onSendManualText={sendManualText}
            onStartListening={startListening}
            onPauseListening={pauseListening}
            onResumeListening={resumeListening}
            onStopListening={stopListening}
            onClear={clearTranscript}
            onRetryFailed={retryFailedDeliveries}
          />
        </div>

      </div>
    </div>
  );
}
