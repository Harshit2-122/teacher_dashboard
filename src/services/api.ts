/**
 * api.ts — Backend API & Continuous WebSocket service layer for SARTHI Teacher Dashboard.
 * 
 * Continuous Live Streaming Architecture:
 * 1. Audio stream & speech text flow continuously from Teacher Microphone -> WebSocket (/ws/speech).
 * 2. Backend translates English to ISL (SOV) and broadcasts to Student Dashboards (/ws/viewer).
 * 3. Teacher dashboard receives real-time delivery confirmations.
 */

import type {
  TranscriptSegment,
  ISLSegment,
  SessionInfo,
  TeacherSessionInfo,
  ClassSummary,
  ConnectionStatus,
} from '../types';

const STORAGE_API_KEY = 'sarthi_teacher_api_base';
const STORAGE_WS_SPEECH_KEY = 'sarthi_teacher_ws_speech_url';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_API_KEY);
    if (saved && saved.trim()) {
      // Discard stale localhost or ngrok if envUrl is configured with a real server
      if ((saved.includes('localhost') || saved.includes('ngrok')) && envUrl && !envUrl.includes('localhost') && !envUrl.includes('ngrok')) {
        localStorage.removeItem(STORAGE_API_KEY);
      } else if (!saved.includes('ngrok')) {
        return saved.trim().replace(/\/+$/, '');
      }
    }
  }
  if (envUrl && envUrl.trim() && !envUrl.includes('ngrok')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem(STORAGE_API_KEY, url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem(STORAGE_API_KEY);
    }
  }
}

export function getWsSpeechUrl(): string {
  const envWs = import.meta.env.VITE_WS_SPEECH_URL;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_WS_SPEECH_KEY);
    if (saved && saved.trim()) {
      if ((saved.includes('localhost') || saved.includes('ngrok')) && envWs && !envWs.includes('localhost') && !envWs.includes('ngrok')) {
        localStorage.removeItem(STORAGE_WS_SPEECH_KEY);
      } else if (!saved.includes('ngrok')) {
        return saved.trim();
      }
    }
  }
  if (envWs && envWs.trim() && !envWs.includes('ngrok')) {
    return envWs.trim();
  }
  const base = getApiBaseUrl();
  return `${base.replace(/^http/, 'ws')}/ws/speech`;
}

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// ── Continuous Teacher Speech WebSocket Stream ──────────────────────────────

export interface TeacherSpeechCallbacks {
  onTranscript?: (data: {
    segmentId: number;
    text: string;
    gloss_tokens?: string[];
    is_final?: boolean;
  }) => void;
  onInterim?: (text: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onError?: (err: Error) => void;
}

export interface TeacherSpeechStreamController {
  sendAudioChunk: (chunkBlob: Blob) => void;
  sendTextMessage: (text: string) => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

/**
 * Connect continuous live WebSocket stream to backend speech engine.
 * Audio chunks and live speech flow continuously over this socket.
 */
export function connectTeacherSpeechStream(
  sessionId: string,
  language: string,
  callbacks: TeacherSpeechCallbacks = {}
): TeacherSpeechStreamController {
  const wsUrl = getWsSpeechUrl();
  let ws: WebSocket | null = null;
  let isOpen = false;
  let closedExplicitly = false;
  let pendingQueue: (Blob | string)[] = [];

  function initSocket() {
    callbacks.onStatusChange?.('connecting');

    try {
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        isOpen = true;
        callbacks.onStatusChange?.('connected');

        // Send initial connection handshake
        const handshake = JSON.stringify({
          type: 'start',
          sessionId: sessionId || 'sarthi-live-session',
          language: language || 'en',
          mimeType: 'audio/webm',
          timestamp: new Date().toISOString(),
        });
        ws?.send(handshake);

        // Flush any queued audio chunks or messages
        while (pendingQueue.length > 0 && isOpen) {
          const item = pendingQueue.shift();
          if (item instanceof Blob) {
            item.arrayBuffer().then((buf) => {
              if (isOpen && ws) ws.send(buf);
            }).catch(() => {});
          } else if (typeof item === 'string') {
            ws?.send(item);
          }
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);

          if (data.type === 'interim') {
            callbacks.onInterim?.(data.text || '');
          } else if (data.type === 'transcript' || data.text) {
            callbacks.onTranscript?.({
              segmentId: data.segmentId || Date.now(),
              text: data.text || data.original_text || '',
              gloss_tokens: data.gloss_tokens || data.tokens || [],
              is_final: data.is_final ?? data.isFinal ?? true,
            });
          }
        } catch {
          if (typeof event.data === 'string' && event.data.trim()) {
            callbacks.onTranscript?.({
              segmentId: Date.now(),
              text: event.data.trim(),
              is_final: true,
            });
          }
        }
      };

      ws.onerror = (e) => {
        callbacks.onStatusChange?.('error');
        callbacks.onError?.(new Error(`WebSocket speech stream error: ${e}`));
      };

      ws.onclose = () => {
        isOpen = false;
        callbacks.onStatusChange?.('disconnected');
        if (!closedExplicitly) {
          setTimeout(() => {
            if (!closedExplicitly) initSocket();
          }, 2500);
        }
      };
    } catch (err) {
      callbacks.onStatusChange?.('error');
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  initSocket();

  return {
    isConnected: () => isOpen,
    sendAudioChunk: (chunkBlob: Blob) => {
      if (isOpen && ws && ws.readyState === WebSocket.OPEN) {
        chunkBlob.arrayBuffer().then((buf) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(buf);
          }
        }).catch(() => {});
      } else {
        if (pendingQueue.length < 20) {
          pendingQueue.push(chunkBlob);
        }
      }
    },
    sendTextMessage: (text: string) => {
      const msg = JSON.stringify({
        type: 'text',
        text: text.trim(),
        sessionId: sessionId || 'sarthi-live-session',
        timestamp: new Date().toISOString(),
      });

      if (isOpen && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      } else {
        pendingQueue.push(msg);
      }
    },
    disconnect: () => {
      closedExplicitly = true;
      isOpen = false;
      pendingQueue = [];
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop', timestamp: new Date().toISOString() }));
          }
          ws.close();
        } catch {}
      }
    },
  };
}

