const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pitchly', {
  transcribeAudio: (audioBase64) =>
    ipcRenderer.invoke('transcribe-audio', audioBase64),
  analyzePitch: (transcript, frameBase64) =>
    ipcRenderer.invoke('analyze-pitch', transcript, frameBase64),
});
