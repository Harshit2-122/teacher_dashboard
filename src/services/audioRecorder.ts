/**
 * audioRecorder.ts — High-Fidelity Audio Recorder for Teacher Microphone.
 * Records microphone audio and packages audio blobs to be transcribed
 * by backend OpenAI / Faster-Whisper models.
 */

export interface AudioChunk {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

export interface RecorderOptions {
  onAudioChunk?: (chunk: AudioChunk) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (err: Error) => void;
  sliceIntervalMs?: number; // Automatic chunking interval (e.g. 4000ms)
}

export interface AudioRecorderController {
  stop: () => Promise<AudioChunk | null>;
  isRecording: () => boolean;
  getStream: () => MediaStream | null;
}

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
    '',
  ];
  for (const mime of candidates) {
    if (!mime || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime))) {
      return mime;
    }
  }
  return '';
}

export async function startAudioRecording(
  options: RecorderOptions = {}
): Promise<AudioRecorderController> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('MICROPHONE_UNSUPPORTED: Browser does not support mediaDevices.getUserMedia');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    const domErr = err as DOMException;
    if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
      throw new Error('PERMISSION_DENIED: Microphone access denied by user');
    }
    throw new Error(`MIC_ERROR: ${domErr.message || String(err)}`);
  }

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  let recordedChunks: Blob[] = [];
  let isActivelyRecording = true;
  let startTime = Date.now();

  // Web Audio Context for volume metering
  let audioContext: AudioContext | null = null;
  let animFrameId: number | null = null;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const pollVolume = () => {
        if (!isActivelyRecording) return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        options.onVolumeChange?.(normalized);
        animFrameId = requestAnimationFrame(pollVolume);
      };
      animFrameId = requestAnimationFrame(pollVolume);
    }
  } catch {
    // Non-fatal if audio metering fails
  }

  // Periodic chunk slicer if requested
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  if (options.sliceIntervalMs && options.sliceIntervalMs > 0) {
    intervalTimer = setInterval(() => {
      if (recorder.state === 'recording') {
        recorder.requestData();
      }
    }, options.sliceIntervalMs);
  }

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);

      if (options.onAudioChunk) {
        const chunkBlob = new Blob([event.data], { type: recorder.mimeType || 'audio/webm' });
        options.onAudioChunk({
          blob: chunkBlob,
          durationMs: Date.now() - startTime,
          mimeType: recorder.mimeType || 'audio/webm',
        });
      }
    }
  };

  recorder.onerror = (e) => {
    options.onError?.(new Error(`MediaRecorder error: ${e}`));
  };

  recorder.start(1000); // 1-second timeslice for responsiveness

  return {
    isRecording: () => isActivelyRecording,
    getStream: () => stream,
    stop: async (): Promise<AudioChunk | null> => {
      if (!isActivelyRecording) return null;
      isActivelyRecording = false;

      if (intervalTimer) clearInterval(intervalTimer);
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioContext && audioContext.state !== 'closed') {
        try {
          await audioContext.close();
        } catch {}
      }

      return new Promise<AudioChunk | null>((resolve) => {
        recorder.onstop = () => {
          // Release mic hardware indicator
          stream.getTracks().forEach((track) => track.stop());

          if (recordedChunks.length === 0) {
            resolve(null);
            return;
          }

          const finalBlob = new Blob(recordedChunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          const totalDuration = Date.now() - startTime;

          resolve({
            blob: finalBlob,
            durationMs: totalDuration,
            mimeType: recorder.mimeType || 'audio/webm',
          });
        };

        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          resolve(null);
        }
      });
    },
  };
}
