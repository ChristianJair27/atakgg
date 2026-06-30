/* ── ATAK Overwolf Background Script v0.6.0 ─────────────────────────────────
 *
 * Champion select via LCU API (no Overwolf store approval needed):
 *   1. Read %LOCALAPPDATA%\Riot Games\League of Legends\lockfile
 *   2. Poll /lol-gameflow/v1/gameflow-phase every 2s for phase
 *   3. Poll /lol-champ-select/v1/session when in ChampSelect
 *
 * In-game overlay via GEP game ID 5426 (approved without store listing).
 * ─────────────────────────────────────────────────────────────────────────── */

const IN_GAME_WINDOW      = 'in_game'
const CHAMP_SEL_WINDOW    = 'champ_select'
const QUEUE_WINDOW        = 'queue_profile'
const EOG_WINDOW          = 'end_of_game'
const ARENA_AUG_WINDOW    = 'arena_augments'
const DESKTOP_WINDOW      = 'desktop'
const HOME_WINDOW         = 'home'
const PLAYER_STATS_WINDOW = 'player_stats'
const LOL_GAME_ID      = 5426
const BACKEND_URL      = 'http://localhost:4000'

const INGAME_FEATURES  = ['match_info', 'live_client_data', 'summoner_info', 'kill', 'death', 'counters', 'team_frames']

// Common LoL install paths for lockfile discovery (expanded to cover all drives)
let LOCKFILE_PATHS = [
  'C:/Riot Games/League of Legends/lockfile',
  'D:/Riot Games/League of Legends/lockfile',
  'E:/Riot Games/League of Legends/lockfile',
  'F:/Riot Games/League of Legends/lockfile',
  'G:/Riot Games/League of Legends/lockfile',
  'C:/Program Files/Riot Games/League of Legends/lockfile',
  'C:/Program Files (x86)/Riot Games/League of Legends/lockfile',
  'D:/Program Files/Riot Games/League of Legends/lockfile',
  'E:/Program Files/Riot Games/League of Legends/lockfile',
]

// Derive lockfile path from the game's executable path reported by Overwolf.
// executionPath is typically "X:\...\Game\League of Legends.exe" — lockfile lives two levels up.
function registerLockfileFromExe(executionPath) {
  if (!executionPath) return
  const norm = executionPath.replace(/\\/g, '/')
  const dir1 = norm.replace(/[^/]+$/, '')       // parent dir (Game/)
  const dir2 = dir1.replace(/[^/]+\/$/, '')      // grandparent dir (LoL root)
  for (const dir of [dir2, dir1]) {
    const p = dir + 'lockfile'
    if (!LOCKFILE_PATHS.includes(p)) {
      LOCKFILE_PATHS.unshift(p)
      log('Registered lockfile path from exe:', p)
    }
  }
}

let gamePhase           = 'None'
let isGameRunning       = false
let inGameWindowId      = null
let champSelWindowId    = null
let queueProfileWindowId = null
let eogWindowId          = null
let eogPollTimer         = null
let pollingInterval      = null   // port-2999 in-game polling
let gameGepTimer        = null
let aiCallInProgress    = false
let lastAiCallTime      = 0
const AI_COOLDOWN_MS    = 90_000   // minimum 90s between AI calls
let currentGameState    = null

// LCU state
let lcuPort          = null
let lcuPass          = null
let lcuPollTimer     = null
let lastLcuPhase     = null
let lastChampionId   = 0
const champNameCache  = {}   // numericId → display name
const champDDKeyCache = {}   // numericId → DDragon key (e.g. "MissFortune")
let ddMapReady       = false
let ddMapLoading     = false
// Per-session caches (cleared on ChampSelect exit)
const summonerInfoCache = {}  // cellId → LCU summoner object (rank, level, etc.)
const masteryCache      = {}  // "${puuid}:${champId}" → mastery object

// Player rank cache: summonerName → rank object { tier, division, lp, winRate, tier_image_url }
// Populated during champ-select or in-game; persists for the session.
const playerRankCache   = {}
// OP.GG full profile cache: summonerName → OPGGFullProfile response from /api/opgg/summoner-full
const playerOpggCache   = {}
let   lcuPlatform       = null   // e.g. "LA1", "NA1" — detected from LCU at queue time

function log(...args) { console.log('[ATAK BG]', ...args) }

// ── OP.GG full profile fetcher (fire-and-forget) ──────────────────────────
async function fetchOpggForSlot(slot, info) {
  const name = slot.summonerName || info?.displayName || ''
  if (!name || playerOpggCache[name]) return

  let gameName = info?.gameName || ''
  let tagLine  = info?.tagLine  || ''

  // Fallback: parse summonerName if it contains '#'
  if (!gameName && name.includes('#')) {
    ;[gameName, tagLine] = name.split('#')
  }

  if (!gameName || !tagLine || !lcuPlatform) return

  const champName = slot.champName || ''
  const url = `${BACKEND_URL}/api/opgg/summoner-full?game_name=${encodeURIComponent(gameName)}&tag_line=${encodeURIComponent(tagLine)}&region=${encodeURIComponent(lcuPlatform)}&champion=${encodeURIComponent(champName)}`

  try {
    const r = await fetch(url)
    if (!r.ok) return
    const body = await r.json()
    if (body.ok) {
      playerOpggCache[name] = { ...body, _gameName: gameName, _tagLine: tagLine }
      // Push update to champ_select window if it's open
      if (champSelWindowId) {
        sendMessage(champSelWindowId, { type: 'opgg-player-data', summonerName: name, data: playerOpggCache[name] })
      }
    }
  } catch (err) { log('OP.GG fetch failed for', name, err?.message) }
}

