/* ── ATAK Overwolf In-Game Overlay ─────────────────────────────────────────── */

const POS = { TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'BOT', UTILITY: 'SUP' }

let myTeam = 'ORDER'
let myName = null

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id)

// ── State transitions ─────────────────────────────────────────────────────────

function showLive() {
  $('waiting-screen').style.display = 'none'
  $('live-hud').style.display = 'flex'
  $('live-dot').classList.add('active')
  $('status-text').textContent = 'LIVE'
  $('status-text').classList.add('live')
}

function showWaiting() {
  $('waiting-screen').style.display = 'flex'
  $('live-hud').style.display = 'none'
  $('live-dot').classList.remove('active')
  $('status-text').textContent = 'STANDBY'
  $('status-text').classList.remove('live')
}

// ── Game data rendering ───────────────────────────────────────────────────────

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function renderGameData(data) {
  if (!data) return

  const gameTime = data.gameData?.gameTime ?? 0
  const gold     = Math.floor(data.activePlayer?.currentGold ?? 0)
  const cs       = data.activePlayer?.scores?.creepScore ?? 0
  const kills    = data.activePlayer?.scores?.kills ?? 0
  const deaths   = data.activePlayer?.scores?.deaths ?? 0
  const assists  = data.activePlayer?.scores?.assists ?? 0
  const level    = data.activePlayer?.level ?? 1
  const csPerMin = gameTime > 60 ? (cs / (gameTime / 60)).toFixed(1) : '—'
  const kda      = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)

  $('game-timer').textContent = fmtTime(gameTime)
  $('game-mode').textContent  = data.gameData?.gameMode ?? 'CLASSIC'
  $('gold-value').innerHTML   = `${gold.toLocaleString()}<span style="font-size:9px;color:#6b7280;margin-left:2px;">g</span>`

  $('stat-kills').textContent   = kills
  $('stat-deaths').textContent  = deaths
  $('stat-assists').textContent = assists
  $('stat-kda').textContent     = kda
  $('stat-cs').textContent      = cs
  $('stat-cspm').textContent    = `${csPerMin} CS/m`
  $('stat-level').textContent   = `LV${level}`

  const summoner = data.activePlayer?.summonerName
  if (summoner) {
    myName = summoner
    $('summoner-name').textContent = summoner
  }

  const allPlayers = data.allPlayers ?? []
  const myEntry    = allPlayers.find(p => p.summonerName === myName)
  if (myEntry) {
    myTeam = myEntry.team ?? 'ORDER'
    $('champ-name').textContent = myEntry.championName ?? '—'
  }

  const allies  = allPlayers.filter(p => p.team === myTeam)
  const enemies = allPlayers.filter(p => p.team !== myTeam)

  $('ally-label').textContent  = myTeam === 'ORDER' ? '◈ ORDER' : '◈ CHAOS'
  $('enemy-label').textContent = myTeam === 'ORDER' ? '◈ CHAOS' : '◈ ORDER'

  renderTeam($('ally-list'),  allies,  false)
  renderTeam($('enemy-list'), enemies, true)
}

