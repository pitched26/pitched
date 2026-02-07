import { app, BrowserWindow, screen, ipcMain, session } from 'electron';
import path from 'node:path';
// @ts-expect-error no type declarations for this module
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { RealtimeService } from './services/realtimeService';
import { IPC_CHANNELS } from './types/pitch';
import type { AnalyzeAudioResponse } from './types/pitch';

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
    alwaysOnTop: true,
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
