import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchData, CoachingTip } from '../types/pitch';

interface AnalysisState {
  pitchData: PitchData | null;
  isAnalyzing: boolean;
  cycleCount: number;
  error: string | null;
  tipHistory: CoachingTip[];
}

interface RealtimeAnalysisResult extends AnalysisState {
  startAnalysis: (stream: MediaStream) => void;
  stopAnalysis: () => void;
}

const CYCLE_MS = 2_000;
const MAX_INFLIGHT = 3;
const MIN_AUDIO_SAMPLES = 2400; // ~100ms at 24kHz

const TAG = '[Pipeline]';
function ts(): string {
  return new Date().toISOString();
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
  });

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
        console.log(`[${ts()}] ${TAG} seq=#${seq} base64 ready (${base64Audio.length} chars), sending IPC…`);
        return window.pitchly.analyzeAudio(base64Audio);
      })
      .then((result) => {
        inflightRef.current--;
        const roundtripMs = (performance.now() - fireTime).toFixed(0);

        if (!activeRef.current) {
          console.log(`[${ts()}] ${TAG} seq=#${seq} ARRIVED in ${roundtripMs}ms but session stopped — discarding`);
          return;
        }

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
        if (seq <= lastDisplayedSeqRef.current) {
          console.log(`[${ts()}] ${TAG} seq=#${seq} STALE in ${roundtripMs}ms — discarding`);
          return;
        }

        if (result.data) {
          lastDisplayedSeqRef.current = seq;
          const tips = result.data.tips;
          console.log(`[${ts()}] ${TAG} seq=#${seq} DISPLAY in ${roundtripMs}ms — tips=[${tips.map(t => `"${t.text}"`).join(', ')}]`);

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
      console.log(`[${ts()}] ${TAG} stream tracks: ${stream.getTracks().map(t => `${t.kind}:${t.label}`).join(', ')}`);

      activeRef.current = true;
      pcmChunksRef.current = [];
      seqRef.current = 0;
      lastDisplayedSeqRef.current = 0;
      inflightRef.current = 0;

      setState({
        pitchData: null,
        isAnalyzing: false,
        cycleCount: 0,
        error: null,
        tipHistory: [],
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error(`[${ts()}] ${TAG} No audio tracks — aborting`);
        setState((prev) => ({
          ...prev,
          error: 'No audio track available for analysis',
        }));
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
      // Connect through silent gain node so onaudioprocess fires without playback
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;

      console.log(`[${ts()}] ${TAG} PCM capture started at 24kHz, interval: ${CYCLE_MS}ms`);

      intervalRef.current = setInterval(() => {
        harvestAndFire();
      }, CYCLE_MS);
    },
    [harvestAndFire]
  );

  const stopAnalysis = useCallback(() => {
    console.log(`[${ts()}] ${TAG} ===== STOP ANALYSIS ===== seq=${seqRef.current} lastDisplayed=${lastDisplayedSeqRef.current} inflight=${inflightRef.current}`);
    activeRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Clean up audio nodes
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    pcmChunksRef.current = [];

    // Disconnect the Realtime API WebSocket
    window.pitchly.disconnectRealtime();
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
