import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, FileText } from 'lucide-react';
import { UnifiedTopBar } from './UnifiedTopBar';
import { SettingsPanel } from './SettingsPanel';
import { Teleprompter } from './Teleprompter';
import { RecordingControls } from './RecordingControls';
import { PostSessionSummary } from './PostSessionSummary';
import { mockPitchData } from '../data/mockPitch';
import { useRealtimeAnalysis } from '../hooks/useRealtimeAnalysis';

export function OverlayRoot() {
  const {
    pitchData,
    isAnalyzing,
    pace,
    transcript,
    startAnalysis,
    stopAnalysis,
  } = useRealtimeAnalysis();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [mode, setMode] = useState<'science' | 'tech' | 'business'>('tech');
  const [instructions, setInstructions] = useState('');

  // Post-Session State
  const [isPostSession, setIsPostSession] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const displayData = pitchData ?? mockPitchData;

  useEffect(() => {
    async function initCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(e => console.error("Play error:", e));
        }
      } catch (err) {
        console.error('Failed to initialize camera:', err);
      }
    }
    initCamera();
  }, []);

  const handleRecordingStart = useCallback(
    (s: MediaStream) => {
      setIsPostSession(false);
      startAnalysis(s);
    },
    [startAnalysis]
  );

  const handleRecordingStop = useCallback(() => {
    stopAnalysis();
    // We wait for onRecordingComplete to trigger the summary screen
  }, [stopAnalysis]);

  const handleRecordingComplete = useCallback((blob: Blob) => {
    setRecordedBlob(blob);
    setIsPostSession(true);
  }, []);

  const handleSaveRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pitch-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  const handleDiscardRecording = useCallback(() => {
    setRecordedBlob(null);
    setIsPostSession(false);
  }, []);

  const generateSessionSummary = useCallback(async () => {
    // Use collected data for summary via IPC (runs in main process)
    const currentTranscript = transcript || "";
    const tips = displayData.tips || [];
    const signals = displayData.signals || [];

    try {
      const response = await window.pitchly.generateSummary({
        transcript: currentTranscript,
        tips,
        signals,
        category: mode, // Pass the selected pitch category
      });

      if (response.error) {
        console.error('[OverlayRoot] Summary IPC error:', response.error);
        throw new Error(response.error);
      }

      return response.summary || "";
    } catch (err) {
      console.error('[OverlayRoot] Summary generation failed:', err);
      throw err; // PostSessionSummary will handle the fallback display
    }
  }, [displayData, transcript, mode]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-overlay-text font-sans">
      {/* Full-screen video background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => {
          videoRef.current?.play().catch(console.error);
        }}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none scale-x-[-1]"
      />

      {/* Main Content Area - Top Bar (Hidden in Post-Session) */}
      {!isPostSession && (
        <div className="absolute inset-x-0 top-0 pt-8 px-6 z-10 pointer-events-none flex justify-center animate-fade-slide">
          <UnifiedTopBar
            data={displayData}
            isAnalyzing={isAnalyzing}
            pace={pace}
          />
        </div>
      )}

      {/* Drag & Move Handle */}
      <div
        className="fixed top-0 left-0 right-0 h-24 z-50 hover:bg-white/5 transition-colors cursor-move flex justify-center pt-2 group"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
      </div>

      {/* Bottom Controls Area (Hidden in Post-Session) */}
      {!isPostSession && (
        <div className="fixed bottom-0 left-0 right-0 p-8 flex items-end justify-between z-20 pointer-events-none animate-fade-slide">

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="pointer-events-auto p-3 rounded-full bg-black/20 text-white/50 hover:text-white hover:bg-black/40 backdrop-blur-md border border-white/5 transition-all duration-300 group shadow-lg"
          >
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </button>

          {/* Recording Controls */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-8 pointer-events-auto">
            <RecordingControls
              stream={stream}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              onRecordingComplete={handleRecordingComplete}
            />
          </div>

          {/* Teleprompter Trigger */}
          <button
            onClick={() => setIsTeleprompterOpen(!isTeleprompterOpen)}
            className={`pointer-events-auto p-3 rounded-full backdrop-blur-md border border-white/5 transition-all duration-300 group shadow-lg ${isTeleprompterOpen ? 'bg-white/20 text-white' : 'bg-black/20 text-white/50 hover:text-white hover:bg-black/40'
              }`}
          >
            <FileText className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Slide-out Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={mode}
        setMode={setMode}
        instructions={instructions}
        setInstructions={setInstructions}
      />

      {/* Teleprompter Overlay */}
      <Teleprompter
        isOpen={isTeleprompterOpen && !isPostSession}
        onClose={() => setIsTeleprompterOpen(false)}
      />

      {/* Post-Session Summary Screen */}
      {isPostSession && (
        <PostSessionSummary
          onSave={handleSaveRecording}
          onDiscard={handleDiscardRecording}
          onClose={() => setIsPostSession(false)}
          transcript={transcript}
          feedbackItems={displayData.tips || []}
          signals={displayData.signals || []}
          generateSummary={generateSessionSummary}
        />
      )}
    </div>
  );
}
