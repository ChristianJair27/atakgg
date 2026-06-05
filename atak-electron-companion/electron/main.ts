import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'

let mainWindow: BrowserWindow | null = null
let isInGame = false
let pollingInterval: NodeJS.Timeout | null = null
let aiCallInProgress = false

// How many consecutive ticks with no live data before we declare game over
// (protects against brief port-2999 blips mid-game causing false game-end)
let noDataStreak = 0
const NO_DATA_THRESHOLD = 4  // 4 × 2.8 s ≈ 11 s debounce

const BACKEND_URL = 'http://localhost:4000'

// ── Window helpers ─────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function setToWebMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setResizable(true)
  mainWindow.setAlwaysOnTop(false)
  mainWindow.setSize(1100, 700, true)
  mainWindow.webContents.send('always-on-top-changed', false)
}

function setToLiveMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { width } = screen.getPrimaryDisplay().workAreaSize
  mainWindow.setResizable(true)
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setSize(420, 560, true)
  // Pin to top-right corner so it's always visible over the game
  mainWindow.setPosition(width - 440, 20, true)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('always-on-top-changed', true)
}

function send(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

// ── League detection ──────────────────────────────────────────────────────────

// True if any League process is running (client OR in-game)
function checkLeagueRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const names = ['LeagueClient.exe', 'LeagueClientUx.exe', 'League of Legends.exe']
    let found = false
    let pending = names.length

    names.forEach((name) => {
      exec(`tasklist /FI "IMAGENAME eq ${name}" /NH`, { encoding: 'utf8' }, (_err, stdout) => {
        if (stdout?.toLowerCase().includes(name.toLowerCase())) found = true
        if (--pending === 0) resolve(found)
      })
    })
  })
}

// Returns game data when a match is actively running, null otherwise
async function fetchLiveGameData(): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch('http://127.0.0.1:2999/liveclientdata/allgamedata', {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ── AI coaching ───────────────────────────────────────────────────────────────

async function sendToAI(gameData: any) {
  if (aiCallInProgress) return   // never stack concurrent AI calls
  aiCallInProgress = true

  try {
    const payload = {
      liveGame: {
        gameId:       gameData.gameData?.gameId,
        gameLength:   Math.floor(gameData.gameData?.gameTime || 0),
        participants: gameData.allPlayers || [],
        gameMode:     gameData.gameData?.gameMode,
      },
      playerRiotId: gameData.activePlayer?.summonerName || 'Unknown',
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${BACKEND_URL}/api/ai-live-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const json = await res.json()
      if (json?.advice) send('ai-advice', json.advice)
    }
  } catch (err) {
    console.error('[ATAK] AI request failed:', (err as Error).message)
  } finally {
    aiCallInProgress = false
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────

function startGamePolling() {
  if (pollingInterval) return

  pollingInterval = setInterval(async () => {
    try {
      // ── Port 2999 is the authoritative in-game signal — always check it first ──
      const gameData = await fetchLiveGameData()

      if (gameData) {
        noDataStreak = 0
        if (!isInGame) {
          isInGame = true
          console.log('[ATAK] Game detected via port 2999 — switching to live mode')
          setToLiveMode()
          send('game-started')
        }
        send('live-game-data', gameData)
        if (!aiCallInProgress && Math.random() < 0.17) {
          sendToAI(gameData)
        }

      } else if (isInGame) {
        // Port 2999 went silent — debounce before declaring game over
        noDataStreak++
        if (noDataStreak >= NO_DATA_THRESHOLD) {
          noDataStreak = 0
          isInGame = false
          setToWebMode()
          send('game-ended')
        }

      } else {
        // Not in game — check if League client is open just for the status chip
        checkLeagueRunning().then(running => {
          if (running) send('league-detected')
        })
      }

    } catch (err) {
      console.error('[ATAK] Polling error:', err)
    }
  }, 2800)
}

function stopGamePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  setToWebMode()
  startGamePolling()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopGamePolling()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopGamePolling()
})

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('request-ai-advice', async (_event, gameData) => {
  await sendToAI(gameData)
})

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

ipcMain.on('window-toggle-always-on-top', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const next = !mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(next, 'screen-saver')
  send('always-on-top-changed', next)
})
