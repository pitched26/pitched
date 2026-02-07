import React from 'react';
import { Settings, X, ChevronRight } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'science' | 'tech' | 'business';
    setMode: (m: 'science' | 'tech' | 'business') => void;
    instructions: string;
    setInstructions: (s: string) => void;
}

export function SettingsPanel({
    isOpen,
    onClose,
    mode,
    setMode,
    instructions,
    setInstructions,
}: SettingsPanelProps) {
    return (
        <>
            {/* Overlay Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-40 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Slide-out Panel */}
            <div
                className={`fixed top-0 bottom-0 left-0 w-[320px] z-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <GlassPanel className="h-full w-full rounded-r-2xl rounded-l-none border-r border-white/10 flex flex-col pointer-events-auto bg-black/60 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/5">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Settings className="w-5 h-5 opacity-70" />
                            Co-Pilot Settings
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-white/70" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-8">

                        {/* Mode Selection */}
                        <section>
                            <h3 className="text-xs uppercase tracking-wider text-white/50 font-medium mb-3">
                                Persona Mode
                            </h3>
                            <div className="bg-white/5 p-1 rounded-lg flex gap-1">
                                {(['science', 'tech', 'business'] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setMode(m)}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === m
                                                ? 'bg-white/20 text-white shadow-sm'
                                                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                                            }`}
                                    >
                                        {m.charAt(0).toUpperCase() + m.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-white/40 leading-relaxed">
                                {mode === 'science' && "Focuses on data accuracy, methodology, and clarity."}
                                {mode === 'tech' && "Focuses on innovation, stack details, and scalability."}
                                {mode === 'business' && "Focuses on market fit, revenue models, and growth."}
                            </p>
                        </section>

                        {/* Custom Instructions */}
                        <section>
                            <h3 className="text-xs uppercase tracking-wider text-white/50 font-medium mb-3">
                                Custom Instructions
                            </h3>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="e.g. Tailor feedback for a Seed round pitch to YC partners..."
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none"
                            />
                        </section>
                    </div>
                </GlassPanel>
            </div>
        </>
    );
}
