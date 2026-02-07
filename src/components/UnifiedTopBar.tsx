import React from 'react';
import { GlassPanel } from './GlassPanel';
import { SpeedIndicator } from './SpeedIndicator';
import { SignalBadge } from './SignalBadge';
import type { PitchData } from '../data/mockPitch';
import type { CoachingTip } from '../types/pitch';

const MAX_VISIBLE_TIPS = 3;

interface UnifiedTopBarProps {
    data: PitchData;
    isAnalyzing: boolean;
    pace?: number;
    tipHistory?: CoachingTip[];
}

export function UnifiedTopBar({ data, isAnalyzing, pace = 0, tipHistory = [] }: UnifiedTopBarProps) {
    const visibleTips = tipHistory.slice(-MAX_VISIBLE_TIPS);

    const placeholder = isAnalyzing
        ? "Listening for your pitch..."
        : "Start pitching for real-time feedback...";

    return (
        <GlassPanel className="flex flex-col items-center w-full max-w-3xl px-10 py-6 mx-auto rounded-3xl pointer-events-auto backdrop-blur-3xl bg-black/40 border border-white/15 shadow-2xl transition-all duration-300 gap-3">

            {/* TOP ROW: Speed Indicator */}
            <div className="flex justify-center w-full opacity-90 scale-90">
                <SpeedIndicator pace={pace} isSpeaking={isAnalyzing} />
            </div>

            {/* MIDDLE ROW: Rolling Feedback List */}
            <div className="flex flex-col items-center gap-2 w-full py-2 min-h-[2.5rem]">
                {visibleTips.length > 0 ? (
                    visibleTips.map((tip, i) => {
                        const isNewest = i === visibleTips.length - 1;
                        return (
                            <div
                                key={`${tip.id}-${i}`}
                                className="transition-all duration-300"
                                style={{ opacity: isNewest ? 1 : 0.5 + (i / visibleTips.length) * 0.4 }}
                            >
                                <span
                                    className={`text-white leading-snug text-center transition-all duration-300 ${isNewest ? 'text-2xl md:text-3xl font-bold' : 'text-lg md:text-xl font-medium'}`}
                                    style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.3)' }}
                                >
                                    {tip.text}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div
                        className="text-2xl md:text-3xl font-bold text-white text-center leading-tight drop-shadow-lg"
                        style={{ opacity: isAnalyzing ? 1 : 0.6, textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.3)' }}
                    >
                        {placeholder}
                    </div>
                )}
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
