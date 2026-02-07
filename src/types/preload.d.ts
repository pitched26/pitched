import type { AnalyzeAudioResponse } from './pitch';

export interface PitchlyAPI {
  analyzeAudio: (audioBase64: string, priorTranscript: string) => Promise<AnalyzeAudioResponse>;
}

declare global {
  interface Window {
    pitchly: PitchlyAPI;
  }
}
