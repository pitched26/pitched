import React, { useCallback } from 'react';
import { LiveInsightsPanel } from './LiveInsightsPanel';
import { PitchAnalysisPanel } from './PitchAnalysisPanel';
import { RecordingControls } from './RecordingControls';
import { mockPitchData } from '../data/mockPitch';
import { useRealtimeAnalysis } from '../hooks/useRealtimeAnalysis';

export function OverlayRoot() {
  const {
    pitchData,
    isAnalyzing,
    cycleCount,
    error,
    startAnalysis,
    stopAnalysis,
  } = useRealtimeAnalysis();

  const displayData = pitchData ?? mockPitchData;

  const handleViewTranscript = () => {
    // Placeholder: open transcript view
  };

  const handleFollowUp = (id: string) => {
    // Placeholder: trigger follow-up
    console.log('Follow-up:', id);
  };

  const handleRecordingStart = useCallback(
    (stream: MediaStream) => {
      startAnalysis(stream);
    },
    [startAnalysis]
  );

  const handleRecordingStop = useCallback(() => {
    stopAnalysis();
  }, [stopAnalysis]);

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
            data={displayData}
            isAnalyzing={isAnalyzing}
            cycleCount={cycleCount}
            onViewTranscript={handleViewTranscript}
            onFollowUp={handleFollowUp}
          />
          <PitchAnalysisPanel data={displayData} isAnalyzing={isAnalyzing} />
        </div>
      </div>

      {error && (
        <div className="pointer-events-auto fixed bottom-20 left-1/2 -translate-x-1/2 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-sm text-rose-300 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <RecordingControls
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
        />
      </div>
    </div>
  );
}