// ── Window helpers ─────────────────────────────────────────────────────────

function getWindow(name, cb) {
  overwolf.windows.obtainDeclaredWindow(name, result => {
    if (result.status === 'success') cb(null, result.window)
    else cb(new Error('obtainDeclaredWindow(' + name + ') failed: ' + result.error), null)
  })
}

const inGameRef         = { current: null }
const champSelRef       = { current: null }
const queueProfileRef   = { current: null }
const eogRef            = { current: null }
const arenaAugRef       = { current: null }
const desktopRef        = { current: null }
const homeRef           = { current: null }
const playerStatsRef    = { current: null }
let desktopWindowId     = null
let homeWindowId        = null
let playerStatsWindowId = null
let prevAugmentCount   = 0
let arenaRound         = 0
let isArenaMode        = false

function showWindow(name, idRef, cb) {
  getWindow(name, (err, win) => {
    if (err) { log(err.message); return }
    overwolf.windows.restore(win.id, res => {
      if (res.status !== 'success') { log('restore failed:', res); return }
      overwolf.windows.bringToFront(win.id, true, () => {
        idRef.current = win.id
        log(name + ' shown (id=' + win.id + ')')
        if (cb) cb(win.id)
      })
    })
  })
}

function closeWindow(name, idRef) {
  const id = idRef.current
  if (!id) return
  overwolf.windows.close(id, () => { log(name + ' closed'); idRef.current = null })
}

function sendMessage(windowId, content) {
  if (!windowId) return
  overwolf.windows.sendMessage(windowId, 'atak-message', content, () => {})
}

function showOverlay() {
  showWindow(IN_GAME_WINDOW, inGameRef, id => {
    inGameWindowId = id
    sendMessage(id, { type: 'game-started' })
  })
}

// in_game.js polls live data via backend proxy (fetch to localhost:4000/api/lcu-proxy/game-data).
// This IPC channel is still used for rank badges and AI advice which only background.js has.
window.onInGameReady = function(windowId) {
  log('in_game ready (id=' + windowId + ')')
  inGameWindowId = windowId
  inGameRef.current = windowId
  if (!pollingInterval) startPortPolling()
}
function hideOverlay()      { sendMessage(inGameWindowId, { type: 'game-ended' }); setTimeout(() => { closeWindow(IN_GAME_WINDOW, inGameRef); inGameWindowId = null }, 400) }
function showChampSelect()  { showWindow(CHAMP_SEL_WINDOW, champSelRef, id => { champSelWindowId = id }) }
function hideChampSelect()  { closeWindow(CHAMP_SEL_WINDOW, champSelRef); champSelWindowId = null }
function showQueueProfile() { showWindow(QUEUE_WINDOW, queueProfileRef, id => { queueProfileWindowId = id; fetchAndSendQueueData(id) }) }
function hideQueueProfile() { closeWindow(QUEUE_WINDOW, queueProfileRef); queueProfileWindowId = null }
function showDesktop()     { showWindow(DESKTOP_WINDOW, desktopRef, id => { desktopWindowId = id }) }
function hideDesktop()     { closeWindow(DESKTOP_WINDOW, desktopRef); desktopWindowId = null }
function showHome() {
  const alreadyOpen = !!homeRef.current
  showWindow(HOME_WINDOW, homeRef, id => {
    homeWindowId = id
    // If window was already open just send the profile URL immediately;
    // otherwise give home.html 800ms to finish loading before sending it.
    const delay = alreadyOpen ? 100 : 800
    setTimeout(() => fetchAndSendHomeUrl(id), delay)
  })
}
function hideHome()        { closeWindow(HOME_WINDOW, homeRef); homeWindowId = null }

