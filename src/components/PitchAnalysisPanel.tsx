import React from 'react';
import { GlassPanel } from './GlassPanel';
import type { PitchData } from '../data/mockPitch';

interface PitchAnalysisPanelProps {
  data: PitchData;
  isAnalyzing?: boolean;
}

export function PitchAnalysisPanel({ data, isAnalyzing }: PitchAnalysisPanelProps) {
  const { company, traction, riskFlags, analystNotes } = data;

  return (
    <GlassPanel className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-overlay-border px-4 py-3">
        <h2 className="text-sm font-semibold text-overlay-text">
          Pitch Analysis
        </h2>
        {isAnalyzing && (
          <span className="flex items-center gap-1 text-xs text-overlay-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-overlay-accent" />
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Company Overview
          </h3>
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-overlay-text">{company.name}</p>
            <p className="text-overlay-text-muted">{company.category}</p>
            <p className="leading-snug text-overlay-text">
              {company.valueProposition}
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Traction & Metrics
          </h3>
          <div className="space-y-1.5 text-sm text-overlay-text">
            {traction.arr && <p>{traction.arr}</p>}
            {traction.customerCount && <p>{traction.customerCount}</p>}
            {traction.growthSignals.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-overlay-text-muted">
                {traction.growthSignals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Risk Flags
          </h3>
          <ul className="space-y-1 text-sm text-overlay-text">
            {riskFlags.map((flag) => (
              <li key={flag.id} className="flex gap-2">
                <span className="text-rose-400/90">•</span>
                {flag.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-overlay-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-overlay-text-muted">
            Analyst Notes
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-overlay-text">
            {analystNotes}
          </p>
        </section>
      </div>
    </GlassPanel>
  );
}
