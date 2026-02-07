export interface CoachingTip {
  id: string;
  text: string;
  category: 'delivery' | 'content' | 'structure' | 'engagement';
  priority: 'high' | 'medium' | 'low';
}

export interface Signal {
  label: string;
  value: 'High' | 'Medium' | 'Low' | 'Unclear';
}

export interface PitchData {
  tips: CoachingTip[];
  signals: Signal[];
  coachNote: string;
}

// IPC channel constants
export const IPC_CHANNELS = {
  ANALYZE_AUDIO: 'analyze-audio',
  REALTIME_DISCONNECT: 'realtime-disconnect',
  REALTIME_UPDATE_SETTINGS: 'realtime-update-settings',
  GENERATE_SUMMARY: 'generate-summary',
} as const;

// Single IPC response: transcription + analysis in one shot
export interface AnalyzeAudioResponse {
  transcript?: string;
  data?: PitchData;
  error?: string;
}

export interface GenerateSummaryRequest {
  transcript: string;
  tips: { text: string; category: string }[];
  signals: Signal[];
  category: 'science' | 'tech' | 'business';
}

export interface GenerateSummaryResponse {
  summary?: string;
  error?: string;
}
