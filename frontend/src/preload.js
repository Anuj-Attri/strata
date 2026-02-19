const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('strata', {
  openFile: () => ipcRenderer.invoke('dialog:open'),
  saveFile: () => ipcRenderer.invoke('dialog:save'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
});
