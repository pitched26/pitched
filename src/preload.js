const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pitchly', {
  analyzeAudio: (audioBase64, priorTranscript) =>
    ipcRenderer.invoke('analyze-audio', audioBase64, priorTranscript),
});
