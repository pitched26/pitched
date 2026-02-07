export type {
  PitchSummaryItem,
  Signal,
  FollowUpPrompt,
  CompanyOverview,
  TractionMetrics,
  RiskFlag,
  PitchData,
} from '../types/pitch';

import type { PitchData } from '../types/pitch';

export const mockPitchData: PitchData = {
  summary: [], // Start empty so the default "Start pitching..." message shows
  signals: [
    { label: 'Market clarity', value: 'Medium' },
    { label: 'Technical depth', value: 'High' },
    { label: 'Differentiation', value: 'Unclear' },
  ],
  followUps: [
    { id: '1', label: 'Ask about customer acquisition strategy' },
    { id: '2', label: 'Clarify competitive differentiation' },
    { id: '3', label: 'Probe pricing and enterprise readiness' },
  ],
  company: {
    name: 'CodeForge',
    category: 'Developer tools / AI',
    valueProposition:
      'AI-native IDE that learns your codebase and automates repetitive dev workflows.',
  },
  traction: {
    arr: '$1.2M ARR (inferred)',
    customerCount: '~45 design partners',
    growthSignals: [
      'Pilot with 2 Fortune 500 eng teams',
      'Waitlist growing 15% WoW',
    ],
  },
  riskFlags: [
    { id: '1', text: 'No clear moat articulated' },
    { id: '2', text: 'Go-to-market strategy not specified' },
    { id: '3', text: 'Heavy reliance on future platform expansion' },
  ],
  analystNotes: `Strong technical narrative and credible founder. Product demo was crisp—live refactors and context-aware suggestions looked real. Missing: concrete GTM beyond "design partners" and clarity on why this wins vs. incumbents (GitHub Copilot, Cursor). Worth a follow-up on unit economics and sales motion.`,
};
