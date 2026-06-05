/* ── ATAK Overwolf Background Script ────────────────────────────────────────── */

const IN_GAME_WINDOW = 'in_game'
const LEAGUE_GAME_ID = 5426
const BACKEND_URL    = 'http://localhost:4000'

let currentGameState    = null
let pollingInterval     = null
let inGameWindowId      = null

function log(...args) { console.log('[ATAK]', ...args) }

// ── Window helpers ─────────────────────────────────────────────────────────────

function getInGameWindow(cb) {
  overwolf.windows.obtainDeclaredWindow(IN_GAME_WINDOW, result => {
    if (result.status === 'success') cb(result.window)
    else log('obtainDeclaredWindow failed:', result)
  })
}

function showOverlay() {
  getInGameWindow(win => {
    overwolf.windows.restore(win.id, () => {
      inGameWindowId = win.id
      sendMessage({ type: 'game-started' })
      log('Overlay shown')
    })
  })
}

function hideOverlay() {
  if (inGameWindowId) {
    sendMessage({ type: 'game-ended' })
    setTimeout(() => overwolf.windows.close(inGameWindowId, () => log('Overlay hidden')), 400)
    inGameWindowId = null
  }
}

function sendMessage(content) {
  if (!inGameWindowId) return
  overwolf.windows.sendMessage(inGameWindowId, 'atak-message', content, () => {})
}

// ── Game Events ───────────────────────────────────────────────────────────────

function registerGameEvents() {
  overwolf.games.events.setRequiredFeatures(['match_info', 'live_client_data'], result => {
    if (result.status === 'success') log('Game features registered')
    else log('Feature registration failed:', result)
  })

  overwolf.games.events.onNewEvents.addListener(event => {
    if (!event?.events) return
    event.events.forEach(e => {
      if (e.name === 'matchStart') {
        log('Match started via GEP')
        showOverlay()
        startPolling()
      }
      if (e.name === 'matchEnd') {
        log('Match ended via GEP')
        stopPolling()
        hideOverlay()
        currentGameState = null
      }
    })
  })

  overwolf.games.events.onInfoUpdates2.addListener(event => {
    if (!event?.info) return
    currentGameState = { ...currentGameState, ...event.info, timestamp: Date.now() }
    // Throttled AI call on info updates
    if (Math.random() < 0.1) sendToAI(currentGameState)
  })
}

// ── Polling (fallback / enrichment) ───────────────────────────────────────────

function startPolling() {
  if (pollingInterval) return
  pollingInterval = setInterval(async () => {
    try {
      const res  = await fetch('http://127.0.0.1:2999/liveclientdata/allgamedata')
      if (!res.ok) return
      const data = await res.json()
      currentGameState = { ...data, source: 'liveclient', timestamp: Date.now() }

      // Push full game data to overlay
      sendMessage({ type: 'game-data', data })

      // Throttled AI coaching
      if (Math.random() < 0.2) await sendToAI(data)
    } catch {
      // Game client not exposing data yet — normal early in game
    }
  }, 5000)
}

function stopPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
}

// ── AI Backend ─────────────────────────────────────────────────────────────────

async function sendToAI(gameState) {
  if (!gameState) return
  try {
    sendMessage({ type: 'ai-loading' })

    const payload = {
      liveGame: {
        gameId:      gameState.gameData?.gameId ?? 'unknown',
        gameLength:  Math.floor(gameState.gameData?.gameTime ?? 0),
        participants: gameState.allPlayers ?? [],
        gameMode:    gameState.gameData?.gameMode,
      },
      playerRiotId: gameState.activePlayer?.summonerName ?? 'Unknown',
    }

    const res = await fetch(`${BACKEND_URL}/api/ai-live-coach`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    if (res.ok) {
      const { advice } = await res.json()
      if (advice) {
        log('AI advice received:', advice.slice(0, 80) + '...')
        sendMessage({ type: 'ai-advice', advice })
      }
    }
  } catch (err) {
    log('AI backend error:', err?.message)
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  log('Background script started')
  registerGameEvents()

  // Handle the case where the app launched mid-game
  overwolf.games.getRunningGameInfo(result => {
    if (result?.isRunning && result.id === LEAGUE_GAME_ID) {
      log('Already in a League game — showing overlay')
      showOverlay()
      startPolling()
    }
  })

  // Also watch for game launch/close via launchers
  overwolf.games.onGameLaunched.addListener(game => {
    if (game.id === LEAGUE_GAME_ID) {
      log('League launched')
      // Wait for Live Client API to come up before polling
      setTimeout(startPolling, 8000)
    }
  })

  overwolf.games.onGameClosed.addListener(game => {
    if (game.id === LEAGUE_GAME_ID) {
      log('League closed')
      stopPolling()
      hideOverlay()
    }
  })
}

init()
