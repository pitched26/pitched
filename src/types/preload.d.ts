import type { TranscribeResponse, AnalyzeResponse } from './pitch';

export interface PitchlyAPI {
  transcribeAudio: (audioBase64: string) => Promise<TranscribeResponse>;
  analyzePitch: (transcript: string, frameBase64: string) => Promise<AnalyzeResponse>;
}

declare global {
  interface Window {
    pitchly: PitchlyAPI;
  }
}
