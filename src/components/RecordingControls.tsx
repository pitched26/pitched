import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Circle, Square, Video } from 'lucide-react';

export function RecordingControls() {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pitch-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
          className="flex items-center gap-2 rounded-lg bg-red-500/80 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
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
