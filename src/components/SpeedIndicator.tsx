import React, { useEffect, useState } from 'react';

interface SpeedIndicatorProps {
    wpm: number; // Words per minute, 0-200+
    isSpeaking: boolean;
}

export function SpeedIndicator({ wpm, isSpeaking }: SpeedIndicatorProps) {
    // Normalize WPM for display (0-1 range)
    // Target: 130-150 WPM is ideal (center)
    // < 100 is slow (left)
    // > 180 is fast (right)
    const [position, setPosition] = useState(0.5);

    useEffect(() => {
        // Simple smoothing
        const target = Math.min(Math.max((wpm - 80) / 120, 0), 1);
        setPosition(prev => prev + (target - prev) * 0.1);
    }, [wpm]);

    return (
        <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-overlay-text-muted font-medium opacity-80">
                Pace
            </span>

            {/* Bar Container */}
            <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden shadow-inner backdrop-blur-sm">
                {/* Gradient Background: Slow (Red/Yellow) -> Ideal (Green) -> Fast (Red/Yellow) */}
                <div
                    className="absolute inset-0 opacity-80"
                    style={{
                        background: 'linear-gradient(90deg, #fb7185 0%, #fbbf24 30%, #34d399 50%, #fbbf24 70%, #fb7185 100%)'
                    }}
                />

                {/* Current Position Marker */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 ease-out"
                    style={{
                        left: `${position * 100}%`,
                        opacity: isSpeaking ? 1 : 0.3
                    }}
                />
            </div>
        </div>
    );
}
