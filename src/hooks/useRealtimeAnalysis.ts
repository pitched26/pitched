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
const MIN_AUDIO_BYTES = 512;
const MIN_TRANSCRIPT_LENGTH = 20;

const TAG = '[Pipeline]';
function ts(): string {
  return new Date().toISOString();
}

/** Native browser base64 encoding — delegates to C++ FileReader, avoids JS string churn */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
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

  // Double-buffer: two sets of chunks, alternating recorders
  const recorderARef = useRef<MediaRecorder | null>(null);
  const recorderBRef = useRef<MediaRecorder | null>(null);
  const chunksARef = useRef<Blob[]>([]);
  const chunksBRef = useRef<Blob[]>([]);
  const currentSlotRef = useRef<'A' | 'B'>('A');

  const transcriptRef = useRef('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);

  // Pipelining refs
  const seqRef = useRef(0);
  const lastDisplayedSeqRef = useRef(0);
  const inflightRef = useRef(0);

  /** Stop a specific recorder and resolve with a complete WebM blob */
  const stopAndCollect = useCallback((slot: 'A' | 'B'): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = slot === 'A' ? recorderARef.current : recorderBRef.current;
      const chunks = slot === 'A' ? chunksARef : chunksBRef;

      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        chunks.current = [];
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  /** Create and start a recorder in the given slot */
  const startRecorderInSlot = useCallback((slot: 'A' | 'B') => {
    const stream = streamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const chunks = slot === 'A' ? chunksARef : chunksBRef;
    chunks.current = [];

    const audioStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    if (slot === 'A') {
      recorderARef.current = recorder;
    } else {
      recorderBRef.current = recorder;
    }

    recorder.start();
    console.log(`[${ts()}] ${TAG} recorder started in slot ${slot}`);
  }, []);

  /** Harvest audio from current recorder and fire a detached API call */
  const harvestAndFire = useCallback(async () => {
    if (!activeRef.current) return;

    const harvestSlot = currentSlotRef.current;
    const nextSlot = harvestSlot === 'A' ? 'B' : 'A';

    // Start the OTHER recorder immediately, then stop current one
    startRecorderInSlot(nextSlot);
    currentSlotRef.current = nextSlot;

    const audioBlob = await stopAndCollect(harvestSlot);

    console.log(`[${ts()}] ${TAG} harvest slot=${harvestSlot} → ${audioBlob.size} bytes | inflight=${inflightRef.current}/${MAX_INFLIGHT} | seq=${seqRef.current} lastDisplayed=${lastDisplayedSeqRef.current}`);

    if (audioBlob.size < MIN_AUDIO_BYTES) {
      console.log(`[${ts()}] ${TAG} SKIP — audio too small (${audioBlob.size} < ${MIN_AUDIO_BYTES})`);
      return;
    }
    if (inflightRef.current >= MAX_INFLIGHT) {
      console.warn(`[${ts()}] ${TAG} SKIP — inflight cap reached (${inflightRef.current}/${MAX_INFLIGHT})`);
      return;
    }

    const seq = ++seqRef.current;
    inflightRef.current++;

    console.log(`[${ts()}] ${TAG} FIRE seq=#${seq} — blob=${audioBlob.size} bytes, transcript=${transcriptRef.current.length} chars, inflight=${inflightRef.current}`);
    const fireTime = performance.now();

    setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

    // Fire-and-forget — do NOT await in the interval callback
    blobToBase64(audioBlob)
      .then((base64Audio) => {
        console.log(`[${ts()}] ${TAG} seq=#${seq} base64 ready (${base64Audio.length} chars), sending IPC…`);
        return window.pitchly.analyzeAudio(base64Audio, transcriptRef.current);
      })
      .then((result) => {
        inflightRef.current--;
        const roundtripMs = (performance.now() - fireTime).toFixed(0);

        if (!activeRef.current) {
          console.log(`[${ts()}] ${TAG} seq=#${seq} ARRIVED in ${roundtripMs}ms but session stopped — discarding`);
          return;
        }

        if (result.error) {
          console.error(`[${ts()}] ${TAG} seq=#${seq} ERROR in ${roundtripMs}ms — ${result.error} | inflight=${inflightRef.current}`);
          setState((prev) => ({
            ...prev,
            isAnalyzing: inflightRef.current > 0,
            error: result.error!,
          }));
          return;
        }

        if (result.transcript) {
          transcriptRef.current = result.transcript;
        }

        // Only display if this is newer than the last displayed result
        if (seq <= lastDisplayedSeqRef.current) {
          console.log(`[${ts()}] ${TAG} seq=#${seq} STALE in ${roundtripMs}ms (lastDisplayed=#${lastDisplayedSeqRef.current}) — discarding`);
          return;
        }

        if (result.data) {
          lastDisplayedSeqRef.current = seq;
          const tips = result.data.tips;
          console.log(`[${ts()}] ${TAG} seq=#${seq} DISPLAY in ${roundtripMs}ms — tips=[${tips.map(t => `"${t.text}"`).join(', ')}] signals=[${result.data.signals.map(s => `${s.label}:${s.value}`).join(', ')}] coachNote="${result.data.coachNote}" | inflight=${inflightRef.current}`);

          setState((prev) => ({
            ...prev,
            pitchData: result.data!,
            isAnalyzing: inflightRef.current > 0,
            cycleCount: prev.cycleCount + 1,
            error: null,
            tipHistory: [...prev.tipHistory, ...result.data!.tips],
          }));
        } else if (transcriptRef.current.length < MIN_TRANSCRIPT_LENGTH) {
          console.log(`[${ts()}] ${TAG} seq=#${seq} NO DATA in ${roundtripMs}ms — transcript too short (${transcriptRef.current.length} chars)`);
          setState((prev) => ({
            ...prev,
            isAnalyzing: inflightRef.current > 0,
          }));
        }
      })
      .catch((err) => {
        inflightRef.current--;
        const roundtripMs = (performance.now() - fireTime).toFixed(0);
        if (!activeRef.current) return;
        const message = err instanceof Error ? err.message : 'Analysis cycle failed';
        console.error(`[${ts()}] ${TAG} seq=#${seq} EXCEPTION in ${roundtripMs}ms — ${message} | inflight=${inflightRef.current}`);
        setState((prev) => ({
          ...prev,
          isAnalyzing: inflightRef.current > 0,
          error: message,
        }));
      });
  }, [stopAndCollect, startRecorderInSlot]);

  const startAnalysis = useCallback(
    (stream: MediaStream) => {
      console.log(`[${ts()}] ${TAG} ===== START ANALYSIS =====`);
      console.log(`[${ts()}] ${TAG} stream tracks: ${stream.getTracks().map(t => `${t.kind}:${t.label}`).join(', ')}`);

      // Clean up any existing recorders
      for (const ref of [recorderARef, recorderBRef]) {
        if (ref.current && ref.current.state !== 'inactive') {
          ref.current.stop();
        }
      }

      activeRef.current = true;
      streamRef.current = stream;
      chunksARef.current = [];
      chunksBRef.current = [];
      currentSlotRef.current = 'A';
      transcriptRef.current = '';
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

      // Start first recorder in slot A
      startRecorderInSlot('A');

      console.log(`[${ts()}] ${TAG} interval set: ${CYCLE_MS}ms cycles, maxInflight=${MAX_INFLIGHT}`);
      // Uniform 2s interval — first cycle fires after 2s like all others
      intervalRef.current = setInterval(() => {
        harvestAndFire();
      }, CYCLE_MS);
    },
    [harvestAndFire, startRecorderInSlot]
  );

  const stopAnalysis = useCallback(() => {
    console.log(`[${ts()}] ${TAG} ===== STOP ANALYSIS ===== seq=${seqRef.current} lastDisplayed=${lastDisplayedSeqRef.current} inflight=${inflightRef.current}`);
    activeRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    for (const ref of [recorderARef, recorderBRef]) {
      if (ref.current && ref.current.state !== 'inactive') {
        ref.current.stop();
      }
      ref.current = null;
    }

    streamRef.current = null;
    chunksARef.current = [];
    chunksBRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      for (const ref of [recorderARef, recorderBRef]) {
        if (ref.current && ref.current.state !== 'inactive') {
          ref.current.stop();
        }
      }
    };
  }, []);

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
  };
}
