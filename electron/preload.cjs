const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('reader', {
  initialize: () => ipcRenderer.invoke('initialize'),
  open: file => ipcRenderer.invoke('open-file', file),
  pathForFile: file => webUtils.getPathForFile(file),
  onOpen: callback => ipcRenderer.on('open-request', (_event, file) => callback(file))
});
