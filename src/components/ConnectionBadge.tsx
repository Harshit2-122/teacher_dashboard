import type { ConnectionStatus } from '../types';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

const config: Record<ConnectionStatus, { label: string; dot: string; text: string; bg: string }> = {
  connecting: {
    label: 'Connecting…',
    dot: 'bg-amber-400 animate-ping',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  connected: {
    label: 'Classroom Connected',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  receiving: {
    label: 'Receiving Stream',
    dot: 'bg-indigo-500 animate-pulse',
    text: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
  },
  reconnecting: {
    label: 'Reconnecting…',
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  lost: {
    label: 'Connection Lost',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/30',
  },
  'waiting-for-teacher': {
    label: 'Waiting for Teacher',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/30',
  },
  'session-ended': {
    label: 'Session Concluded',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/30',
  },
  demo: {
    label: 'Live Stream Ready',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    text: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
};

export default function ConnectionBadge({ status, className = '' }: ConnectionBadgeProps) {
  const c = config[status] || config.demo;
  return (
    <span
      role="status"
      aria-label={`Connection status: ${c.label}`}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold backdrop-blur-sm transition-all duration-200 ${c.text} ${c.bg} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}
