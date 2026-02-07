import { useEffect, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// SystemToast: A polite, Apple-style toast notification system
// - Renders in top-right corner, independent of main UI
// - Auto-dismisses after configurable duration
// - Supports soft (info) and hard (error) severity levels
// - Never causes layout reflow of other UI elements
// ═══════════════════════════════════════════════════════════════════════════

export type ToastSeverity = 'soft' | 'hard';

export interface Toast {
    id: string;
    message: string;
    severity: ToastSeverity;
    duration?: number; // ms, default 3000 for soft, 5000 for hard
}

interface SystemToastProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

// Individual toast item with auto-dismiss
function ToastItem({
    toast,
    onDismiss
}: {
    toast: Toast;
    onDismiss: () => void;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const duration = toast.duration ?? (toast.severity === 'soft' ? 3000 : 5000);

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setIsVisible(true));

        // Auto-dismiss
        const dismissTimer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onDismiss, 300); // Wait for exit animation
        }, duration);

        return () => clearTimeout(dismissTimer);
    }, [duration, onDismiss]);

    // Severity-based styling
    const severityStyles = {
        soft: {
            bg: 'bg-white/10',
            border: 'border-white/10',
            text: 'text-white/70',
            icon: <Info className="w-3.5 h-3.5 text-white/50" />,
        },
        hard: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            text: 'text-amber-200/80',
            icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400/70" />,
        },
    };

    const style = severityStyles[toast.severity];

    return (
        <div
            className={`
        flex items-center gap-2 px-3 py-2 rounded-xl
        ${style.bg} ${style.border} border
        backdrop-blur-xl shadow-lg
        text-xs font-medium ${style.text}
        transition-all duration-300 ease-out
        ${isVisible && !isExiting
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-4'
                }
      `}
        >
            {style.icon}
            <span className="max-w-[200px] truncate">{toast.message}</span>
        </div>
    );
}

// Toast container - renders in top-right, independent layer
export function SystemToast({ toasts, onDismiss }: SystemToastProps) {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
            aria-label="System notifications"
        >
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => onDismiss(toast.id)}
                />
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast Hook: Simple state management for toasts
// Usage:
//   const { toasts, showToast, dismissToast } = useToasts();
//   showToast('Network retry...', 'soft');
//   showToast('Recording failed', 'hard');
// ═══════════════════════════════════════════════════════════════════════════

export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, severity: ToastSeverity = 'soft', duration?: number) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev, { id, message, severity, duration }]);
        return id;
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return { toasts, showToast, dismissToast };
}
