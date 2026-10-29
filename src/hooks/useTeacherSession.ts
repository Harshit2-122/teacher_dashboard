import { useCallback, useEffect, useState } from 'react';
import { startTeacherSession, endTeacherSession, fetchClassroomStatus } from '../services/api';
import type { TeacherSessionInfo } from '../types';

export function useTeacherSession() {
  const [session, setSession] = useState<TeacherSessionInfo>({
    sessionId: '',
    classroomId: 'SARTHI-2026',
    subject: 'Computer Science & AI — Real-time Lecture',
    teacherName: 'Prof. Sharma',
    status: 'idle',
    connectedStudentsCount: 0,
    isBackendConnected: false,
  });

  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Timer: calculate elapsed seconds when session is active
  useEffect(() => {
    if (session.status !== 'active' || !session.startedAt) {
      return;
    }

    const startTimestamp = new Date(session.startedAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTimestamp) / 1000));
      setDurationSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.status, session.startedAt]);

  // Periodic poll for connected students if backend is active
  useEffect(() => {
    if (session.status !== 'active' || !session.sessionId) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const status = await fetchClassroomStatus(session.sessionId);
        if (isMounted && status.connectedStudentsCount !== undefined) {
          setSession(prev => ({
            ...prev,
            connectedStudentsCount: status.connectedStudentsCount,
            isBackendConnected: status.isBackendConnected,
          }));
        }
      } catch {
        // Safe ignore
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session.status, session.sessionId]);

  const startClass = useCallback(async (customSubject?: string) => {
    setIsInitializing(true);
    try {
      const newSession = await startTeacherSession({
        subject: customSubject || session.subject,
        teacherName: session.teacherName,
      });
      setSession(newSession);
    } catch (err) {
      console.error('[useTeacherSession] Failed to start class:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [session.subject, session.teacherName]);

  const endClass = useCallback(async () => {
    if (!session.sessionId) return;
    try {
      await endTeacherSession(session.sessionId);
    } catch (err) {
      console.error('[useTeacherSession] Failed to end class:', err);
    } finally {
      setSession(prev => ({
        ...prev,
        status: 'ended',
      }));
    }
  }, [session.sessionId]);

  // Format duration into HH:MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  return {
    session,
    durationSeconds,
    formattedDuration: formatDuration(durationSeconds),
    isInitializing,
    startClass,
    endClass,
  };
}
