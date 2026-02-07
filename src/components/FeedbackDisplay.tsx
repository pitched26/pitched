import React from 'react';
import { GlassPanel } from './GlassPanel';
import { SpeedIndicator } from './SpeedIndicator';
import { SignalBadge } from './SignalBadge';
import type { PitchData } from '../data/mockPitch';

interface FeedbackDisplayProps {
    data: PitchData;
    isAnalyzing: boolean;
    pace?: number;
}

export function FeedbackDisplay({ data, isAnalyzing, pace = 0 }: FeedbackDisplayProps) {
    const latestFeedback = data.tips.length > 0
        ? data.tips[0].text
        : isAnalyzing
            ? "Listening to your pitch..."
            : "Ready to start";

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto pointer-events-none">

            {/* Top Bar: Speed & Status */}
            <GlassPanel className="flex items-center justify-between px-5 py-2 rounded-full pointer-events-auto backdrop-blur-xl bg-white/5 border-white/10 shadow-lg w-full max-w-[280px]">
                {/* Play/Pause/Status Indicator */}
                <div className="flex items-center gap-2">
                    {isAnalyzing ? (
                        <div className="flex gap-0.5 items-end h-3">
                            <span className="w-0.5 h-2 bg-emerald-400 animate-[bounce_1s_infinite] rounded-full" />
                            <span className="w-0.5 h-3 bg-emerald-400 animate-[bounce_1.2s_infinite] rounded-full" />
                            <span className="w-0.5 h-1.5 bg-emerald-400 animate-[bounce_0.8s_infinite] rounded-full" />
                        </div>
                    ) : (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                    )}
                    <span className="text-xs font-medium text-overlay-text-muted">
                        {isAnalyzing ? 'LIVE' : 'IDLE'}
                    </span>
                </div>

                <div className="h-4 w-px bg-white/10" />

                <SpeedIndicator pace={pace} isSpeaking={isAnalyzing} />
            </GlassPanel>

            {/* Primary Feedback Line */}
            <div className="text-center transition-all duration-500 ease-out transform">
                <h1
                    className="text-3xl md:text-2xl font-semibold text-white tracking-tight leading-snug drop-shadow-md text-balance"
                    style={{
                        textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        opacity: isAnalyzing || latestFeedback !== "Ready to start" ? 1 : 0.6
                    }}
                >
                    {latestFeedback}
                </h1>
            </div>

            {/* Secondary Signals */}
            {data.signals.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 animate-fade-slide">
                    {data.signals.map((s) => (
                        <GlassPanel
                            key={s.label}
                            className="px-3 py-1.5 rounded-full bg-black/20 border-white/5 !backdrop-blur-md"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-white/70">{s.label}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${s.value === 'High' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' :
                                        s.value === 'Medium' ? 'bg-amber-400' :
                                            s.value === 'Low' ? 'bg-rose-400' : 'bg-white/20'
                                    }`} />
                            </div>
                        </GlassPanel>
                    ))}
                </div>
            )}
        </div>
    );
}
