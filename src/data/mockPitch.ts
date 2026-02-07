export type {
  CoachingTip,
  Signal,
  PitchData,
} from '../types/pitch';

import type { PitchData } from '../types/pitch';

export const mockPitchData: PitchData = {
  tips: [],
  signals: [
    { label: 'Clarity', value: 'Unclear' },
    { label: 'Energy', value: 'Unclear' },
    { label: 'Pace', value: 'Unclear' },
  ],
  coachNote: '',
};
