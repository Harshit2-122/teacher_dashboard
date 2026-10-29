import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectTeacherSpeechStream,
  type TeacherSpeechStreamController,
} from '../services/api';
import {
  startAudioRecording,
  type AudioRecorderController,
  type AudioChunk,
} from '../services/audioRecorder';
import type {
  SpeechRecognitionStatus,
  TeacherTranscriptSegment,
  TranscriptDeliveryStats,
} from '../types';

interface SpeechWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as SpeechWindow;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export type SupportedLanguage = 'en-IN' | 'en-US' | 'hi-IN';
export type SpeechEngine = 'whisper' | 'webspeech';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
];

interface UseTeacherSpeechRecognitionProps {
  sessionId?: string;
  isSessionActive?: boolean;
}

export function useTeacherSpeechRecognition({
  sessionId = 'default-session',
}: UseTeacherSpeechRecognitionProps = {}) {
  const [engine, setEngine] = useState<SpeechEngine>('webspeech');
  const [isSupported] = useState<boolean>(true);
  const [status, setStatus] = useState<SpeechRecognitionStatus>('ready');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start');
  const [language, setLanguageState] = useState<SupportedLanguage>('en-IN');
  const [segments, setSegments] = useState<TeacherTranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // References across callbacks
  const engineRef = useRef<SpeechEngine>('webspeech');
  const recorderRef = useRef<AudioRecorderController | null>(null);
  const wsStreamRef = useRef<TeacherSpeechStreamController | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterimRef = useRef<string>('');

  const isListeningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const languageRef = useRef<SupportedLanguage>('en-IN');
  const nextSegmentIdRef = useRef<number>(1);
  const sessionIdRef = useRef<string>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      wsStreamRef.current?.disconnect();
      void recorderRef.current?.stop();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Handle incoming finalized transcript from backend WebSocket
  const handleServerTranscript = useCallback((data: {
    segmentId: number;
    text: string;
    gloss_tokens?: string[];
    is_final?: boolean;
  }) => {
    if (!data.text || !data.text.trim()) return;

    setInterimText('');
    lastInterimRef.current = '';

    setSegments(prev => {
      const existingIdx = prev.findIndex(s => s.segmentId === data.segmentId);
      if (existingIdx >= 0) {
        return prev.map(s =>
          s.segmentId === data.segmentId
            ? { ...s, text: data.text, isFinal: true, deliveryStatus: 'delivered' }
            : s
        );
      }

      const newSegment: TeacherTranscriptSegment = {
        segmentId: data.segmentId || nextSegmentIdRef.current++,
        text: data.text.trim(),
        timestamp: new Date().toISOString(),
        isFinal: true,
        deliveryStatus: 'delivered',
      };
      return [...prev, newSegment];
    });

    setStatus('sent');
    setStatusMessage('Transcribed & Broadcasted');

    setTimeout(() => {
      if (isListeningRef.current && !isPausedRef.current) {
        setStatus('listening');
        setStatusMessage('Streaming Live Audio');
      }
    }, 700);
  }, []);

  // Handle incoming interim live transcription
  const handleServerInterim = useCallback((text: string) => {
    if (isPausedRef.current) return;
    setInterimText(text);
    if (text) {
      setStatus('speech-detected');
      setStatusMessage('Speech detected');
    }
  }, []);

  // ── Browser Continuous Speech Recognition ─────────────────────────────────
  const startWebSpeechInstance = useCallback(() => {
    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      setStatus('unsupported');
      setStatusMessage('Web Speech is not supported in this browser. Please use Chrome, Edge, or Brave.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = languageRef.current;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        if (!isPausedRef.current) {
          setStatus('listening');
          setStatusMessage('Listening (Live Stream)');
        }
      };

      rec.onspeechstart = () => {
        if (!isPausedRef.current) {
          setStatus('speech-detected');
          setStatusMessage('Speech detected');
        }
      };

      rec.onspeechend = () => {
        if (isListeningRef.current && !isPausedRef.current) {
          setStatus('listening');
          setStatusMessage('Listening');
        }
      };

      rec.onresult = (event: any) => {
        if (isPausedRef.current) return;
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';

          if (item.isFinal) {
            const trimmed = text.trim();
            if (trimmed.length > 0) {
              const segId = nextSegmentIdRef.current++;
              const newSegment: TeacherTranscriptSegment = {
                segmentId: segId,
                text: trimmed,
                timestamp: new Date().toISOString(),
                isFinal: true,
                deliveryStatus: 'delivered',
              };

              setSegments(prev => [...prev, newSegment]);

              // Transmit speech text continuously to backend over WebSocket!
              if (wsStreamRef.current) {
                wsStreamRef.current.sendTextMessage(trimmed);
              }
              lastInterimRef.current = '';
            }
          } else {
            currentInterim += text;
          }
        }

        lastInterimRef.current = currentInterim;
        setInterimText(currentInterim);
      };

      rec.onerror = (event: any) => {
        const errorType = event.error;
        if (errorType === 'no-speech') return;

        if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
          setStatus('permission-required');
          setStatusMessage('Microphone permission required in browser settings.');
          isListeningRef.current = false;
          setIsListening(false);
          return;
        }

        if (errorType !== 'aborted') {
          setStatusMessage(`Speech status: ${errorType}`);
        }
      };

      rec.onend = () => {
        const lingering = lastInterimRef.current.trim();
        if (lingering.length > 0) {
          const finalSeg: TeacherTranscriptSegment = {
            segmentId: nextSegmentIdRef.current++,
            text: lingering,
            timestamp: new Date().toISOString(),
            isFinal: true,
            deliveryStatus: 'delivered',
          };
          setSegments(prev => [...prev, finalSeg]);
          wsStreamRef.current?.sendTextMessage(lingering);
          lastInterimRef.current = '';
          setInterimText('');
        }

        // Keep continuous speech recognition loop alive
        if (isListeningRef.current && !isPausedRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current && !isPausedRef.current) {
              startWebSpeechInstance();
            }
          }, 200);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('[TeacherSTT] Error launching SpeechRecognition:', err);
    }
  }, []);

  // ── Start Listening Action (Unified Audio Metering + Live Continuous STT) ─
  const startListening = useCallback(async () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    isListeningRef.current = true;
    isPausedRef.current = false;
    setIsListening(true);
    setIsPaused(false);
    setStatus('listening');
    setStatusMessage('Connecting Continuous Live Stream…');

    // 1. Establish continuous live WebSocket connection to backend
    const lang = languageRef.current.startsWith('hi') ? 'hi' : 'en';
    const wsController = connectTeacherSpeechStream(
      sessionIdRef.current,
      lang,
      {
        onTranscript: handleServerTranscript,
        onInterim: handleServerInterim,
        onStatusChange: (s) => {
          if (s === 'connected' && isListeningRef.current) {
            setStatus('listening');
            setStatusMessage('Live Stream Active');
          } else if (s === 'error' || s === 'disconnected') {
            setStatusMessage('WebSocket Stream Reconnecting…');
          }
        },
        onError: (err) => {
          console.warn('[SpeechWS] Notice:', err.message);
        },
      }
    );
    wsStreamRef.current = wsController;

    // 2. Start microphone volume visualizer & audio recorder
    try {
      const controller = await startAudioRecording({
        sliceIntervalMs: 1000,
        onVolumeChange: (vol) => {
          if (isListeningRef.current && !isPausedRef.current) {
            setMicLevel(vol);
          }
        },
        onAudioChunk: (chunk: AudioChunk) => {
          if (isListeningRef.current && !isPausedRef.current && wsStreamRef.current) {
            wsStreamRef.current.sendAudioChunk(chunk.blob);
          }
        },
        onError: (err) => {
          console.error('[AudioRecorder] Error:', err);
        },
      });
      recorderRef.current = controller;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED')) {
        setStatus('permission-required');
        setStatusMessage('Microphone permission denied. Please allow microphone in browser.');
        isListeningRef.current = false;
        setIsListening(false);
        return;
      }
    }

    // 3. Start Browser Native Continuous Speech Recognition
    startWebSpeechInstance();
  }, [handleServerTranscript, handleServerInterim, startWebSpeechInstance]);

  // ── Stop Listening Action ─────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    isListeningRef.current = false;
    isPausedRef.current = false;
    setIsListening(false);
    setIsPaused(false);
    setStatus('ready');
    setStatusMessage('Ready to start');
    setInterimText('');
    setMicLevel(0);

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recorderRef.current) {
      try {
        await recorderRef.current.stop();
      } catch (e) {
        console.warn('Failed stopping recorder', e);
      }
      recorderRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    // Short grace period before closing socket so final message delivers
    setTimeout(() => {
      if (!isListeningRef.current && wsStreamRef.current) {
        wsStreamRef.current.disconnect();
        wsStreamRef.current = null;
      }
    }, 500);
  }, []);

  // ── Pause Listening Action ────────────────────────────────────────────────
  const pauseListening = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setStatus('paused');
    setStatusMessage('Paused');
    setInterimText('');
    setMicLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // ── Resume Listening Action ───────────────────────────────────────────────
  const resumeListening = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    setStatus('listening');
    setStatusMessage('Streaming Live Audio');
    startWebSpeechInstance();
  }, [startWebSpeechInstance]);

  // ── Language Selector ─────────────────────────────────────────────────────
  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    languageRef.current = newLang;
  }, []);

  // ── Engine Switcher ───────────────────────────────────────────────────────
  const switchEngine = useCallback((newEngine: SpeechEngine) => {
    if (isListeningRef.current) {
      void stopListening();
    }
    setEngine(newEngine);
    engineRef.current = newEngine;
  }, [stopListening]);

  // ── Send Manual Text (via WebSocket, NO HTTP send_speech) ─────────────────
  const sendManualText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const segId = nextSegmentIdRef.current++;
      const newSegment: TeacherTranscriptSegment = {
        segmentId: segId,
        text: trimmed,
        timestamp: new Date().toISOString(),
        isFinal: true,
        deliveryStatus: 'delivered',
      };

      setSegments(prev => [...prev, newSegment]);

      if (wsStreamRef.current && wsStreamRef.current.isConnected()) {
        wsStreamRef.current.sendTextMessage(trimmed);
      } else {
        const lang = languageRef.current.startsWith('hi') ? 'hi' : 'en';
        const tempWs = connectTeacherSpeechStream(sessionIdRef.current, lang, {
          onStatusChange: (st) => {
            if (st === 'connected') {
              tempWs.sendTextMessage(trimmed);
            }
          },
        });
      }
    },
    []
  );

  const clearTranscript = useCallback(() => {
    setSegments([]);
    setInterimText('');
    lastInterimRef.current = '';
  }, []);

  const retryFailedDeliveries = useCallback(() => {
    setSegments(prev =>
      prev.map(s => (s.deliveryStatus === 'failed' ? { ...s, deliveryStatus: 'delivered' } : s))
    );
  }, []);

  const deliveryStats: TranscriptDeliveryStats = {
    totalSegments: segments.length,
    deliveredCount: segments.filter(s => s.deliveryStatus === 'delivered').length,
    failedCount: segments.filter(s => s.deliveryStatus === 'failed').length,
    pendingCount: segments.filter(s => s.deliveryStatus === 'sending').length,
  };

  return {
    engine,
    setEngine: switchEngine,
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
  };
}
