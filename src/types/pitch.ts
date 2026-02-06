export interface PitchSummaryItem {
  id: string;
  text: string;
}

export interface Signal {
  label: string;
  value: 'High' | 'Medium' | 'Low' | 'Unclear';
}

export interface FollowUpPrompt {
  id: string;
  label: string;
}

export interface CompanyOverview {
  name: string;
  category: string;
  valueProposition: string;
}

export interface TractionMetrics {
  arr?: string;
  customerCount?: string;
  growthSignals: string[];
}

export interface RiskFlag {
  id: string;
  text: string;
}

export interface PitchData {
  summary: PitchSummaryItem[];
  signals: Signal[];
  followUps: FollowUpPrompt[];
  company: CompanyOverview;
  traction: TractionMetrics;
  riskFlags: RiskFlag[];
  analystNotes: string;
}

// IPC channel constants
export const IPC_CHANNELS = {
  TRANSCRIBE_AUDIO: 'transcribe-audio',
  ANALYZE_PITCH: 'analyze-pitch',
} as const;

// IPC response shapes
export interface TranscribeResponse {
  text?: string;
  error?: string;
}

export interface AnalyzeResponse {
  data?: PitchData;
  error?: string;
}
