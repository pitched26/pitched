import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchData, CoachingTip } from '../types/pitch';
import { PaceTracker } from '../utils/paceTracker';

interface AnalysisState {
  pitchData: PitchData | null;
  isAnalyzing: boolean;
  cycleCount: number;
  error: string | null;
  tipHistory: CoachingTip[];
  pace: number; // -1 (slow) to 1 (fast), 0 = ideal
}

interface RealtimeAnalysisResult extends AnalysisState {
  startAnalysis: (stream: MediaStream) => void;
  stopAnalysis: () => void;
}

const CYCLE_MS = 2_000;
const PACE_UPDATE_MS = 100;
const MAX_INFLIGHT = 3;
const MIN_AUDIO_SAMPLES = 2400; // ~100ms at 24kHz

const TAG = '[Pipeline]';
function ts(): string {
  return new Date().toISOString();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Convert ArrayBuffer to base64 via FileReader (efficient, no stack limits) */
function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useRealtimeAnalysis(): RealtimeAnalysisResult {
  const [state, setState] = useState<AnalysisState>({
    pitchData: null,
    isAnalyzing: false,
    cycleCount: 0,
    error: null,
    tipHistory: [],
    pace: 0,
  });

  // Pace tracking (algorithmic, no LLM)
  const paceTrackerRef = useRef(new PaceTracker());
  const prevWordCountRef = useRef(0);
  const paceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio capture refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  // Pipelining refs
  const seqRef = useRef(0);
  const lastDisplayedSeqRef = useRef(0);
  const inflightRef = useRef(0);

  /** Collect PCM chunks, convert to Int16 base64, send to main process */
  const harvestAndFire = useCallback(async () => {
    if (!activeRef.current) return;

    // Grab accumulated PCM chunks
    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];

    const totalSamples = chunks.reduce((sum, c) => sum + c.length, 0);

    console.log(`[${ts()}] ${TAG} harvest — ${totalSamples} samples | inflight=${inflightRef.current}/${MAX_INFLIGHT}`);

    if (totalSamples < MIN_AUDIO_SAMPLES) {
      console.log(`[${ts()}] ${TAG} SKIP — audio too small (${totalSamples} < ${MIN_AUDIO_SAMPLES})`);
      return;
    }
    if (inflightRef.current >= MAX_INFLIGHT) {
      console.warn(`[${ts()}] ${TAG} SKIP — inflight cap reached`);
      return;
    }

    // Convert Float32 → Int16 PCM (what OpenAI Realtime API expects)
    const int16 = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }

    const seq = ++seqRef.current;
    inflightRef.current++;

    console.log(`[${ts()}] ${TAG} FIRE seq=#${seq} — ${totalSamples} samples (${int16.byteLength} bytes), inflight=${inflightRef.current}`);
    const fireTime = performance.now();

    setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

    // Fire-and-forget — don't block the interval
    arrayBufferToBase64(int16.buffer)
      .then((base64Audio) => {
        return window.pitchly.analyzeAudio(base64Audio);
      })
      .then((result) => {
        inflightRef.current--;
        const roundtripMs = (performance.now() - fireTime).toFixed(0);

        if (!activeRef.current) return;

        if (result.error) {
          console.error(`[${ts()}] ${TAG} seq=#${seq} ERROR in ${roundtripMs}ms — ${result.error}`);
          setState((prev) => ({
            ...prev,
            isAnalyzing: inflightRef.current > 0,
            error: result.error!,
          }));
          return;
        }

        // Only display if this is newer than the last displayed result
        if (seq <= lastDisplayedSeqRef.current) return;

        // Feed new words to PaceTracker
        if (result.transcript) {
          const totalWords = countWords(result.transcript);
          const newWords = totalWords - prevWordCountRef.current;
          if (newWords > 0) {
            paceTrackerRef.current.addWords(newWords, performance.now());
            prevWordCountRef.current = totalWords;
          }
        }

        if (result.data) {
          lastDisplayedSeqRef.current = seq;
          console.log(`[${ts()}] ${TAG} seq=#${seq} DISPLAY in ${roundtripMs}ms — tips=[${result.data.tips.map(t => `"${t.text}"`).join(', ')}]`);

          setState((prev) => ({
            ...prev,
            pitchData: result.data!,
            isAnalyzing: inflightRef.current > 0,
            cycleCount: prev.cycleCount + 1,
            error: null,
            tipHistory: [...prev.tipHistory, ...result.data!.tips],
          }));
        }
      })
      .catch((err) => {
        inflightRef.current--;
        if (!activeRef.current) return;
        const message = err instanceof Error ? err.message : 'Analysis cycle failed';
        console.error(`[${ts()}] ${TAG} seq=#${seq} EXCEPTION — ${message}`);
        setState((prev) => ({
          ...prev,
          isAnalyzing: inflightRef.current > 0,
          error: message,
        }));
      });
  }, []);

  const startAnalysis = useCallback(
    (stream: MediaStream) => {
      console.log(`[${ts()}] ${TAG} ===== START ANALYSIS =====`);

      activeRef.current = true;
      pcmChunksRef.current = [];
      seqRef.current = 0;
      lastDisplayedSeqRef.current = 0;
      inflightRef.current = 0;
      prevWordCountRef.current = 0;
      paceTrackerRef.current.reset();

      setState({
        pitchData: null,
        isAnalyzing: false,
        cycleCount: 0,
        error: null,
        tipHistory: [],
        pace: 0,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setState((prev) => ({ ...prev, error: 'No audio track available for analysis' }));
        return;
      }

      // Capture PCM at 24kHz (what OpenAI Realtime API expects)
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!activeRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;

      // Audio harvest cycle (2s)
      intervalRef.current = setInterval(() => {
        harvestAndFire();
      }, CYCLE_MS);

      // Pace update loop (200ms) — runs independently of LLM responses
      paceIntervalRef.current = setInterval(() => {
        if (!activeRef.current) return;
        const raw = paceTrackerRef.current.update(performance.now());
        const rounded = Math.round(raw * 100) / 100;
        setState((prev) => {
          if (prev.pace === rounded) return prev; // skip no-op render
          return { ...prev, pace: rounded };
        });
      }, PACE_UPDATE_MS);
    },
    [harvestAndFire]
  );

  const stopAnalysis = useCallback(() => {
    console.log(`[${ts()}] ${TAG} ===== STOP ANALYSIS =====`);
    activeRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (paceIntervalRef.current) {
      clearInterval(paceIntervalRef.current);
      paceIntervalRef.current = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    pcmChunksRef.current = [];

    window.pitchly.disconnectRealtime();
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (paceIntervalRef.current) clearInterval(paceIntervalRef.current);
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
  };
}
