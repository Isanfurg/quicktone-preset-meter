const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('presetDesktop', {
  savePatch: (bytes, name) => ipcRenderer.invoke('save-patch', { bytes, name }),
  version: '0.2.0'
});
