const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lens', {
  captureAndProcess: (mode) => ipcRenderer.invoke('capture-and-process', mode),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  closeApp: () => ipcRenderer.send('close-app'),
  setClickthrough: (val) => ipcRenderer.send('set-clickthrough', val),
  onTriggerCapture: (cb) => ipcRenderer.on('trigger-capture', cb)
})
