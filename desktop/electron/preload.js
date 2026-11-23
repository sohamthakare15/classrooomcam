/**
 * Electron Preload Script.
 * Secure contextBridge exposing strictly necessary IPC channels to renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  showNotification: (title, body) => ipcRenderer.send('notify:show', { title, body })
});