async function fetchAndSendHomeUrl(windowId, attempt = 0) {
  log('fetchAndSendHomeUrl attempt', attempt, 'windowId=', !!windowId, 'lcuPort=', lcuPort)
  if (!windowId) return
  const MAX = 25  // ~50 s of retries
  if (!lcuPort) {
    log('fetchAndSendHomeUrl: no lcuPort, will retry')
    if (attempt < MAX) setTimeout(() => fetchAndSendHomeUrl(windowId, attempt + 1), 2000)
    return
  }
  try {
    const summoner = await lcuGet('/lol-summoner/v1/current-summoner')
    // platformId missing in newer League clients — fall back to riotclient endpoint
    if (summoner?.platformId) {
      lcuPlatform = summoner.platformId
    } else if (!lcuPlatform) {
      try {
        const locale = await lcuGet('/riotclient/region-locale')
        if (locale?.region) lcuPlatform = locale.region
        log('fetchAndSendHomeUrl region from riotclient:', lcuPlatform)
      } catch (_) {}
    }
    log('fetchAndSendHomeUrl summoner:', summoner?.gameName, summoner?.tagLine, '| platform:', lcuPlatform)
    if (summoner?.gameName && summoner?.tagLine && lcuPlatform) {
      const name = encodeURIComponent(summoner.gameName)
      const tag  = encodeURIComponent(summoner.tagLine)
      const url  = `http://localhost:8080/profile/${lcuPlatform.toLowerCase()}/${name}-${tag}`
      log('Home profile URL:', url)
      sendMessage(windowId, { type: 'summoner-profile-url', url })
    } else {
      log('fetchAndSendHomeUrl: summoner incomplete, retrying')
      if (attempt < MAX) setTimeout(() => fetchAndSendHomeUrl(windowId, attempt + 1), 2000)
    }
  } catch (err) {
    log('fetchAndSendHomeUrl failed (attempt ' + attempt + '):', err?.message)
    if (attempt < MAX) setTimeout(() => fetchAndSendHomeUrl(windowId, attempt + 1), 2000)
  }
}
function showPlayerStats() {
  const alreadyOpen = !!playerStatsRef.current
  showWindow(PLAYER_STATS_WINDOW, playerStatsRef, id => {
    playerStatsWindowId = id
    // Give the window time to load its JS before sending data
    const delay = alreadyOpen ? 100 : 700
    setTimeout(() => {
      sendMessage(id, {
        type:  'player-stats-data',
        game:  currentGameState,
        ranks: { ...playerRankCache },
        opgg:  { ...playerOpggCache },
      })
      // Also trigger immediate rank fetch for any players not yet cached
      if (currentGameState?.allPlayers) fetchMissingRanks(currentGameState.allPlayers)
    }, delay)
  })
}
function hidePlayerStats() {
  closeWindow(PLAYER_STATS_WINDOW, playerStatsRef)
  playerStatsWindowId = null
}
// Expose so player_stats.html close button can call it
window.hidePlayerStats = hidePlayerStats

function showEogWindow()    { showWindow(EOG_WINDOW, eogRef, id => { eogWindowId = id; startEogPoll(id) }) }
function hideEogWindow()    {
  if (eogPollTimer) { clearTimeout(eogPollTimer); eogPollTimer = null }
  closeWindow(EOG_WINDOW, eogRef); eogWindowId = null
}
function showArenaAugWindow(champName, augCount, round) {
  showWindow(ARENA_AUG_WINDOW, arenaAugRef, id => {
    sendMessage(id, { type: 'aug-init', champName, augCount, round })
  })
}
function hideArenaAugWindow() {
  closeWindow(ARENA_AUG_WINDOW, arenaAugRef)
}

// ── LCU (League Client Update) API ────────────────────────────────────────

function readLockfile(cb) {
  function tryIdx(idx) {
    if (idx >= LOCKFILE_PATHS.length) {
      // Fallback: try via Overwolf system info for LOCALAPPDATA
      overwolf.utils.getSystemInformation(info => {
        const appData = info?.systemInfo?.LocalAppData
        if (appData) {
          const p = appData.replace(/\\/g, '/') + '/Riot Games/League of Legends/lockfile'
          overwolf.io.readTextFile(p, {encoding: 'UTF8'}, r => cb(r?.success ? r.content : null))
        } else {
          cb(null)
        }
      })
      return
    }
    overwolf.io.readTextFile(LOCKFILE_PATHS[idx], {encoding: 'UTF8'}, r => {
      if (r?.success && r.content) cb(r.content)
      else tryIdx(idx + 1)
    })
  }
  tryIdx(0)
}

function parseLockfile(content) {
  // Format: name:pid:port:password:protocol
  const parts = (content || '').trim().split(':')
  return parts.length >= 5 ? { port: parts[2], password: parts[3] } : null
}

function lcuGet(path) {
  // Use overwolf.web.sendHttpRequest — same method used for port 2999.
  // It bypasses TLS cert validation (LCU uses self-signed) and CORS, no proxy needed.
  return new Promise((resolve, reject) => {
    const url = 'https://127.0.0.1:' + lcuPort + path
    const auth = 'Basic ' + btoa('riot:' + lcuPass)
    overwolf.web.sendHttpRequest(
      url,
      overwolf.web.enums.HttpRequestMethods.GET,
      [{ key: 'Authorization', value: auth }, { key: 'Accept', value: 'application/json' }],
      null,
      result => {
        if (!result?.success) { reject(new Error(result?.error || 'LCU unreachable')); return }
        if (result.statusCode === 404) { reject(new Error('HTTP 404')); return }
        if (result.statusCode >= 400)  { reject(new Error('HTTP ' + result.statusCode)); return }
        try { resolve(JSON.parse(result.data)) }
        catch (e) { reject(new Error('JSON: ' + e.message)) }
      }
    )
  })
}

function startLcuPolling() {
  if (lcuPollTimer) return
  log('LCU polling started')
  pollLcu()
  lcuPollTimer = setInterval(pollLcu, 2000)
}

