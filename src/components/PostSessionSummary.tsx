import { useState, useEffect } from 'react';
import { Download, Sparkles, ChevronRight, Check } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface FeedbackItem {
    id: string;
    text: string;
    category: string;
}

interface SignalItem {
    label: string;
    value: string;
}

interface PostSessionSummaryProps {
    onSave: () => void;
    onDiscard: () => void;
    onClose: () => void; // Called after save or close
    transcript: string;
    feedbackItems: FeedbackItem[];
    signals: SignalItem[];
    generateSummary: () => Promise<string>;
}

export function PostSessionSummary({
    onSave,
    onDiscard: _onDiscard, // Reserved for future use
    onClose,
    transcript,
    feedbackItems,
    signals: _signals, // Reserved for future use
    generateSummary
}: PostSessionSummaryProps) {
    const [summary, setSummary] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        // Auto-generate summary on mount
        let mounted = true;
        const gen = async () => {
            if (transcript.length < 10 && feedbackItems.length === 0) {
                setSummary("Not enough data to generate a summary. Keep pitching!");
                return;
            }

            setIsGenerating(true);
            try {
                const text = await generateSummary();
                if (mounted) setSummary(text);
            } catch (e) {
                console.error(e);
                if (mounted) setSummary("Could not generate summary at this time.");
            } finally {
                if (mounted) setIsGenerating(false);
            }
        };
        gen();
        return () => { mounted = false; };
    }, [transcript, feedbackItems.length, generateSummary]);

    const handleSave = () => {
        onSave();
        setIsSaved(true);
        // Don't close immediately, let them feel the success
        setTimeout(() => {
            // onClose(); // Optional: auto-close or let user close
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-slide">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-500" />

            <GlassPanel className="relative w-full max-w-2xl bg-black/40 border-white/10 backdrop-blur-3xl shadow-2xl rounded-[32px] overflow-hidden flex flex-col items-center p-8 md:p-12 gap-8 transform transition-all duration-500 scale-100">

                {/* Header Section */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
                        <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl font-semibold text-white tracking-tight">Session Complete</h2>
                </div>

                {/* Primary Action: SAVE */}
                {!isSaved ? (
                    <button
                        onClick={handleSave}
                        className="group relative w-full max-w-sm h-16 flex items-center justify-center gap-3 bg-white text-black rounded-full font-semibold text-lg hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
                    >
                        <Download className="w-5 h-5" />
                        <span>Save Recording</span>
                    </button>
                ) : (
                    <div className="w-full max-w-sm h-16 flex items-center justify-center gap-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-semibold text-lg">
                        <Check className="w-5 h-5" />
                        <span>Saved Successfully</span>
                    </div>
                )}

                {/* Secondary: Intelligence Summary */}
                <div className="w-full space-y-4">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Pitch Intelligence</h3>
                                <p className="text-white/40 text-sm">
                                    {isGenerating ? "Analyzing your performance..." : isExpanded ? "Hide summary" : "View AI summary"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-white/30 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {/* Expanded Content */}
                    <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-white/80 leading-relaxed text-base">
                            {isGenerating ? (
                                <div className="flex items-center gap-2 text-indigo-300 animate-pulse">
                                    <Sparkles className="w-4 h-4" />
                                    <span>Generating insights...</span>
                                </div>
                            ) : (
                                <p>{summary}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / Exit */}
                <button
                    onClick={onClose}
                    className="mt-4 text-white/30 hover:text-white transition-colors text-sm font-medium"
                >
                    Return to Practice
                </button>

            </GlassPanel>
        </div>
    );
}
