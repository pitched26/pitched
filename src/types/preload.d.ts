import type { AnalyzeAudioResponse } from './pitch';

export interface PitchlyAPI {
  analyzeAudio: (audioBase64: string) => Promise<AnalyzeAudioResponse>;
  disconnectRealtime: () => Promise<void>;
}

declare global {
  interface Window {
    pitchly: PitchlyAPI;
  }
}
