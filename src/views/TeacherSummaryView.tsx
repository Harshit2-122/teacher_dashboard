import { useState } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Lightbulb,
  Network,
  ClipboardList,
  Loader2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useClassSummary } from '../hooks/useClassSummary';
import type { TopicNote, VisualContent } from '../types';

interface TeacherSummaryViewProps {
  active: boolean;
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--card-glow)] overflow-hidden transition-colors">
      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-2)]/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500" aria-hidden>
            {icon}
          </span>
          <h2 className="text-[var(--text)] font-bold text-sm sm:text-base">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function TopicNode({ topic, depth = 0 }: { topic: TopicNote; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = topic.subtopics && topic.subtopics.length > 0;
  return (
    <div className={depth > 0 ? 'ml-4 border-l-2 border-[var(--border)] pl-4 mt-2' : 'mt-2'}>
      <button
        onClick={() => hasChildren && setOpen(o => !o)}
        className={`flex items-start gap-2 w-full text-left group p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors ${
          hasChildren ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={hasChildren ? open : undefined}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" aria-hidden />
          )
        ) : (
          <span className="w-4 flex-shrink-0 text-indigo-400">•</span>
        )}
        <span className="font-semibold text-xs sm:text-sm text-[var(--text)] group-hover:text-indigo-500 transition-colors">
          {topic.title}
        </span>
      </button>
      {open && (
        <>
          <p className="ml-6 mt-1 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">{topic.content}</p>
          {hasChildren && topic.subtopics!.map((sub, i) => <TopicNode key={i} topic={sub} depth={depth + 1} />)}
        </>
      )}
    </div>
  );
}

function VisualCard({ item }: { item: VisualContent }) {
  if (item.imageUrl) {
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-sm">
        <p className="px-3.5 py-2 text-xs font-semibold text-[var(--text)] border-b border-[var(--border)] bg-[var(--surface-2)]">
          {item.title}
        </p>
        <img src={item.imageUrl} alt={item.title} className="w-full object-contain max-h-80 bg-black/10" />
        {item.description && (
          <p className="p-3 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">{item.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--border-2)] bg-[var(--surface-2)]/40 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Network className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-bold text-[var(--text)]">{item.title}</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        {item.description ?? 'Concept flowchart will be rendered here when received from backend AI pipeline.'}
      </p>
    </div>
  );
}

export default function TeacherSummaryView({ active }: TeacherSummaryViewProps) {
  const { summary, refresh } = useClassSummary(active);

  const isWaiting = summary.status === 'waiting';
  const isProcessing = summary.status === 'processing';
  const isFailed = summary.status === 'failed';
  const isAvailable = summary.status === 'available';

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--card-glow)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[var(--text)] font-extrabold text-lg sm:text-xl">
              Lecture Intelligence &amp; Summary
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Sparkles className="w-3 h-3" />
              Teacher Review
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm mt-1">
            Automated key takeaways, revision concepts, and visual diagrams compiled from your lecture transcript by the backend AI pipeline.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={isProcessing}
          aria-label="Refresh summary"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)]
            text-xs font-semibold text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--surface-2)] disabled:opacity-50
            transition-colors shadow-sm self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isProcessing ? 'animate-spin' : ''}`} aria-hidden />
          <span>{isProcessing ? 'Updating…' : 'Sync Summary'}</span>
        </button>
      </div>

      {/* Waiting state */}
      {isWaiting && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center shadow-[var(--card-glow)] flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-[var(--text)] font-bold text-sm sm:text-base">
            Class Summary in Preparation
          </h3>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm max-w-md leading-relaxed">
            As you deliver the lecture and transcript segments are delivered to the backend, summary highlights, revision points, and visual diagrams will be generated here automatically.
          </p>
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center shadow-[var(--card-glow)] flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" aria-hidden />
          <h3 className="text-[var(--text)] font-bold text-sm">Synthesizing Lecture Summary…</h3>
          <p className="text-[var(--text-muted)] text-xs">Processing transcript through NLP extraction pipelines.</p>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-6 text-center">
          <p className="text-rose-600 dark:text-rose-400 text-sm font-semibold">Summary generation not available yet.</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            {summary.errorMessage ?? 'Please check your connection and retry.'}
          </p>
          <button
            onClick={refresh}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Content Section (when available from backend) */}
      {isAvailable && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Lecture Overview & Key Highlights */}
          <SectionCard title="Lecture Overview" icon={<BookOpen className="w-4 h-4" />}>
            {summary.overview ? (
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed">{summary.overview}</p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">Overview will appear here.</p>
            )}

            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Key Highlights</p>
                <ul className="space-y-2">
                  {summary.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text)]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          {/* Concepts & Definitions */}
          <SectionCard title="Concepts & Definitions" icon={<Lightbulb className="w-4 h-4" />}>
            {!summary.keyConcepts?.length && !summary.definitions?.length && (
              <p className="text-xs text-[var(--text-muted)] italic">Important terminology will be listed here.</p>
            )}
            {summary.keyConcepts?.map((c, i) => (
              <div key={i} className="mb-3.5 p-3 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)]">
                <p className="text-xs sm:text-sm font-bold text-[var(--text)]">{c.term}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{c.explanation}</p>
              </div>
            ))}
            {summary.definitions && summary.definitions.length > 0 && (
              <div className="mt-3 space-y-2">
                {summary.definitions.map((d, i) => (
                  <div key={i} className="p-3 rounded-xl border-l-4 border-l-indigo-500 bg-[var(--surface-2)]/50">
                    <span className="text-[11px] font-extrabold text-indigo-500 uppercase tracking-wider">
                      {d.term}
                    </span>
                    <p className="text-xs sm:text-sm text-[var(--text)] mt-1">{d.definition}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Topic-Wise Breakdown */}
          <SectionCard title="Topic-Wise Breakdown" icon={<ClipboardList className="w-4 h-4" />}>
            {summary.topics && summary.topics.length > 0 ? (
              summary.topics.map((topic, i) => <TopicNode key={i} topic={topic} />)
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">Modular topic breakdowns will be organized here.</p>
            )}
          </SectionCard>

          {/* Takeaways & Exam Revision */}
          <SectionCard title="Takeaways & Exam Revision" icon={<Sparkles className="w-4 h-4" />}>
            {summary.takeaways && summary.takeaways.length > 0 ? (
              <ul className="space-y-2.5">
                {summary.takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text)]">
                    <span className="text-indigo-500 font-black">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">
                Exam revision points will be generated at end of lecture.
              </p>
            )}
          </SectionCard>

          {/* Visual Learning & Flowcharts */}
          <div className="md:col-span-2">
            <SectionCard title="Visual Learning & Flowcharts" icon={<Network className="w-4 h-4" />}>
              {summary.visualContent && summary.visualContent.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {summary.visualContent.map((item, i) => (
                    <VisualCard key={i} item={item} />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-[var(--text-muted)]">
                    Flowcharts and concept maps will appear here when the backend visual pipeline finishes processing.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
