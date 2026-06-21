const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atakCompanion', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  onLiveData: (fn: (data: any) => void) => {
    ipcRenderer.on('live-data', (_e, data) => fn(data));
  },
  onGameInjected: (fn: (info: any) => void) => {
    ipcRenderer.on('game-injected', (_e, info) => fn(info));
  },
  onGameExit: (fn: () => void) => {
    ipcRenderer.on('game-exit', () => fn());
  },
});
