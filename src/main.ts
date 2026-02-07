import { app, BrowserWindow, screen, ipcMain, session } from 'electron';
import path from 'node:path';
// @ts-expect-error no type declarations for this module
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { DedalusService } from './services/dedalusService';
import { IPC_CHANNELS } from './types/pitch';
import type { TranscribeResponse, AnalyzeResponse } from './types/pitch';

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

// IPC Handlers
ipcMain.handle(
  IPC_CHANNELS.TRANSCRIBE_AUDIO,
  async (_event, audioBase64: string): Promise<TranscribeResponse> => {
    if (!dedalusService) {
      return { error: 'Dedalus service not initialized — API key missing' };
    }
    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      const text = await dedalusService.transcribeAudio(buffer);
      return { text };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Transcription failed';
      console.warn('Transcription error:', message);
      return { error: message };
    }
  }
);

ipcMain.handle(
  IPC_CHANNELS.ANALYZE_PITCH,
  async (
    _event,
    transcript: string,
    frameBase64: string
  ): Promise<AnalyzeResponse> => {
    if (!dedalusService) {
      return { error: 'Dedalus service not initialized — API key missing' };
    }
    try {
      const data = await dedalusService.analyzePitch(transcript, frameBase64);
      return { data };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Analysis failed';
      console.warn('Analysis error:', message);
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
    fullscreenable: false, // Set to true if you want actual OS fullscreen, but false usually better for overlays
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
    titleBarStyle: 'hidden',
  });

  // Force fully transparent window (no vibrancy tint on macOS)
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
  // Allow camera/microphone access
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
