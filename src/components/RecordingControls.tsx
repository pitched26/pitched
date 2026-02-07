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
      className="pointer-events-auto inline-flex items-center gap-3 rounded-panel border border-overlay-border bg-overlay-bg px-4 py-2.5 shadow-panel backdrop-blur-[20px]"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {status === 'idle' ? (
        <button
          onClick={startRecording}
          disabled={!stream}
          className="flex items-center gap-2 rounded-lg bg-red-500/80 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Circle className="h-3.5 w-3.5 fill-current" />
          Record
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-overlay-text">
            <span className="inline-block h-2.5 w-2.5 animate-pulse-dot rounded-full bg-red-500" />
            <span className="font-mono text-xs text-overlay-text-muted">
              {formatTime(elapsed)}
            </span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-lg bg-overlay-accent-soft px-3 py-1.5 text-sm font-medium text-overlay-text transition-colors hover:bg-overlay-accent/40"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </>
      )}
      <Video className="h-4 w-4 text-overlay-text-muted" />
    </div>
  );
}

