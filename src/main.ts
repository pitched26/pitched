import { app, BrowserWindow, screen, ipcMain, session } from 'electron';
import path from 'node:path';
// @ts-expect-error no type declarations for this module
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { RealtimeService } from './services/realtimeService';
import { DedalusService } from './services/dedalusService';
import { IPC_CHANNELS } from './types/pitch';
import type { AnalyzeAudioResponse, GenerateSummaryRequest, GenerateSummaryResponse } from './types/pitch';

dotenv.config();

if (started) {
  app.quit();
}

// Initialize Realtime service
let realtimeService: RealtimeService | null = null;
const apiKey = process.env.OPENAI_API_KEY;
if (apiKey) {
  realtimeService = new RealtimeService(apiKey);
  console.log('Realtime service initialized (WebSocket connects on first use)');
} else {
  console.warn(
    'OPENAI_API_KEY not set — real-time analysis disabled, using mock data'
  );
}

// Analyze audio: sends PCM16 to the Realtime API, gets coaching back
let ipcCallCount = 0;
ipcMain.handle(
  IPC_CHANNELS.ANALYZE_AUDIO,
  async (
    _event,
    audioBase64: string
  ): Promise<AnalyzeAudioResponse> => {
    const callId = ++ipcCallCount;
    const now = () => new Date().toISOString();
    console.log(`[${now()}] [IPC] analyze-audio #${callId} RECEIVED — base64=${audioBase64.length} chars`);

    if (!realtimeService) {
      console.warn(`[${now()}] [IPC] analyze-audio #${callId} SKIPPED — no API key`);
      return { error: 'Realtime service not initialized — OPENAI_API_KEY missing' };
    }
    try {
      const start = performance.now();
      const result = await realtimeService.analyzeAudio(audioBase64);
      const elapsed = (performance.now() - start).toFixed(0);
      console.log(`[${now()}] [IPC] analyze-audio #${callId} RESPONDED in ${elapsed}ms — transcript=${result.transcript.length} chars, tips=${result.data.tips.length}`);
      return { transcript: result.transcript, data: result.data };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Analysis failed';
      console.error(`[${now()}] [IPC] analyze-audio #${callId} ERROR — ${message}`);
      return { error: message };
    }
  }
);

// Disconnect the Realtime API WebSocket
ipcMain.handle(IPC_CHANNELS.REALTIME_DISCONNECT, () => {
  realtimeService?.disconnect();
});

// Generate Session Summary
let dedalusService: DedalusService | null = null;
const dedalusApiKey = process.env.DEDALUS_API_KEY || process.env.OPENAI_API_KEY; // Fallback
if (dedalusApiKey) {
  dedalusService = new DedalusService(dedalusApiKey);
} else {
  console.warn("DEDALUS_API_KEY not set - summary generation may fail");
}

ipcMain.handle(IPC_CHANNELS.GENERATE_SUMMARY, async (_event, req: GenerateSummaryRequest): Promise<GenerateSummaryResponse> => {
  if (!dedalusService) {
    return { error: "Service not configured" };
  }
  try {
    console.log(`[IPC] Generating summary for transcript length ${req.transcript.length}, category=${req.category}`);
    const summary = await dedalusService.generateSessionSummary(req.transcript, req.tips, req.signals, req.category);
    return { summary };
  } catch (error) {
    console.error("Summary generation failed:", error);
    return { error: error instanceof Error ? error.message : "Likely network or API error" };
  }
});

const createOverlayWindow = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const {
    width: screenWidth,
    height: screenHeight,
    x: screenX,
    y: screenY,
  } = primaryDisplay.workArea;

  const overlayWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: screenX,
    y: screenY,
    transparent: true,
    frame: false,
    alwaysOnTop: false, // Start as normal window, not always-on-top
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
    titleBarStyle: 'hidden',
  });

  overlayWindow.setBackgroundColor('#00000000');

  // ═══════════════════════════════════════════════════════════════════════
  // macOS-Native Focus Behavior
  // When focused: optionally float above other windows (user is active)
  // When blurred: yield to OS window manager (polite behavior)
  // ═══════════════════════════════════════════════════════════════════════

  overlayWindow.on('focus', () => {
    // When user clicks into our app, bring it to front naturally
    // We do NOT set alwaysOnTop here — let the OS manage z-order
    console.log('[Window] Focused');
  });

  overlayWindow.on('blur', () => {
    // When user clicks elsewhere, ensure we don't fight for focus
    // This is already the default behavior when alwaysOnTop is false
    console.log('[Window] Lost focus — yielding to OS');
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    overlayWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
      )
    );
  }
};

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(false);
  });

  createOverlayWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  realtimeService?.disconnect();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