function stopLcuPolling() {
  if (lcuPollTimer) { clearInterval(lcuPollTimer); lcuPollTimer = null }
  lcuPort = null; lcuPass = null
  lastLcuPhase = null; lastChampionId = 0
  log('LCU polling stopped')
}

async function pollLcu() {
  // Acquire credentials from lockfile if not connected
  if (!lcuPort) {
    readLockfile(content => {
      const parsed = parseLockfile(content)
      if (parsed) {
        lcuPort = parsed.port
        lcuPass = parsed.password
        log('LCU lockfile found — port:', lcuPort)
      }
    })
    return
  }

  try {
    const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase')

    if (phase !== lastLcuPhase) {
      log('LCU phase:', phase)
      lastLcuPhase = phase
      handlePhaseChange(phase)   // ChampSelect | InProgress | EndOfGame | None | Lobby | …
    }

    if (phase === 'ChampSelect') {
      await pollChampSelect()
    } else {
      lastChampionId = 0
    }
  } catch (err) {
    const msg = err?.message || ''
    const disconnected = msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED')
      || msg.includes('HTTP 404') || msg.includes('LCU unreachable') || msg.includes('unreachable')
      || msg.includes('Connection refused') || msg.includes('ECONNREFUSED')
    if (disconnected && lcuPort) {
      log('LCU disconnected —', msg)
      lcuPort = null; lcuPass = null
    }
  }
}

async function ensureDDMap() {
  if (ddMapReady || ddMapLoading) return
  ddMapLoading = true
  try {
    const vers = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json()
    const data = await (await fetch('https://ddragon.leagueoflegends.com/cdn/' + vers[0] + '/data/en_US/champion.json')).json()
    for (const c of Object.values(data.data)) {
      const id = Number(c.key)
      champNameCache[id]  = c.name
      champDDKeyCache[id] = c.id   // DDragon key like "MissFortune"
    }
    ddMapReady  = true
    log('DDragon map loaded:', Object.keys(champNameCache).length, 'champions')
  } catch (e) { log('DDragon map failed:', e?.message) }
  ddMapLoading = false
}

function resolveSlot(slot) {
  const champId = slot.championId || slot.championPickIntent || 0
  return {
    cellId:       slot.cellId,
    champId,
    champName:    champId ? (champNameCache[champId]  || null) : null,
    ddKey:        champId ? (champDDKeyCache[champId] || null) : null,
    isLocked:     (slot.championId || 0) > 0,
    isActing:     slot.isActingNow || false,
    position:     slot.assignedPosition || '',
    summonerName: slot.summonerName || '',
    summonerId:   slot.summonerId   || '',
    puuid:        slot.puuid        || '',
  }
}

// ── Queue profile data ────────────────────────────────────────────────────

async function fetchAndSendQueueData(windowId) {
  if (!lcuPort) return
  await ensureDDMap()
  try {
    const [summoner, ranked, masteries] = await Promise.all([
      lcuGet('/lol-summoner/v1/current-summoner'),
      lcuGet('/lol-ranked/v1/current-ranked-stats').catch(() => null),
      lcuGet('/lol-champion-mastery/v1/top-champion-masteries').catch(() => null),
    ])
    if (summoner?.platformId) {
      lcuPlatform = summoner.platformId
    } else if (!lcuPlatform) {
      const locale = await lcuGet('/riotclient/region-locale').catch(() => null)
      if (locale?.region) lcuPlatform = locale.region
    }
    // Navigate the desktop window to the summoner's profile page.
    // After desktop.html redirects to the web app, the window URL has changed from
    // desktop.html to the web app — so sendMessage won't reach it anymore.
    // Instead, use overwolf.windows.changeWebviewUrl (if supported) or just log the URL
    // so the user can navigate manually. The queue_profile window shows the profile inline.
    if (summoner?.gameName && summoner?.tagLine && lcuPlatform) {
      const name = encodeURIComponent(summoner.gameName)
      const tag  = encodeURIComponent(summoner.tagLine)
      const profileUrl = `http://localhost:8080/profile/${lcuPlatform.toLowerCase()}/${name}-${tag}`
      log('Profile URL for desktop:', profileUrl)
      // Try to navigate desktop window if it's still on the local HTML (before redirect)
      if (desktopWindowId) {
        sendMessage(desktopWindowId, { type: 'summoner-profile-url', url: profileUrl })
      }
    }
    const topMasteries = (Array.isArray(masteries) ? masteries : []).slice(0, 5).map(m => ({
      championId:     m.championId,
      championLevel:  m.championLevel,
      championPoints: m.championPoints,
      champName:      champNameCache[m.championId] || null,
      ddKey:          champDDKeyCache[m.championId] || null,
    }))
    sendMessage(windowId, {
      type: 'queue-init',
      data: { summoner, ranked, masteries: topMasteries },
    })
    log('Queue profile data sent — summoner:', summoner?.gameName, 'masteries:', topMasteries.length)
  } catch (err) {
    log('fetchAndSendQueueData failed:', err?.message)
  }
}

// ── End-of-game data polling ──────────────────────────────────────────────

