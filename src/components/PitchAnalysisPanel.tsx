import React from 'react';
import { GlassPanel } from './GlassPanel';
import type { PitchData, CoachingTip } from '../data/mockPitch';

const CATEGORY_COLORS: Record<CoachingTip['category'], string> = {
  delivery: 'bg-violet-400/20 text-violet-300',
  content: 'bg-sky-400/20 text-sky-300',
  structure: 'bg-amber-400/20 text-amber-300',
  engagement: 'bg-emerald-400/20 text-emerald-300',
};

const PRIORITY_BORDER: Record<CoachingTip['priority'], string> = {
  high: 'border-l-rose-400',
  medium: 'border-l-amber-400',
  low: 'border-l-white/20',
};

interface PitchAnalysisPanelProps {
  data: PitchData;
  tipHistory: CoachingTip[];
  isAnalyzing?: boolean;
}

export function PitchAnalysisPanel({ data, tipHistory, isAnalyzing }: PitchAnalysisPanelProps) {
  return (
    <GlassPanel className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-overlay-border px-4 py-3">
        <h2 className="text-sm font-semibold text-overlay-text">
          Coach Notes
        </h2>
        {isAnalyzing && (
          <span className="flex items-center gap-1 text-xs text-overlay-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-overlay-accent" />
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {/* Coach Note — one-liner impression */}
        {data.coachNote && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
              Overall Impression
            </h3>
            <p className="text-sm leading-relaxed text-overlay-text">
              {data.coachNote}
            </p>
          </section>
        )}

        {/* Tip History */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Coaching Tips
          </h3>
          {tipHistory.length > 0 ? (
            <ul className="space-y-2">
              {tipHistory.map((tip, i) => (
                <li
                  key={`${tip.id}-${i}`}
                  className={`flex items-start gap-2 border-l-2 pl-3 py-1 ${PRIORITY_BORDER[tip.priority]}`}
                >
                  <span className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_COLORS[tip.category]}`}>
                    {tip.category}
                  </span>
                  <span className="text-sm text-overlay-text">{tip.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-overlay-text-muted italic">
              Tips will appear here as you speak...
            </p>
          )}
        </section>
      </div>
    </GlassPanel>
  );
}
