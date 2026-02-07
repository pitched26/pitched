import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, FileText } from 'lucide-react';
import { UnifiedTopBar } from './UnifiedTopBar';
import { SettingsPanel } from './SettingsPanel';
import { Teleprompter } from './Teleprompter';
import { RecordingControls } from './RecordingControls';
import { mockPitchData } from '../data/mockPitch';
import { useRealtimeAnalysis } from '../hooks/useRealtimeAnalysis';

export function OverlayRoot() {
  const {
    pitchData,
    isAnalyzing,
    error,
    pace,
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

  // Camera Error State
  const [cameraError, setCameraError] = useState<string | null>(null);
  const displayError = error || cameraError;

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
        setCameraError(err instanceof Error ? err.message : 'Camera failed to start');
      }
    }
    initCamera();
  }, []);

  const handleRecordingStart = useCallback(
    (s: MediaStream) => {
      startAnalysis(s);
    },
    [startAnalysis]
  );

  const handleRecordingStop = useCallback(() => {
    stopAnalysis();
  }, [stopAnalysis]);

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

      {/* Main Content Area - Top Bar */}
      <div className="absolute inset-x-0 top-0 pt-8 px-6 z-10 pointer-events-none flex justify-center">
        <UnifiedTopBar
          data={displayData}
          isAnalyzing={isAnalyzing}
          pace={pace}
        />
      </div>

      {/* Drag & Move Handle */}
      <div
        className="fixed top-0 left-0 right-0 h-24 z-50 hover:bg-white/5 transition-colors cursor-move flex justify-center pt-2 group"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
      </div>

      {/* Bottom Controls Area */}
      <div className="fixed bottom-0 left-0 right-0 p-8 flex items-end justify-between z-20 pointer-events-none">

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

      {/* Error Toast */}
      {displayError && (
        <div className="pointer-events-auto fixed top-32 left-1/2 -translate-x-1/2 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-sm text-rose-300 backdrop-blur-sm z-50 animate-fade-slide">
          {displayError}
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
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
      />
    </div>
  );
}
