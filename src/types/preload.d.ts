import type { AnalyzeAudioResponse, GenerateSummaryRequest, GenerateSummaryResponse } from './pitch';

export interface PitchlyAPI {
  analyzeAudio: (audioBase64: string) => Promise<AnalyzeAudioResponse>;
  disconnectRealtime: () => Promise<void>;
  updateSettings: (mode: string, customInstructions: string) => Promise<void>;
  generateSummary: (req: GenerateSummaryRequest) => Promise<GenerateSummaryResponse>;
}

declare global {
  interface Window {
    pitchly: PitchlyAPI;
  }
}
