import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, X, Type, Clock } from 'lucide-react';
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
Connect with your audience.`;

export function Teleprompter({ isOpen, onClose }: TeleprompterProps) {
    const [text, setText] = useState(DEFAULT_SCRIPT);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1); // 1-5
    const scrollRef = useRef<HTMLTextAreaElement>(null);
    const animationFrameRef = useRef<number>();

    // Dimensions & Position State
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 400 });
    const [size, setSize] = useState({ w: 300, h: 320 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Drag/Resize Refs
    const dragStartRef = useRef({ x: 0, y: 0 });
    const initialPosRef = useRef({ x: 0, y: 0 });
    const initialSizeRef = useRef({ w: 0, h: 0 });

    // Calculate Estimated Duration (assuming ~140 WPM)
    const durationString = useMemo(() => {
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount === 0 || text.trim() === '') return "0s";

        const totalSeconds = Math.ceil((wordCount / 140) * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }, [text]);

    // Reset position/size on close
    useEffect(() => {
        if (!isOpen) {
            setPosition({ x: window.innerWidth - 340, y: window.innerHeight - 400 });
            setSize({ w: 300, h: 320 });
            setIsPlaying(false);
        }
    }, [isOpen]);

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

    // Global Mouse Handlers for Drag/Resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;
                setPosition({
                    x: initialPosRef.current.x + dx,
                    y: initialPosRef.current.y + dy
                });
            } else if (isResizing) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;
                setSize({
                    w: Math.max(250, initialSizeRef.current.w + dx),
                    h: Math.max(200, initialSizeRef.current.h + dy)
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing]);

    const handleDragStart = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { ...position };
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag
        setIsResizing(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialSizeRef.current = { ...size };
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-40 pointer-events-auto shadow-2xl rounded-2xl animate-fade-slide"
            style={{
                left: position.x,
                top: position.y,
                width: size.w,
                height: size.h
            }}
        >
            <GlassPanel className="flex flex-col h-full rounded-2xl bg-black/40 border-white/10 backdrop-blur-xl overflow-hidden relative group">
                {/* Header - Draggable Area */}
                <div
                    className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleDragStart}
                >
                    <div className="flex items-center gap-2 text-white/80 pointer-events-none">
                        <Type className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Teleprompter</span>
                    </div>

                    {/* Duration Estimate in Header */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                        <Clock className="w-3 h-3 text-white/50" />
                        <span className="text-[10px] font-medium text-white/60">
                            ~{durationString}
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="hover:text-white text-white/50 transition-colors pointer-events-auto ml-2"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Text Area */}
                <div className="relative flex-1 bg-black/20 min-h-0">
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
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/5 select-none text-white">
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

                {/* Resize Handle */}
                <div
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={handleResizeStart}
                >
                    <div className="w-2 h-2 bg-white/30 rounded-br-sm group-hover:bg-white/50" />
                </div>
            </GlassPanel>
        </div>
    );
}
