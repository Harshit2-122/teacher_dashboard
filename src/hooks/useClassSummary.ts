import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchClassSummary } from '../services/api';
import type { ClassSummary } from '../types';

const SESSION_ID = import.meta.env.VITE_SESSION_ID ?? 'demo-session-1';

export function useClassSummary(active: boolean) {
  const [summary, setSummary] = useState<ClassSummary>({ status: 'waiting' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setSummary({ status: 'processing' });
    try {
      const data = await fetchClassSummary(SESSION_ID);
      setSummary(data);
    } catch {
      setSummary({ status: 'failed', errorMessage: 'Could not reach the backend.' });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load();
    // Poll every 30 s while the Summary tab is open
    timerRef.current = setInterval(() => void load(), 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, load]);

  return { summary, refresh: load };
}
