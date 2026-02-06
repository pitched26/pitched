import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchData } from '../types/pitch';

interface AnalysisState {
  pitchData: PitchData | null;
  isAnalyzing: boolean;
  cycleCount: number;
  error: string | null;
}

interface RealtimeAnalysisResult extends AnalysisState {
  startAnalysis: (stream: MediaStream) => void;
  stopAnalysis: () => void;
}

const ANALYSIS_INTERVAL_MS = 10_000;
const FIRST_CYCLE_DELAY_MS = 5_000;
const MIN_AUDIO_BYTES = 1024;
const MIN_TRANSCRIPT_LENGTH = 20;
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;
const JPEG_QUALITY = 0.6;

export function useRealtimeAnalysis(): RealtimeAnalysisResult {
  const [state, setState] = useState<AnalysisState>({
    pitchData: null,
    isAnalyzing: false,
    cycleCount: 0,
    error: null,
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef('');
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;
    ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    // Strip "data:image/jpeg;base64," prefix
    return dataUrl.split(',')[1] || null;
  }, []);

  const runCycle = useCallback(async () => {
    if (!activeRef.current) return;

    // Gather accumulated audio chunks
    const chunks = chunksRef.current.splice(0);
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });

    // Skip if audio is too small
    if (audioBlob.size < MIN_AUDIO_BYTES) {
      return;
    }

    setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // Transcribe audio
      const transcribeResult = await window.pitchly.transcribeAudio(base64Audio);
      if (transcribeResult.error) {
        console.warn('Transcription error:', transcribeResult.error);
        // Continue — transcript may have a gap but we keep going
      } else if (transcribeResult.text) {
        transcriptRef.current += (transcriptRef.current ? ' ' : '') + transcribeResult.text;
      }

      // Skip analysis if transcript is too short
      if (transcriptRef.current.length < MIN_TRANSCRIPT_LENGTH) {
        setState((prev) => ({ ...prev, isAnalyzing: false }));
        return;
      }

      // Capture a video frame
      const frameBase64 = captureFrame() || '';

      // Analyze pitch
      const analyzeResult = await window.pitchly.analyzePitch(
        transcriptRef.current,
        frameBase64
      );

      if (!activeRef.current) return;

      if (analyzeResult.error) {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: analyzeResult.error!,
        }));
      } else if (analyzeResult.data) {
        setState((prev) => ({
          ...prev,
          pitchData: analyzeResult.data!,
          isAnalyzing: false,
          cycleCount: prev.cycleCount + 1,
          error: null,
        }));
      }
    } catch (err) {
      if (!activeRef.current) return;
      const message = err instanceof Error ? err.message : 'Analysis cycle failed';
      console.error('Analysis cycle error:', message);
      setState((prev) => ({ ...prev, isAnalyzing: false, error: message }));
    }
  }, [captureFrame]);

  const startAnalysis = useCallback(
    (stream: MediaStream) => {
      // Clean up any previous session
      if (recorderRef.current) {
        recorderRef.current.stop();
      }

      activeRef.current = true;
      streamRef.current = stream;
      chunksRef.current = [];
      transcriptRef.current = '';
      setState({
        pitchData: null,
        isAnalyzing: false,
        cycleCount: 0,
        error: null,
      });

      // Set up hidden video element for frame capture
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
      }
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      // Create audio-only MediaRecorder from the same stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'No audio track available for analysis',
        }));
        return;
      }

      const audioStream = new MediaStream(audioTracks);
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorderRef.current = recorder;
      recorder.start(1000); // 1s timeslice for frequent data

      // First cycle fires after 5s, then every 10s
      const firstTimeout = setTimeout(() => {
        if (!activeRef.current) return;
        runCycle();
        intervalRef.current = setInterval(() => {
          runCycle();
        }, ANALYSIS_INTERVAL_MS) as unknown as ReturnType<typeof setTimeout>;
      }, FIRST_CYCLE_DELAY_MS);

      intervalRef.current = firstTimeout;
    },
    [runCycle]
  );

  const stopAnalysis = useCallback(() => {
    activeRef.current = false;

    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      clearInterval(intervalRef.current as unknown as ReturnType<typeof setInterval>);
      intervalRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        clearInterval(intervalRef.current as unknown as ReturnType<typeof setInterval>);
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
  };
}
