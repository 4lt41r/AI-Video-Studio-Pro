const { contextBridge, ipcRenderer } = require('electron')

// Expose safe API surface to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  pickFile:         (opts)    => ipcRenderer.invoke('pick-file', opts),
  pickFolder:       (opts)    => ipcRenderer.invoke('pick-folder', opts),
  saveFile:         (opts)    => ipcRenderer.invoke('save-file', opts),
  openExternal:     (url)     => ipcRenderer.invoke('open-external', url),
  showInFolder:     (path)    => ipcRenderer.invoke('show-item-in-folder', path),
})
