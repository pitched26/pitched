const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pitchly', {
  analyzeAudio: (audioBase64) =>
    ipcRenderer.invoke('analyze-audio', audioBase64),
  disconnectRealtime: () =>
    ipcRenderer.invoke('realtime-disconnect'),
  updateSettings: (mode, customInstructions) =>
    ipcRenderer.invoke('realtime-update-settings', mode, customInstructions),
  generateSummary: (req) =>
    ipcRenderer.invoke('generate-summary', req),
});