function renderTeam(container, players, isEnemies) {
  container.innerHTML = ''
  if (!players.length) {
    container.innerHTML = '<div style="font-size:9px;color:#374151;padding:4px 8px;font-style:italic;">Waiting...</div>'
    return
  }
  players.forEach(p => {
    const isMe  = p.summonerName === myName
    const cls   = isMe ? 'player-row me' : isEnemies ? 'player-row enemy' : 'player-row ally'
    const dead  = p.isDead ? ' dead' : ''
    const pos   = POS[p.position] ?? p.position ?? ''
    const k     = p.scores?.kills ?? 0
    const d     = p.scores?.deaths ?? 0
    const a     = p.scores?.assists ?? 0

    const row = document.createElement('div')
    row.className = cls + dead
    row.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div class="player-champ">${p.championName ?? '—'}</div>
        <div class="player-pos">${isMe ? '▸ YOU' : pos}</div>
      </div>
      <div class="player-kda">
        <span style="color:#4ade80">${k}</span><span style="color:#374151">/</span><span style="color:#f87171">${d}</span><span style="color:#374151">/</span><span style="color:#60a5fa">${a}</span>
      </div>
    `
    container.appendChild(row)
  })
}

// ── AI advice ─────────────────────────────────────────────────────────────────

function renderAdvice(text) {
  const el = $('ai-advice')
  el.classList.remove('loading', 'ai-shimmer')
  el.textContent = text
}

function showAdviceLoading() {
  const el = $('ai-advice')
  el.className = 'loading ai-shimmer'
  el.textContent = 'Analyzing game state...'
}

// ── Window controls ───────────────────────────────────────────────────────────

function closeOverlay() {
  if (typeof overwolf !== 'undefined') {
    overwolf.windows.getCurrentWindow(result => {
      if (result.status === 'success') {
        overwolf.windows.close(result.window.id)
      }
    })
  }
}

// ── Overwolf message listener ─────────────────────────────────────────────────

if (typeof overwolf !== 'undefined' && overwolf.windows) {
  overwolf.windows.onMessageReceived.addListener(function (message) {
    if (!message?.content) return

    const content = message.content

    if (content.type === 'game-started') {
      showLive()
    }

    if (content.type === 'game-ended') {
      showWaiting()
    }

    if (content.type === 'game-data' && content.data) {
      showLive()
      renderGameData(content.data)
    }

    if (content.type === 'ai-advice' && content.advice) {
      renderAdvice(content.advice)
    }

    if (content.type === 'ai-loading') {
      showAdviceLoading()
    }

    // Legacy: raw advice string
    if (typeof content.advice === 'string') {
      renderAdvice(content.advice)
    }
  })
}

// ── Dev / standalone mode ─────────────────────────────────────────────────────

if (typeof overwolf === 'undefined') {
  // Allows testing in a regular browser without Overwolf
  console.log('[ATAK] Running outside Overwolf — showing mock data')
  setTimeout(() => {
    showLive()
    renderGameData({
      gameData: { gameTime: 845, gameMode: 'CLASSIC' },
      activePlayer: {
        summonerName: 'TestPlayer',
        currentGold: 1842,
        level: 12,
        scores: { kills: 5, deaths: 1, assists: 3, creepScore: 87, wardScore: 12 }
      },
      allPlayers: [
        { championName: 'Jinx',     summonerName: 'TestPlayer', team: 'ORDER', position: 'BOTTOM',  scores: { kills:5, deaths:1, assists:3 }, isDead: false },
        { championName: 'Thresh',   summonerName: 'Ally1',      team: 'ORDER', position: 'UTILITY', scores: { kills:0, deaths:2, assists:7 }, isDead: false },
        { championName: 'Azir',     summonerName: 'Ally2',      team: 'ORDER', position: 'MIDDLE',  scores: { kills:7, deaths:2, assists:2 }, isDead: false },
        { championName: 'Garen',    summonerName: 'Ally3',      team: 'ORDER', position: 'TOP',     scores: { kills:2, deaths:3, assists:1 }, isDead: false },
        { championName: 'Vi',       summonerName: 'Ally4',      team: 'ORDER', position: 'JUNGLE',  scores: { kills:3, deaths:1, assists:5 }, isDead: false },
        { championName: 'Caitlyn',  summonerName: 'Enemy1',     team: 'CHAOS', position: 'BOTTOM',  scores: { kills:2, deaths:4, assists:1 }, isDead: false },
        { championName: 'Nautilus', summonerName: 'Enemy2',     team: 'CHAOS', position: 'UTILITY', scores: { kills:1, deaths:1, assists:4 }, isDead: true  },
        { championName: 'Viktor',   summonerName: 'Enemy3',     team: 'CHAOS', position: 'MIDDLE',  scores: { kills:4, deaths:3, assists:5 }, isDead: false },
        { championName: 'Darius',   summonerName: 'Enemy4',     team: 'CHAOS', position: 'TOP',     scores: { kills:3, deaths:2, assists:0 }, isDead: false },
        { championName: 'Draven',   summonerName: 'Enemy5',     team: 'CHAOS', position: 'JUNGLE',  scores: { kills:5, deaths:0, assists:3 }, isDead: false },
      ]
    })
    renderAdvice('Push bot lane — their ADC is backing. Ward river before Baron spawns and look for a pick onto Nautilus when he peels forward.')
  }, 600)
}
