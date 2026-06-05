import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Game lifecycle
  onGameStarted:    (cb: () => void)                    => ipcRenderer.on('game-started', cb),
  onGameEnded:      (cb: () => void)                    => ipcRenderer.on('game-ended', cb),
  onLeagueDetected: (cb: () => void)                    => ipcRenderer.on('league-detected', cb),
  onLiveGameData:   (cb: (data: any) => void)           => ipcRenderer.on('live-game-data', (_e, d) => cb(d)),
  onAIAdvice:       (cb: (advice: string) => void)      => ipcRenderer.on('ai-advice', (_e, a) => cb(a)),
  requestAIAdvice:  (gameData: any)                     => ipcRenderer.invoke('request-ai-advice', gameData),

  // Window controls (frameless window)
  windowMinimize:       ()                                => ipcRenderer.send('window-minimize'),
  windowClose:          ()                               => ipcRenderer.send('window-close'),
  toggleAlwaysOnTop:    ()                               => ipcRenderer.send('window-toggle-always-on-top'),
  onAlwaysOnTopChanged: (cb: (isOnTop: boolean) => void) => ipcRenderer.on('always-on-top-changed', (_e, v) => cb(v)),
})
