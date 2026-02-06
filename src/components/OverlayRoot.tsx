import React from 'react';
import { LiveInsightsPanel } from './LiveInsightsPanel';
import { PitchAnalysisPanel } from './PitchAnalysisPanel';
import { RecordingControls } from './RecordingControls';
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
      className="pointer-events-none relative min-h-screen w-full"
      style={{ background: 'transparent' }}
    >
      <div className="flex w-full items-start justify-center pt-6">
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

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <RecordingControls />
      </div>
    </div>
  );
}
