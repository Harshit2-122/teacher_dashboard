/**
 * types/index.ts — All shared TypeScript types for SARTHI student dashboard.
 *
 * These types define the data contract between the frontend UI and the
 * backend API. The backend developer should match these shapes exactly.
 *
 * ── INTEGRATION NOTES ─────────────────────────────────────────────────────
 * Every interface marked "BACKEND CONTRACT" must be implemented by the API.
 * Do not change field names without coordinating with the frontend team.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Role = 'student' | 'teacher';

// ── Connection / Session ──────────────────────────────────────────────────

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'receiving'
  | 'reconnecting'
  | 'lost'
  | 'waiting-for-teacher'
  | 'session-ended'
  | 'demo';           // frontend-only demo mode

export interface SessionInfo {
  sessionId: string;
  teacherName?: string;
  subject?: string;
  startedAt?: string;   // ISO 8601
}

// ── Teacher Dashboard Types ───────────────────────────────────────────────

export type SpeechRecognitionStatus =
  | 'ready'
  | 'permission-required'
  | 'listening'
  | 'speech-detected'
  | 'paused'
  | 'sending'
  | 'sent'
  | 'connection-lost'
  | 'unsupported';

export type DeliveryStatus = 'pending' | 'sending' | 'delivered' | 'failed';

export interface TeacherTranscriptSegment extends TranscriptSegment {
  deliveryStatus: DeliveryStatus;
  deliveryError?: string;
  retryCount?: number;
  gloss?: string;
}

export interface TeacherSessionInfo extends SessionInfo {
  classroomId: string;
  status: 'idle' | 'active' | 'ended';
  connectedStudentsCount?: number;
  joinUrl?: string;
  qrCodeUrl?: string;
  isBackendConnected?: boolean;
}

export interface TranscriptDeliveryStats {
  totalSegments: number;
  deliveredCount: number;
  pendingCount: number;
  failedCount: number;
}

// ── Live Transcript ───────────────────────────────────────────────────────

/**
 * BACKEND CONTRACT
 * A single segment of the teacher's speech, as processed by the backend STT.
 */
export interface TranscriptSegment {
  /** Unique, monotonically increasing segment identifier. */
  segmentId: number;
  text: string;
  /** ISO 8601 timestamp when the segment was produced. */
  timestamp: string;
  /** Whether this segment is still being refined (interim) or final. */
  isFinal: boolean;
}

// ── ISL Output ────────────────────────────────────────────────────────────

/**
 * BACKEND CONTRACT
 * The sign-language output corresponding to a transcript segment.
 * Exactly one of videoUrl / animationUrl / poseSequence should be set.
 */
export interface ISLSegment {
  /** Must match the TranscriptSegment.segmentId it was generated from. */
  segmentId: number;
  /** Direct URL to an MP4/WebM sign-language video. */
  videoUrl?: string;
  /** URL to a Lottie / GIF animation. */
  animationUrl?: string;
  /**
   * Structured pose keypoints — only render when format is confirmed.
   * Shape: array of frames, each frame = array of {x, y, z?, confidence?}
   */
  poseSequence?: PoseFrame[];
  /** ISL gloss tokens for display alongside the video. */
  gloss?: string[];
  /** Processing status from the backend. */
  status: 'processing' | 'available' | 'unavailable' | 'error';
  errorMessage?: string;
}

export interface PoseFrame {
  keypoints: Array<{ x: number; y: number; z?: number; confidence?: number }>;
}

// ── Summary ───────────────────────────────────────────────────────────────

export type SummaryStatus =
  | 'waiting'       // no transcript yet
  | 'processing'    // backend is generating
  | 'available'     // content ready
  | 'failed'        // generation failed
  | 'unavailable';  // feature not enabled

/**
 * BACKEND CONTRACT
 * Full class summary payload.
 */
export interface ClassSummary {
  status: SummaryStatus;
  overview?: string;
  keyPoints?: string[];
  keyConcepts?: KeyConcept[];
  definitions?: Definition[];
  takeaways?: string[];
  topics?: TopicNote[];
  visualContent?: VisualContent[];
  generatedAt?: string;   // ISO 8601
  errorMessage?: string;
}

export interface KeyConcept {
  term: string;
  explanation: string;
}

export interface Definition {
  term: string;
  definition: string;
}

export interface TopicNote {
  title: string;
  content: string;
  subtopics?: TopicNote[];
}

export type VisualContentType = 'flowchart' | 'concept-map' | 'step-process' | 'image';

export interface VisualContent {
  type: VisualContentType;
  title: string;
  /** URL to a rendered image/SVG of the diagram. */
  imageUrl?: string;
  /** Mermaid.js source string — render client-side if supported. */
  mermaidSource?: string;
  /** Plain description fallback when no visual can be rendered. */
  description?: string;
}
