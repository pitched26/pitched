import React from 'react';

type Level = 'High' | 'Medium' | 'Low' | 'Unclear';

const levelStyles: Record<Level, string> = {
  High: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  Medium: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Low: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  Unclear: 'text-overlay-text-muted border-white/10 bg-white/5',
};

interface SignalBadgeProps {
  label: string;
  value: Level;
}

export function SignalBadge({ label, value }: SignalBadgeProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-overlay-text font-normal">{label}</span>
      <span
        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${levelStyles[value]}`}
      >
        {value}
      </span>
    </div>
  );
}
