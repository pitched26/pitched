import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Type } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface TeleprompterProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_SCRIPT = `Welcome to the future of pitching.
This is your teleprompter.
You can paste your script here.
Adjust the speed to match your pace.
Breathe.
Take your time.
Connect with your audience.
Focus on the problem you are solving.
Explain your solution clearly.
Show, don't just tell.
Highlight your traction.
Address the market opportunity.
Introduce your amazing team.
Ask for what you need.
Thank you for listening.`;

export function Teleprompter({ isOpen, onClose }: TeleprompterProps) {
    const [text, setText] = useState(DEFAULT_SCRIPT);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1); // 1-5
    const scrollRef = useRef<HTMLTextAreaElement>(null);
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const scroll = () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop += 0.5 * speed;
            }
            animationFrameRef.current = requestAnimationFrame(scroll);
        };

        animationFrameRef.current = requestAnimationFrame(scroll);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, speed]);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-8 z-40 w-[300px] pointer-events-auto animate-fade-slide">
            <GlassPanel className="flex flex-col rounded-2xl bg-black/40 border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-2 text-white/80">
                        <Type className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Teleprompter</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:text-white text-white/50 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Text Area */}
                <div className="relative h-[200px] bg-black/20">
                    <textarea
                        ref={scrollRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full h-full bg-transparent text-white/90 p-4 text-lg font-medium leading-relaxed resize-none focus:outline-none text-center"
                        placeholder="Paste script here..."
                    />
                    {/* Gradient Overlays for Fade Effect */}
                    <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/5">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isPlaying ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                        {isPlaying ? 'PAUSE' : 'SCROLL'}
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-medium tracking-wide">SPEED</span>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="0.5"
                            value={speed}
                            onChange={(e) => setSpeed(parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                        />
                    </div>
                </div>
            </GlassPanel>
        </div>
    );
}
