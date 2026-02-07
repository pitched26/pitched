import { FileText } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { SignalBadge } from './SignalBadge';
import type { PitchData } from '../data/mockPitch';

interface LiveInsightsPanelProps {
  data: PitchData;
  isAnalyzing?: boolean;
  cycleCount?: number;
  onViewTranscript?: () => void;
}

export function LiveInsightsPanel({
  data,
  isAnalyzing,
  cycleCount,
  onViewTranscript,
}: LiveInsightsPanelProps) {
  return (
    <GlassPanel className="flex w-full items-center gap-4 px-4 py-2.5">
      {/* Header / Status */}
      <div className="flex items-center gap-3 shrink-0">
        <h2 className="text-sm font-semibold text-overlay-text whitespace-nowrap">
          Live Insights
        </h2>
        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-xs text-overlay-accent whitespace-nowrap">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-overlay-accent" />
            {cycleCount && cycleCount > 0 ? 'Updating...' : 'Analyzing...'}
          </span>
        )}
        <div className="h-4 w-px bg-white/10 mx-1" />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 items-center gap-6 overflow-hidden min-w-0">
        {/* Signals - Compact Row */}
        {data.signals.length > 0 && (
          <div className="flex items-center gap-4 shrink-0">
            {data.signals.map((s) => (
              <div key={s.label} className="scale-90 origin-left">
                <SignalBadge label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        )}

        {/* Latest Tip */}
        <div className="flex flex-1 items-center gap-3 min-w-0 border-l border-white/10 pl-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-overlay-text-muted shrink-0">
            Latest
          </span>
          {data.tips.length > 0 ? (
            <p className="truncate text-sm text-overlay-text leading-snug">
              {data.tips[0].text}
            </p>
          ) : (
            <p className="text-sm text-overlay-text-muted italic">
              Listening for insights...
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0 pl-2 border-l border-white/10">
        <button
          type="button"
          onClick={onViewTranscript}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-overlay-text-muted transition hover:bg-white/5 hover:text-overlay-text"
        >
          <FileText className="h-3.5 w-3.5" />
          Transcript
        </button>
      </div>
    </GlassPanel>
  );
}