// ── Classroom Viewer Stream for Teacher UI Monitoring ───────────────────────

export interface StreamCallbacks {
  onTranscript: (seg: TranscriptSegment) => void;
  onISL: (seg: ISLSegment) => void;
  onStatus: (s: ConnectionStatus) => void;
  onSession: (s: SessionInfo) => void;
  onError: (err: Error) => void;
}

export interface StreamHandle {
  disconnect: () => void;
}

export function connectClassroomStream(
  sessionId: string,
  callbacks: StreamCallbacks,
): StreamHandle {
  if (DEMO_MODE) {
    callbacks.onStatus('demo');
    return { disconnect: () => {} };
  }

  const base = getApiBaseUrl();
  const wsBase = base.replace(/^http/, 'ws');
  const wsUrl = `${wsBase}/ws/classroom/${sessionId || 'default'}`;

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect() {
    callbacks.onStatus('connecting');
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        callbacks.onStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'transcript') {
            callbacks.onTranscript(msg.payload || msg);
          } else if (msg.type === 'isl') {
            callbacks.onISL(msg.payload || msg);
          } else if (msg.type === 'status') {
            callbacks.onStatus(msg.payload?.status || 'connected');
          } else if (msg.type === 'session') {
            callbacks.onSession(msg.payload || msg);
          }
        } catch {
          callbacks.onError(new Error('Failed to parse server message'));
        }
      };

      ws.onerror = () => {
        callbacks.onStatus('lost');
      };

      ws.onclose = () => {
        if (closed) return;
        callbacks.onStatus('reconnecting');
        reconnectTimer = setTimeout(connect, 3000);
      };
    } catch {
      callbacks.onStatus('reconnecting');
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  connect();

  return {
    disconnect: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    },
  };
}

export async function startTeacherSession(params?: {
  subject?: string;
  teacherName?: string;
}): Promise<TeacherSessionInfo> {
  const base = getApiBaseUrl();
  const defaultSubject = params?.subject || 'Real-time Classroom Lecture';
  const defaultTeacher = params?.teacherName || 'Instructor';

  let backendReachable = false;
  try {
    const health = await fetch(`${base}/health`, { method: 'GET', headers: { 'X-Pinggy-No-Screen': 'true' } });
    backendReachable = health.ok;
  } catch {
    backendReachable = false;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  const code = 'SARTHI-2026';

  return {
    sessionId: `session-${Date.now().toString(36)}`,
    classroomId: code,
    subject: defaultSubject,
    teacherName: defaultTeacher,
    startedAt: new Date().toISOString(),
    status: 'active',
    connectedStudentsCount: 0,
    joinUrl: `${origin.replace('5174', '5173')}/?classroomId=${code}`,
    isBackendConnected: backendReachable,
  };
}

export async function endTeacherSession(_sessionId: string): Promise<boolean> {
  return true;
}

export async function fetchClassroomStatus(
  _sessionId: string,
): Promise<{ status: string; connectedStudentsCount?: number; isBackendConnected: boolean }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/health`, { headers: { 'X-Pinggy-No-Screen': 'true' } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        status: 'active',
        connectedStudentsCount: data.connected_students ?? data.connectedStudentsCount ?? 0,
        isBackendConnected: true,
      };
    }
  } catch {}

  return {
    status: 'active',
    connectedStudentsCount: undefined,
    isBackendConnected: false,
  };
}

export async function fetchClassSummary(sessionId: string): Promise<ClassSummary> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/sessions/${sessionId}/summary`, { headers: { 'X-Pinggy-No-Screen': 'true' } });
    if (res.ok) {
      return (await res.json()) as ClassSummary;
    }
  } catch {}
  return { status: 'waiting' };
}