function startEogPoll(windowId) {
  let attempts = 0
  const MAX = 40, DELAY = 2500   // try for ~100s

  async function tryFetch() {
    attempts++
    try {
      const data = await lcuGet('/lol-end-of-game/v1/eog-stats-block')
      if (data && (data.gameId || data.localPlayer)) {
        log('EOG stats received after', attempts, 'attempts')
        sendMessage(windowId, { type: 'eog-data', data })
        // Also send platform if we know it
        if (data.localPlayer?.summonerName) {
          try {
            const sum = await lcuGet('/lol-summoner/v1/current-summoner')
            if (sum?.platformId) sendMessage(windowId, { type: 'eog-platform', platform: sum.platformId.toLowerCase() })
          } catch {}
        }
        return
      }
    } catch (err) {
      log('EOG poll attempt', attempts, '—', err?.message)
    }
    if (attempts < MAX && eogWindowId === windowId) {
      eogPollTimer = setTimeout(tryFetch, DELAY)
    }
  }
  eogPollTimer = setTimeout(tryFetch, 3000)  // give LCU 3s to settle first
}

// Fetch summoner info (rank tier, LP, level) for a cell — non-blocking, cached
async function fetchSummonerForCell(cellId) {
  if (summonerInfoCache[cellId] !== undefined) return
  summonerInfoCache[cellId] = null   // mark as in-flight
  try {
    const data = await lcuGet('/lol-champ-select/v1/summoners/' + cellId)
    summonerInfoCache[cellId] = data
  } catch { summonerInfoCache[cellId] = null }
}

// Fetch mastery for locked champion — non-blocking, cached
async function fetchMastery(puuid, champId) {
  const key = puuid + ':' + champId
  if (masteryCache[key] !== undefined) return
  masteryCache[key] = null
  try {
    const data = await lcuGet('/lol-champion-mastery/v1/champion-mastery/player/' + puuid + '/champion/' + champId)
    masteryCache[key] = data
  } catch { masteryCache[key] = null }
}

async function pollChampSelect() {
  const session = await lcuGet('/lol-champ-select/v1/session')
  await ensureDDMap()

  const localCellId = session.localPlayerCellId
  const myTeam    = (session.myTeam    || []).map(resolveSlot)
  const theirTeam = (session.theirTeam || []).map(resolveSlot)

  const resolveBan = id => ({
    champId:   id || 0,
    champName: id ? (champNameCache[id]  || null) : null,
    ddKey:     id ? (champDDKeyCache[id] || null) : null,
  })

  const bans = {
    myTeamBans:    (session.bans?.myTeamBans    || []).map(resolveBan),
    theirTeamBans: (session.bans?.theirTeamBans || []).map(resolveBan),
  }

  const timerSecs  = Math.ceil((session.timer?.adjustedTimeLeftInPhase || 0) / 1000)
  const timerPhase = session.timer?.phase || 'PLANNING'

  // Queue summoner info + mastery fetches (non-blocking, cached)
  const allSlots = [...myTeam, ...theirTeam]
  for (const s of allSlots) {
    if (s.cellId !== undefined) fetchSummonerForCell(s.cellId)
    if (s.isLocked && s.puuid && s.champId) fetchMastery(s.puuid, s.champId)
  }

  // Collect cached data to include in message
  const summoners = {}, mastery = {}
  for (const s of allSlots) {
    const info = summonerInfoCache[s.cellId]
    if (info) summoners[s.cellId] = info
    const mk = s.puuid + ':' + s.champId
    if (masteryCache[mk]) mastery[mk] = masteryCache[mk]
  }

  // Trigger OP.GG fetches for all slots (fire-and-forget)
  for (const s of allSlots) {
    const info = summonerInfoCache[s.cellId]
    if (s.summonerName && info) fetchOpggForSlot(s, info)
  }

  // Collect available OP.GG data
  const opggData = {}
  for (const s of allSlots) {
    if (s.summonerName && playerOpggCache[s.summonerName]) {
      opggData[s.summonerName] = playerOpggCache[s.summonerName]
    }
  }

  sendMessage(champSelWindowId, {
    type: 'champ-select-full',
    data: { localCellId, myTeam, theirTeam, bans, timerSecs, timerPhase, platform: lcuPlatform, summoners, mastery, opggData },
  })

  // Build summonerName → rank from LCU summonerInfoCache (best-effort)
  for (const s of allSlots) {
    const info = summonerInfoCache[s.cellId]
    if (!info || !s.summonerName) continue
    // LCU may surface rank under different field paths; try both known shapes
    const solo = info.rankedStats?.rankedLeagueStat
      ?? info.rankStats?.rankedLeagueStat
      ?? (info.rankedLeagueStats ?? []).find(r => r.queueType === 'RANKED_SOLO_5x5')
    if (solo) {
      playerRankCache[s.summonerName] = {
        tier: solo.tier ?? null,
        division: solo.rank ?? solo.division ?? null,
        lp: solo.leaguePoints ?? solo.lp ?? null,
      }
    }
  }

  const me = myTeam.find(p => p.cellId === localCellId)
  const myChampId = me?.champId || 0
  if (myChampId && myChampId !== lastChampionId) {
    lastChampionId = myChampId
    if (me?.champName) {
      log('ChampSelect: my champ =', me.champName, me.isLocked ? '[LOCKED]' : '[hover]')
      fetchChampionRecommendation(me.champName, me.position)
    }
  }
}

