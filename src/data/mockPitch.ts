export type {
  CoachingTip,
  Signal,
  PitchData,
} from '../types/pitch';

import type { PitchData } from '../types/pitch';
import { MODE_SIGNALS } from '../types/pitch';

export function getMockPitchData(mode: string): PitchData {
  const labels = MODE_SIGNALS[mode] || MODE_SIGNALS.tech;
  return {
    tips: [],
    signals: labels.map(label => ({ label, value: 'Unclear' as const })),
    coachNote: '',
  };
}
