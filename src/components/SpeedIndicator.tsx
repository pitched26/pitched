interface SpeedIndicatorProps {
    pace: number;       // -1 (slow) to 1 (fast), 0 = ideal
    isSpeaking: boolean;
}

export function SpeedIndicator({ pace, isSpeaking }: SpeedIndicatorProps) {
    const pct = (pace + 1) / 2 * 100;

    return (
        <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-overlay-text-muted font-medium opacity-80">
                Pace
            </span>

            <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden shadow-inner backdrop-blur-sm">
                <div
                    className="absolute inset-0 opacity-80"
                    style={{
                        background: 'linear-gradient(90deg, #fb7185 0%, #fbbf24 30%, #34d399 50%, #fbbf24 70%, #fb7185 100%)'
                    }}
                />

                {/*
                  Marker sits at left:0 inside a full-width sled that
                  translates via GPU-composited transform.
                  350ms > 100ms update interval = transitions always overlap,
                  producing continuous liquid motion.
                */}
                <div
                    className="absolute inset-0 will-change-transform"
                    style={{
                        transform: `translateX(${pct}%)`,
                        transition: 'transform 350ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                >
                    <div
                        className="absolute top-0 bottom-0 w-1 -left-0.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                        style={{
                            transition: 'opacity 400ms ease',
                            opacity: isSpeaking ? 1 : 0.3,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