// ── Champion select data → champ_select window ────────────────────────────

function handleChampSelectData(data) {
  sendMessage(champSelWindowId, { type: 'champ-select-update', data })
  const champName = data.local_player_selection?.championName
  if (champName && champName !== 'None') fetchChampionRecommendation(champName)
}

async function fetchChampionRecommendation(championName, position) {
  try {
    let url = BACKEND_URL + '/api/champ-select?champion=' + encodeURIComponent(championName)
    if (position) url += '&position=' + encodeURIComponent(position)
    const res = await fetch(url)
    if (res.ok) {
      const rec = await res.json()
      if (rec.ok) sendMessage(champSelWindowId, { type: 'champion-recommendation', data: rec })
    }
  } catch (err) { log('Champ rec failed:', err?.message) }
}

// ── GEP — Game (5426 in-game) ─────────────────────────────────────────────

function registerGameFeatures(attempt) {
  attempt = attempt || 0
  const MAX = 30, DELAY_MS = Math.min(3000 * (attempt + 1), 15000)
  overwolf.games.events.setRequiredFeatures(INGAME_FEATURES, result => {
    if (result.status === 'success') {
      log('Game GEP OK. Supported:', result.supportedFeatures)
      clearTimeout(gameGepTimer); gameGepTimer = null
    } else {
      if (attempt < MAX) {
        log('Game GEP attempt ' + (attempt+1) + '/' + MAX + ' failed: ' + (result.reason || result.status))
        gameGepTimer = setTimeout(() => registerGameFeatures(attempt + 1), DELAY_MS)
      }
    }
  })
}

function setupGameListeners() {
  overwolf.games.events.onNewEvents.addListener(event => {
    if (!event?.events) return
    event.events.forEach(e => {
      log('GEP event:', e.name)
      if (e.name === 'matchStart')                        { handlePhaseChange('InProgress'); startPortPolling() }
      if (e.name === 'round_start') {
        arenaRound++
        log('Arena round_start — round', arenaRound)
        if (arenaAugRef.current)
          sendMessage(arenaAugRef.current, { type: 'aug-update', champName: null, augCount: prevAugmentCount, round: arenaRound })
      }
      if (e.name === 'matchEnd' || e.name === 'matchOutcome') {
        stopPortPolling(); handlePhaseChange('EndOfGame')
        setTimeout(() => handlePhaseChange('None'), 8000)
        currentGameState = null
      }
    })
  })
  overwolf.games.events.onInfoUpdates2.addListener(event => {
    if (!event?.info) return
    if (event.info.live_client_data || event.info.match_info) {
      currentGameState = { ...currentGameState, ...event.info, timestamp: Date.now() }
      if (Math.random() < 0.1) sendToAI(currentGameState)
    }
  })
}

// ── Phase state machine ────────────────────────────────────────────────────

function handlePhaseChange(newPhase) {
  // Normalise minor post-game phases
  if (newPhase === 'WaitingForStats' || newPhase === 'PreEndOfGame') newPhase = 'EndOfGame'
  // Map matchmaking/ready check → single internal 'Queue' phase.
  // 'Lobby' is intentionally excluded — being in lobby ≠ searching for a game.
  if (newPhase === 'Matchmaking' || newPhase === 'ReadyCheck') {
    // Notify queue window if it's a ready check (distinct from matchmaking)
    if (newPhase === 'ReadyCheck' && queueProfileWindowId) {
      sendMessage(queueProfileWindowId, { type: 'queue-phase', phase: 'ReadyCheck' })
    } else if (queueProfileWindowId) {
      sendMessage(queueProfileWindowId, { type: 'queue-phase', phase: 'Matchmaking' })
    }
    newPhase = 'Queue'
  }

  if (newPhase === gamePhase) return
  const prev = gamePhase; gamePhase = newPhase
  log('Phase: ' + prev + ' → ' + newPhase)

  // First-ever LCU connection — push profile URL to home window immediately
  if (prev === null && homeWindowId) {
    setTimeout(() => fetchAndSendHomeUrl(homeWindowId), 300)
  }

  // Exit actions
  // NOTE: home window is intentionally kept alive through all phases so the user
  // can Alt-Tab to the web app at any time (lobby, queue, champ-select, in-game).
  // It is only closed when LoL exits (None) or the user manually closes it.
  if (prev === 'ChampSelect' && newPhase !== 'ChampSelect') {
    hideChampSelect()
    for (const k of Object.keys(summonerInfoCache)) delete summonerInfoCache[k]
    for (const k of Object.keys(masteryCache))      delete masteryCache[k]
    // playerOpggCache is kept alive for in-game player_stats panel — cleared on InProgress exit
  }
  if (prev === 'Queue'      && newPhase !== 'Queue')      hideQueueProfile()
  if (prev === 'InProgress' && newPhase !== 'InProgress') {
    hideOverlay(); hideArenaAugWindow(); hidePlayerStats()
    isArenaMode = false; prevAugmentCount = 0; arenaRound = 0
    for (const k of Object.keys(playerRankCache)) delete playerRankCache[k]
    for (const k of Object.keys(playerOpggCache)) delete playerOpggCache[k]
  }
  if (prev === 'EndOfGame'  && newPhase !== 'EndOfGame')  hideEogWindow()

  switch (newPhase) {
    case 'Lobby':
      hideEogWindow()
      hideQueueProfile()
      showHome()
      break
    case 'Queue':
      hideEogWindow()
      showQueueProfile()
      break
    case 'ChampSelect':
      hideQueueProfile()
      hideEogWindow()
      showChampSelect()
      break
    case 'InProgress':
      // home window stays open — user can Alt-Tab to see profile / build data
      hideQueueProfile()
      hideChampSelect()
      hideEogWindow()
      showOverlay()
      startPortPolling()
      break
    case 'EndOfGame':
      stopPortPolling()
      hideOverlay(); hideArenaAugWindow(); hidePlayerStats()
      hideChampSelect()
      hideQueueProfile()
      showEogWindow()
      // home stays open — returns to it after dismissing EOG
      break
    case 'None':
      stopPortPolling()
      hideOverlay(); hideArenaAugWindow(); hidePlayerStats()
      hideChampSelect()
      hideQueueProfile()
      hideEogWindow()
      hideHome()  // LoL exited — close home
      break
  }
}

