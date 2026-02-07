import { app, BrowserWindow, screen, ipcMain, session } from 'electron';
import path from 'node:path';
// @ts-expect-error no type declarations for this module
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { DedalusService } from './services/dedalusService';
import { IPC_CHANNELS } from './types/pitch';
import type { AnalyzeAudioResponse } from './types/pitch';

dotenv.config();

if (started) {
  app.quit();
}

// Initialize Dedalus service
let dedalusService: DedalusService | null = null;
const apiKey = process.env.DEDALUS_API_KEY;
if (apiKey && apiKey !== 'your_dedalus_api_key_here') {
  dedalusService = new DedalusService(apiKey);
  console.log('Dedalus service initialized');
} else {
  console.warn(
    'DEDALUS_API_KEY not set — real-time analysis disabled, using mock data'
  );
}

// Single IPC handler: transcribe + analyze in one round-trip
let ipcCallCount = 0;
ipcMain.handle(
  IPC_CHANNELS.ANALYZE_AUDIO,
  async (
    _event,
    audioBase64: string,
    priorTranscript: string
  ): Promise<AnalyzeAudioResponse> => {
    const callId = ++ipcCallCount;
    const now = () => new Date().toISOString();
    console.log(`[${now()}] [IPC] analyze-audio #${callId} RECEIVED — base64=${audioBase64.length} chars (~${Math.round(audioBase64.length * 0.75)} bytes audio), priorTranscript=${priorTranscript.length} chars`);

    if (!dedalusService) {
      console.warn(`[${now()}] [IPC] analyze-audio #${callId} SKIPPED — no API key`);
      return { error: 'Dedalus service not initialized — API key missing' };
    }
    try {
      const start = performance.now();
      const buffer = Buffer.from(audioBase64, 'base64');
      const result = await dedalusService.analyzeAudio(buffer, priorTranscript);
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
