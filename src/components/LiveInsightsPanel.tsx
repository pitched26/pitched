import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { SignalBadge } from './SignalBadge';
import { InsightItem } from './InsightItem';
import type { PitchData } from '../data/mockPitch';

interface LiveInsightsPanelProps {
  data: PitchData;
  onViewTranscript?: () => void;
  onFollowUp?: (id: string) => void;
}

export function LiveInsightsPanel({
  data,
  onViewTranscript,
  onFollowUp,
}: LiveInsightsPanelProps) {
  return (
    <GlassPanel className="flex w-[380px] shrink-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-overlay-border px-4 py-3">
        <h2 className="text-sm font-semibold text-overlay-text">
          ✨ Live Insights
        </h2>
        <button
          type="button"
          onClick={onViewTranscript}
          className="flex items-center gap-1.5 text-xs text-overlay-text-muted transition hover:text-overlay-text"
        >
          <FileText className="h-3.5 w-3.5" />
          View transcript
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Pitch Summary
          </h3>
          <ul className="space-y-1.5">
            {data.summary.map((item) => (
              <InsightItem key={item.id}>{item.text}</InsightItem>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Signals
          </h3>
          <div className="space-y-0.5">
            {data.signals.map((s) => (
              <SignalBadge key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Suggested Follow-ups
          </h3>
          <ul className="space-y-1">
            {data.followUps.map((prompt) => (
              <li key={prompt.id}>
                <button
                  type="button"
                  onClick={() => onFollowUp?.(prompt.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-overlay-text transition hover:bg-white/10"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-overlay-text-muted" />
                  {prompt.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </GlassPanel>
  );
}