// ── Port-2999 polling (in-game Live Client Data) ──────────────────────────

function startPortPolling() {
  if (pollingInterval) return

  // Use overwolf.web.sendHttpRequest instead of fetch — bypasses CORS restrictions
  // (LoL port 2999 does not send Access-Control-Allow-Origin headers)
  function poll() {
    overwolf.web.sendHttpRequest(
      'https://127.0.0.1:2999/liveclientdata/allgamedata',
      overwolf.web.enums.HttpRequestMethods.GET,
      [], null,
      result => {
        if (!result?.success || result.statusCode !== 200) return
        let data
        try { data = JSON.parse(result.data) } catch { return }

        currentGameState = { ...data, source: 'liveclient', timestamp: Date.now() }
        if (gamePhase !== 'InProgress') handlePhaseChange('InProgress')
        data._playerRanks = playerRankCache
        sendMessage(inGameWindowId, { type: 'game-data', data })
        if (playerStatsWindowId) {
          sendMessage(playerStatsWindowId, {
            type:  'player-stats-update',
            game:  data,
            ranks: { ...playerRankCache },
            opgg:  { ...playerOpggCache },
          })
        }
        if (lcuPlatform) fetchMissingRanks(data.allPlayers ?? [])

        // Arena (CHERRY) mode — augment overlay
        if (data.gameData?.gameMode === 'CHERRY') {
          const localName   = data.activePlayer?.summonerName
          const localPlayer = (data.allPlayers || []).find(p => p.summonerName === localName)
          const myChamp     = localPlayer?.championName || null
          const augments    = data.activePlayer?.augments || []
          const augCount    = augments.length

          if (!arenaAugRef.current) {
            isArenaMode = true; prevAugmentCount = augCount; arenaRound = 0
            showArenaAugWindow(myChamp, augCount, arenaRound)
            if (myChamp) fetchAugmentAITip(myChamp, augments)
          } else if (augCount !== prevAugmentCount) {
            prevAugmentCount = augCount
            sendMessage(arenaAugRef.current, { type: 'aug-update', champName: myChamp, augCount, round: arenaRound })
            if (myChamp) fetchAugmentAITip(myChamp, augments)
          }
        }

        if (!aiCallInProgress && Math.random() < 0.2) sendToAI(data)
      }
    )
  }

  poll()   // fetch immediately — don't wait 2s for first data
  pollingInterval = setInterval(poll, 2000)
}

function stopPortPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
}

// Fetch OP.GG rank for players not yet in cache — fire-and-forget, results arrive async
const rankFetchInFlight = new Set()
async function fetchMissingRanks(players) {
  if (!lcuPlatform) return
  for (const p of players) {
    const name = p.summonerName
    if (!name || playerRankCache[name] || rankFetchInFlight.has(name)) continue
    // LCDA newer format: "GameName#TAG" — split on #
    if (!name.includes('#')) continue
    const [gameName, tagLine] = name.split('#')
    rankFetchInFlight.add(name)
    fetch(BACKEND_URL + '/api/opgg/summoner?game_name=' + encodeURIComponent(gameName)
      + '&tag_line=' + encodeURIComponent(tagLine)
      + '&region=' + encodeURIComponent(lcuPlatform))
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        if (body?.ok && body.rank) {
          playerRankCache[name] = body.rank
          log('Rank fetched:', name, body.rank.tier, body.rank.division)
          if (inGameWindowId)      sendMessage(inGameWindowId,      { type: 'rank-update',         ranks: playerRankCache })
          if (playerStatsWindowId) sendMessage(playerStatsWindowId, { type: 'player-stats-update', ranks: { ...playerRankCache } })
        }
      })
      .catch(() => {})
      .finally(() => rankFetchInFlight.delete(name))
  }
}

// ── AI Backend ─────────────────────────────────────────────────────────────

