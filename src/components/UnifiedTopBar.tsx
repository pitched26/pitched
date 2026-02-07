import React from 'react';
import { GlassPanel } from './GlassPanel';
import { SpeedIndicator } from './SpeedIndicator';
import { SignalBadge } from './SignalBadge';
import type { PitchData } from '../data/mockPitch';

interface UnifiedTopBarProps {
    data: PitchData;
    isAnalyzing: boolean;
    wpm?: number;
}

export function UnifiedTopBar({ data, isAnalyzing, wpm = 0 }: UnifiedTopBarProps) {
    // Extract latest summary or a prioritized feedback item
    const latestFeedback = data.summary.length > 0
        ? data.summary[0].text
        : isAnalyzing
            ? "Listening for your pitch..."
            : "Start pitching for real-time feedback...";

    return (
        <GlassPanel className="flex flex-col items-center w-full max-w-3xl px-8 py-5 mx-auto rounded-3xl pointer-events-auto backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl transition-all duration-300 gap-3">

            {/* TOP ROW: Speed Indicator */}
            <div className="flex justify-center w-full opacity-90 scale-90">
                <SpeedIndicator wpm={wpm} isSpeaking={isAnalyzing} />
            </div>

            {/* MIDDLE ROW: Primary Feedback (Dominant) */}
            <div className="flex-1 flex items-center justify-center w-full py-1">
                <div
                    className="text-xl md:text-2xl font-semibold text-white text-center leading-tight transition-opacity duration-300 drop-shadow-md text-balance"
                    style={{
                        opacity: isAnalyzing || latestFeedback !== "Start pitching for real-time feedback..." ? 1 : 0.6,
                        textShadow: '0 2px 12px rgba(0,0,0,0.3)'
                    }}
                >
                    {latestFeedback}
                </div>
            </div>

            {/* BOTTOM ROW: Signals */}
            <div className="flex items-center justify-center gap-2 w-full pt-1">
                {data.signals.length > 0 ? (
                    data.signals.slice(0, 3).map((s) => (
                        <div
                            key={s.label}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 transition-all hover:bg-white/10"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${s.value === 'High' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]' :
                                    s.value === 'Medium' ? 'bg-amber-400' :
                                        s.value === 'Low' ? 'bg-rose-400' : 'bg-white/20'
                                }`} />
                            <span className="text-[10px] uppercase font-medium text-white/70 tracking-wide">{s.label}</span>
                        </div>
                    ))
                ) : (
                    <span className="text-[10px] uppercase tracking-widest text-white/20 font-medium">No signals detected</span>
                )}
            </div>

        </GlassPanel>
    );
}
