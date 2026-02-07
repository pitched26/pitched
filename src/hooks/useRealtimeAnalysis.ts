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
  const activeRef = useRef(false);

  const runCycle = useCallback(async () => {
    if (!activeRef.current) return;

    const chunks = chunksRef.current.splice(0);
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });

    if (audioBlob.size < MIN_AUDIO_BYTES) return;

    setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      const transcribeResult = await window.pitchly.transcribeAudio(base64Audio);
      if (transcribeResult.error) {
        console.warn('Transcription error:', transcribeResult.error);
      } else if (transcribeResult.text) {
        transcriptRef.current += (transcriptRef.current ? ' ' : '') + transcribeResult.text;
      }

      if (transcriptRef.current.length < MIN_TRANSCRIPT_LENGTH) {
        setState((prev) => ({ ...prev, isAnalyzing: false }));
        return;
      }

      const analyzeResult = await window.pitchly.analyzePitch(transcriptRef.current);

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
  }, []);

  const startAnalysis = useCallback(
    (stream: MediaStream) => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }

      activeRef.current = true;
      chunksRef.current = [];
      transcriptRef.current = '';
      setState({
        pitchData: null,
        isAnalyzing: false,
        cycleCount: 0,
        error: null,
      });

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
      recorder.start(1000);

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
    chunksRef.current = [];
  }, []);

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
    };
  }, []);

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
  };
}