async function sendToAI(gameState) {
  const now = Date.now()
  if (!gameState || aiCallInProgress || (now - lastAiCallTime) < AI_COOLDOWN_MS) return
  aiCallInProgress = true
  lastAiCallTime = now
  try {
    sendMessage(inGameWindowId, { type: 'ai-loading' })
    const payload = {
      liveGame: {
        gameId:       'live',
        gameLength:   Math.floor(gameState.gameData?.gameTime ?? 0),
        // Map LCDA team names → numeric teamId that the route expects
        participants: (gameState.allPlayers ?? []).map(p => ({
          summonerName: p.summonerName,
          championName: p.championName,
          teamId:       p.team === 'ORDER' ? 100 : 200,
          kills:        p.scores?.kills     ?? 0,
          deaths:       p.scores?.deaths    ?? 0,
          assists:      p.scores?.assists   ?? 0,
          cs:           p.scores?.creepScore ?? 0,
        })),
        gameMode:     gameState.gameData?.gameMode,
      },
      playerRiotId: gameState.activePlayer?.summonerName ?? 'Unknown',
    }
    const res = await fetch(BACKEND_URL + '/api/ai-live-coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) {
      const body = await res.json()
      if (body.advice) sendMessage(inGameWindowId, { type: 'ai-advice', advice: body.advice })
      else if (body.unavailable) lastAiCallTime = Date.now() + 5 * 60_000 // back off 5 min on AI outage
    } else {
      lastAiCallTime = Date.now() + 5 * 60_000 // back off on server error too
    }
  } catch (err) { log('AI error:', err?.message) }
  finally { aiCallInProgress = false }
}

// ── AI Augment Tip ─────────────────────────────────────────────────────────

let augTipInProgress = false
let lastAugTipTime   = 0
const AUG_TIP_COOLDOWN = 120_000   // 2 min between augment AI calls

async function fetchAugmentAITip(champName, augments) {
  const now = Date.now()
  if (augTipInProgress || (now - lastAugTipTime) < AUG_TIP_COOLDOWN) return
  augTipInProgress = true; lastAugTipTime = now
  try {
    const res = await fetch(BACKEND_URL + '/api/ai-augment-tip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        champion: champName,
        currentAugments: augments.map(a => a.displayName || a.name || String(a)),
      }),
    })
    if (res.ok) {
      const body = await res.json()
      if (body.tip && arenaAugRef.current) sendMessage(arenaAugRef.current, { type: 'aug-ai-tip', tip: body.tip })
    }
  } catch (err) { log('Augment tip AI error:', err?.message) }
  finally { augTipInProgress = false }
}

// ── Init ──────────────────────────────────────────────────────────────────

function init() {
  log('Background started — LOL_GAME_ID:', LOL_GAME_ID)

  // Open the home window as the main UI (start_window is "background", so we open it manually)
  showHome()

  try { setupGameListeners() } catch (e) { log('setupGameListeners error:', e?.message) }
  try { startLcuPolling()    } catch (e) { log('startLcuPolling error:',    e?.message) }

  // GEP for in-game overlay (5426) — game detection
  try {
    overwolf.games.onGameInfoUpdated.addListener(e => {
      try {
        const info = e?.gameInfo
        if (!info?.isRunning) {
          if (isGameRunning) {
            log('LoL Game exited')
            isGameRunning = false
            clearTimeout(gameGepTimer); gameGepTimer = null
            stopPortPolling(); hideOverlay()
          }
          return
        }
        if (info.classId === LOL_GAME_ID && !isGameRunning) {
          registerLockfileFromExe(info.executionPath)
          log('LoL Game detected — GEP in 3s')
          isGameRunning = true
          clearTimeout(gameGepTimer)
          setTimeout(() => registerGameFeatures(0), 3000)
        }
      } catch (e) { log('onGameInfoUpdated handler error:', e?.message) }
    })
  } catch (e) { log('onGameInfoUpdated unavailable:', e?.message) }

  // Game already running on startup
  try {
    overwolf.games.getRunningGameInfo(result => {
      if (!result?.isRunning || result.classId !== LOL_GAME_ID) return
      registerLockfileFromExe(result.executionPath)
      log('LoL Game already running on startup')
      isGameRunning = true
      setTimeout(() => registerGameFeatures(0), 3000)
    })
  } catch (e) { log('getRunningGameInfo error:', e?.message) }

  // Hotkeys
  try {
    overwolf.settings.hotkeys.onPressed.addListener(event => {
      if (event.name === 'toggle_app') {
        if (inGameWindowId) hideOverlay()
        else if (gamePhase === 'InProgress') showOverlay()
      }
      if (event.name === 'toggle_scoreboard') {
        if (playerStatsWindowId) hidePlayerStats()
        else if (gamePhase === 'InProgress') showPlayerStats()
      }
    })
  } catch (e) { log('hotkeys unavailable:', e?.message) }

  // Re-open home window when user clicks the dock icon or launches the app again
  try {
    overwolf.extensions.onAppLaunchTriggered.addListener(() => {
      log('App re-launch triggered — opening home window')
      showHome()
    })
  } catch (e) { log('onAppLaunchTriggered unavailable:', e?.message) }
}

init()
