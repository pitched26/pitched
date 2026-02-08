import { useState, useRef, useCallback, useEffect } from 'react';
import { Circle, Square, Video } from 'lucide-react';

interface RecordingControlsProps {
  stream: MediaStream | null;
  onRecordingStart?: (stream: MediaStream) => void;
  onRecordingStop?: () => void; // Called immediately on stop button click
  onRecordingComplete?: (blob: Blob) => void; // Called when data is ready
}

export function RecordingControls({
  stream,
  onRecordingStart,
  onRecordingStop,
  onRecordingComplete,
}: RecordingControlsProps) {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = useCallback(async () => {
    if (!stream) {
      console.error('No stream available to record');
      return;
    }

    try {
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        } else {
          // Fallback if no handler: auto-download (legacy behavior)
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pitch-recording-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
      setElapsed(0);
      onRecordingStart?.(stream);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 500);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [stream, onRecordingStart]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus('idle');
    onRecordingStop?.();
  }, [onRecordingStop]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div
      className="pointer-events-auto inline-flex items-center gap-3 rounded-panel border border-white/[0.08] bg-white/[0.10] px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-[32px] glass-transition"
    >
      {status === 'idle' ? (
        <button
          onClick={startRecording}
          disabled={!stream}
          className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-sm font-medium text-white glass-transition-fast hover:bg-red-500/30 hover:scale-[1.02] active:scale-[0.98] active:bg-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Circle className="h-3.5 w-3.5 fill-current" />
          Record
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-white/90">
            <span className="inline-block h-2.5 w-2.5 animate-pulse-dot rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span className="font-mono text-xs text-white/60">
              {formatTime(elapsed)}
            </span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-lg bg-white/[0.12] border border-white/[0.15] px-3 py-1.5 text-sm font-medium text-white glass-transition-fast hover:bg-white/[0.18] hover:scale-[1.02] active:scale-[0.98] active:bg-white/[0.22]"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </>
      )}
      <Video className="h-4 w-4 text-white/40" />
    </div>
  );
}

