import React from 'react';
import { LiveInsightsPanel } from './LiveInsightsPanel';
import { PitchAnalysisPanel } from './PitchAnalysisPanel';
import { mockPitchData } from '../data/mockPitch';

export function OverlayRoot() {
  const handleViewTranscript = () => {
    // Placeholder: open transcript view
  };

  const handleFollowUp = (id: string) => {
    // Placeholder: trigger follow-up
    console.log('Follow-up:', id);
  };

  return (
    <div
      className="pointer-events-none flex min-h-screen w-full items-start justify-center pt-6"
      style={{ background: 'transparent' }}
    >
      <div
        className="pointer-events-auto flex animate-fade-slide gap-3 rounded-2xl border-2 border-white p-1 opacity-0"
        style={{ animationFillMode: 'forwards' }}
      >
        <LiveInsightsPanel
          data={mockPitchData}
          onViewTranscript={handleViewTranscript}
          onFollowUp={handleFollowUp}
        />
        <PitchAnalysisPanel data={mockPitchData} />
      </div>
    </div>
  );
}
