/* ── ATAK In-Game Overlay ──────────────────────────────────────────────── */
let myTeam  = 'ORDER'
let myName  = null
let ddPatch = null
let isLive  = false

const $ = id => document.getElementById(id)
const POS = {TOP:'TOP',JUNGLE:'JGL',MIDDLE:'MID',BOTTOM:'BOT',UTILITY:'SUP'}

// ── GSAP helpers ────────────────────────────────────────────────────────────
function gsapNum(el, toVal, decimals = 0, suffix = '') {
  if (!window.gsap || !el) return
  const cur = parseFloat(el.dataset.gsapVal ?? '0')
  if (Math.abs(cur - toVal) < .01) return
  el.dataset.gsapVal = toVal
  const proxy = { val: cur }
  gsap.to(proxy, {
    val: toVal, duration: .55, ease: 'power2.out',
    onUpdate() {
      el.textContent = decimals
        ? proxy.val.toFixed(decimals) + suffix
        : Math.round(proxy.val) + suffix
    }
  })
}
function gsapBar(el, pct) {
  if (!window.gsap || !el) return
  gsap.to(el, { scaleX: Math.min(1, Math.max(0, pct / 100)), duration: .7, ease: 'power2.out', transformOrigin: 'left center' })
}
function gsapEntrance() {
  if (!window.gsap) return
  const els = ['#player-card','#kda-card','#pill-row','#mini-stats','#ai-card','#teams-card']
  gsap.fromTo(els,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: .4, stagger: .06, ease: 'power2.out', clearProps: 'transform' }
  )
}
function animateLiveDot() {
  if (!window.gsap) return
  gsap.to('#live-dot', { opacity: 0, duration: .7, repeat: -1, yoyo: true, ease: 'power1.inOut' })
}

async function getPatch() {
  if (ddPatch) return ddPatch
  try { const r = await fetch('https://ddragon.leagueoflegends.com/api/versions.json'); ddPatch = (await r.json())[0] }
  catch { ddPatch = '15.1.1' }
  return ddPatch
}
// DDragon key overrides: LCDA display name → DDragon file key
const DD_KEY = { 'Wukong': 'MonkeyKing', 'Nunu & Willump': 'Nunu', 'Renata Glasc': 'Renata' }
function cUrl(name, patch) {
  if (!name || !patch) return ''
  const key = (DD_KEY[name] || name).replace(/['\s.&]/g, '')
  return `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${key}.png`
}
function fmtTime(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` }
function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + 'k' : String(Math.round(g)) }

// ── State transitions ────────────────────────────────────────────────────────
function showLive() {
  if (isLive) return
  isLive = true
  $('waiting').style.display = 'none'
  $('live').style.display    = 'flex'
  $('live-pill').classList.add('on')
  animateLiveDot()
  gsapEntrance()
}
function showWaiting() {
  isLive = false
  $('waiting').style.display = 'flex'
  $('live').style.display    = 'none'
  $('live-pill').classList.remove('on')
  myName = null
}

// ── Team gold estimate (CS + kills + assists as gold proxy) ─────────────────
function teamGoldEst(players) {
  return players.reduce((acc, p) => {
    const cs  = p.scores?.creepScore  ?? 0
    const k   = p.scores?.kills       ?? 0
    const a   = p.scores?.assists     ?? 0
    return acc + cs * 21 + k * 300 + a * 150
  }, 0)
}

// ── Main render ─────────────────────────────────────────────────────────────
async function renderGame(data) {
  showLive()
  const patch = await getPatch()
  const gameMode = (data.gameData?.gameMode ?? '').toUpperCase()
  const isArena  = gameMode === 'CHERRY'
  const isAram   = gameMode === 'ARAM'

  // ── Timers ──
  const t = Math.floor(data.gameData?.gameTime ?? 0)
  $('game-time').textContent = fmtTime(t)

  // ── Active player core stats ──
  const ap   = data.activePlayer
  const cs   = ap?.scores?.creepScore  ?? 0
  const k    = ap?.scores?.kills       ?? 0
  const d    = ap?.scores?.deaths      ?? 0
  const a    = ap?.scores?.assists     ?? 0
  const ward = ap?.scores?.wardScore   ?? 0
  const gold = Math.floor(ap?.currentGold ?? 0)
  const lv   = ap?.level               ?? 1
  const kda  = d === 0 ? '∞' : ((k + a) / d).toFixed(2)
  const cspm = t > 60 ? (cs / (t / 60)).toFixed(1) : '—'

  // ── Champion stats ──
  const cs2  = ap?.championStats ?? {}
  const hp      = Math.round(cs2.currentHealth      ?? 0)
  const hpMax   = Math.round(cs2.maxHealth          ?? 1)
  const mp      = Math.round(cs2.resourceValue      ?? 0)
  const mpMax   = Math.round(cs2.resourceMax        ?? 1)
  const mpType  = (cs2.resourceType ?? 'MANA').toUpperCase()
  const adVal   = Math.round(cs2.attackDamage       ?? 0)
  const apVal   = Math.round(cs2.abilityPower       ?? 0)
  const arVal   = Math.round(cs2.armor              ?? 0)
  const mrVal   = Math.round(cs2.magicResist        ?? 0)
  const msVal   = Math.round(cs2.moveSpeed          ?? 0)
  const critVal = Math.round((cs2.critChance        ?? 0) * 100)

  // ── Summoner / champion ──
  const sn = ap?.summonerName
  if (sn) { myName = sn; $('summoner-live').textContent = sn }
  $('lv-badge').textContent = `LV ${lv}`

  const all  = data.allPlayers ?? []
  // Robust match: exact → case-insensitive → first player (fallback)
  const mine = all.find(p => p.summonerName === myName)
           || all.find(p => p.summonerName?.toLowerCase() === myName?.toLowerCase())
           || all[0]
  if (mine) {
    myTeam = mine.team ?? 'ORDER'
    const cn = mine.championName ?? '—'
    $('champ-name-live').textContent = cn
    const icon = $('champ-portrait')
    icon.src = cUrl(cn, patch)
    icon.style.opacity = '1'
  }

  // ── Animate KDA ──
  gsapNum($('st-k'),   k)
  gsapNum($('st-d'),   d)
  gsapNum($('st-a'),   a)
  $('st-kda').textContent = kda

  // ── Gold ──
  gsapNum($('gold-val'), gold, 0, 'g')

  // ── CS / stats pills (Arena hides CS, shows kills) ──
  if (isArena) {
    $('cs-val').textContent     = `${k} Kills`
    $('cs-pm').textContent      = `${a} Assists`
    $('cs-pill-v').textContent  = `${k}/${d}/${a}`
    $('cs-pill-pm').textContent = 'KDA'
  } else {
    $('cs-val').textContent     = `${cs} CS`
    $('cs-pm').textContent      = `${cspm} /min`
    $('cs-pill-v').textContent  = `${cs} CS`
    $('cs-pill-pm').textContent = `${cspm} /min`
  }
  gsapNum($('ward-val'), ward)

  // ── HP/MP bars ──
  gsapBar($('hp-fill'), hpMax > 0 ? (hp / hpMax) * 100 : 0)
  $('hp-txt').textContent = `${hp.toLocaleString()} / ${hpMax.toLocaleString()} HP`

  const mpLabel = mpType === 'NONE' ? '' : mpType === 'MANA' ? 'MP' : mpType.slice(0, 2)
  if (mpMax > 0) {
    gsapBar($('mp-fill'), (mp / mpMax) * 100)
    $('mp-txt').textContent = `${mp} / ${mpMax} ${mpLabel}`
    const colors = { MANA:'#1d4ed8,#60a5fa', ENERGY:'#ca8a04,#facc15', FURY:'#dc2626,#f87171', NONE:'transparent,transparent' }
    const col = colors[mpType] ?? colors.MANA
    $('mp-fill').style.background = `linear-gradient(90deg,${col})`
  } else {
    $('mp-fill').style.transform = 'scaleX(0)'
    $('mp-txt').textContent = ''
  }

  // ── Champion stats row ──
  $('ms-ad').textContent = adVal
  $('ms-ap').textContent = apVal
  $('ms-ar').textContent = arVal
  $('ms-mr').textContent = mrVal
  $('ms-ms').textContent = msVal
  $('ms-cr').textContent = critVal + '%'

  // ── Teams ──
  const allies  = all.filter(p => p.team === myTeam)
  const enemies = all.filter(p => p.team !== myTeam)

  if (isArena) {
    // Arena: label teams as ALLIES / OPPONENTS, hide gold diff
    $('ally-lbl').textContent  = 'ALLIES'
    $('enemy-lbl').textContent = 'OPPONENTS'
    const gdPill = $('gold-diff-pill')
    gdPill.style.display = 'none'
    renderTeam($('ally-list'),  allies,  false, patch)
    renderTeam($('enemy-list'), enemies, true,  patch)
  } else {
    $('gold-diff-pill').style.display = ''
    $('ally-lbl').textContent  = myTeam === 'ORDER' ? 'ORDER' : 'CHAOS'
    $('enemy-lbl').textContent = myTeam === 'ORDER' ? 'CHAOS' : 'ORDER'
    renderTeam($('ally-list'),  allies,  false, patch)
    renderTeam($('enemy-list'), enemies, true,  patch)

    // ── Team gold difference ──
    if (allies.length && enemies.length) {
      const allyG  = teamGoldEst(allies)
      const enemyG = teamGoldEst(enemies)
      const diff   = allyG - enemyG
      const pill   = $('gold-diff-pill')
      const el     = $('gold-diff-val')
      if (diff > 0) {
        el.textContent = `+${fmtGold(Math.abs(diff))}`
        pill.className = 'pill goldlead'
        $('gold-diff-lbl').textContent = 'GOLD LEAD'
      } else if (diff < 0) {
        el.textContent = `-${fmtGold(Math.abs(diff))}`
        pill.className = 'pill goldlead deficit'
        $('gold-diff-lbl').textContent = 'GOLD DEF'
      } else {
        el.textContent = '±0'
        pill.className = 'pill goldlead'
        $('gold-diff-lbl').textContent = 'TEAM GOLD'
      }
    }
  }
}

// ── Team list render ─────────────────────────────────────────────────────────
function renderTeam(container, players, isEnemy, patch) {
  if (!players.length) {
    container.innerHTML = '<div style="font-size:8px;color:rgba(255,255,255,.12);padding:4px;font-style:italic">Waiting...</div>'
    return
  }
  const newKey = players.map(p => `${p.summonerName}${p.scores?.kills}${p.scores?.deaths}${p.scores?.assists}${p.isDead}`).join()
  if (container.dataset.k === newKey) return
  container.dataset.k = newKey
  container.innerHTML = ''

  players.forEach(p => {
    const isMe = p.summonerName === myName
    const cls  = isMe ? 'me' : isEnemy ? 'enemy' : 'ally'
    const k    = p.scores?.kills       ?? 0
    const d    = p.scores?.deaths      ?? 0
    const a    = p.scores?.assists     ?? 0
    const cs   = p.scores?.creepScore  ?? 0
    const lv   = p.level               ?? 1
    const pos  = POS[p.position] ?? (p.position ?? '').slice(0, 3).toUpperCase()
    const dead = p.isDead ?? false
    const resp = Math.ceil(p.respawnTimer ?? 0)

    const row = document.createElement('div')
    row.className = `prow ${cls}${dead ? ' dead' : ''}`

    const img = document.createElement('img')
    img.className = 'prow-icon'
    img.src = cUrl(p.championName, patch)
    img.onerror = () => { img.style.opacity = '.08' }
    row.appendChild(img)

    const left = document.createElement('div')
    left.className = 'prow-left'
    const subParts = []
    if (isMe) subParts.push('<span style="color:var(--gold);font-weight:700">YOU</span>')
    if (pos)  subParts.push(pos)
    subParts.push(`Lv${lv}`)
    if (dead && resp > 0) subParts.push(`<span class="prow-dead">💀 ${resp}s</span>`)
    left.innerHTML = `<div class="prow-cname">${p.championName ?? '—'}</div><div class="prow-sub">${subParts.join(' · ')}</div>`
    row.appendChild(left)

    const kdaEl = document.createElement('div')
    kdaEl.className = 'prow-kda'
    kdaEl.innerHTML = `<span><span class="kk">${k}</span><span style="opacity:.3">/</span><span class="dd">${d}</span><span style="opacity:.3">/</span><span class="aa">${a}</span></span><span class="cs-s">${cs}cs</span>`
    row.appendChild(kdaEl)

    container.appendChild(row)
  })

  if (window.gsap) {
    gsap.from(container.children, { opacity: 0, x: isEnemy ? 8 : -8, duration: .3, stagger: .04, ease: 'power2.out' })
  }
}

// ── AI ───────────────────────────────────────────────────────────────────────
function showAdvice(text) {
  const el = $('ai-text')
  el.className = ''
  if (window.gsap) {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .4, ease: 'power2.out' })
  }
  el.textContent = text
}
function showAdviceLoading() {
  $('ai-text').className = 'loading'
  $('ai-text').textContent = 'Analyzing game state...'
}

// ── Controls ──────────────────────────────────────────────────────────────────
function closeMe() {
  if (typeof overwolf !== 'undefined')
    overwolf.windows.getCurrentWindow(r => { if (r.status === 'success') overwolf.windows.close(r.window.id) })
}

// ── Messages ──────────────────────────────────────────────────────────────────
if (typeof overwolf !== 'undefined' && overwolf.windows) {
  overwolf.windows.onMessageReceived.addListener(msg => {
    const c = msg?.content
    if (!c) return
    if (c.type === 'game-started') showLive()
    if (c.type === 'game-ended')   showWaiting()
    if (c.type === 'game-data')    renderGame(c.data)
    if (c.type === 'ai-advice')    showAdvice(c.advice)
    if (c.type === 'ai-loading')   showAdviceLoading()
    if (typeof c.advice === 'string') showAdvice(c.advice)
  })
}

// ── Dev mode ──────────────────────────────────────────────────────────────────
if (typeof overwolf === 'undefined') {
  setTimeout(() => renderGame({
    gameData: { gameTime: 1142, gameMode: 'CLASSIC' },
    activePlayer: {
      summonerName: 'TestSummoner',
      currentGold: 2350,
      level: 13,
      scores: { kills: 6, deaths: 2, assists: 4, creepScore: 112, wardScore: 28 },
      championStats: {
        currentHealth: 1240, maxHealth: 1580,
        resourceValue: 420,  resourceMax: 650, resourceType: 'MANA',
        attackDamage: 187, abilityPower: 0, armor: 65, magicResist: 38,
        moveSpeed: 345, critChance: .2
      }
    },
    allPlayers: [
      { championName:'Jinx',     summonerName:'TestSummoner', team:'ORDER', position:'BOTTOM',  level:13, isDead:false, respawnTimer:0, scores:{kills:6,deaths:2,assists:4,creepScore:112,wardScore:28} },
      { championName:'Thresh',   summonerName:'Ally1',        team:'ORDER', position:'UTILITY', level:11, isDead:false, respawnTimer:0, scores:{kills:0,deaths:3,assists:9,creepScore:44,wardScore:52}  },
      { championName:'Azir',     summonerName:'Ally2',        team:'ORDER', position:'MIDDLE',  level:12, isDead:false, respawnTimer:0, scores:{kills:8,deaths:2,assists:3,creepScore:89,wardScore:18}  },
      { championName:'Garen',    summonerName:'Ally3',        team:'ORDER', position:'TOP',     level:11, isDead:false, respawnTimer:0, scores:{kills:2,deaths:4,assists:2,creepScore:67,wardScore:9}   },
      { championName:'Vi',       summonerName:'Ally4',        team:'ORDER', position:'JUNGLE',  level:12, isDead:true,  respawnTimer:8,  scores:{kills:4,deaths:1,assists:6,creepScore:78,wardScore:22}  },
      { championName:'Caitlyn',  summonerName:'Enemy1',       team:'CHAOS', position:'BOTTOM',  level:13, isDead:false, respawnTimer:0, scores:{kills:3,deaths:5,assists:1,creepScore:95,wardScore:14}  },
      { championName:'Nautilus', summonerName:'Enemy2',       team:'CHAOS', position:'UTILITY', level:10, isDead:false, respawnTimer:0, scores:{kills:1,deaths:2,assists:5,creepScore:22,wardScore:38}  },
      { championName:'Viktor',   summonerName:'Enemy3',       team:'CHAOS', position:'MIDDLE',  level:12, isDead:false, respawnTimer:0, scores:{kills:5,deaths:3,assists:4,creepScore:102,wardScore:11} },
      { championName:'Darius',   summonerName:'Enemy4',       team:'CHAOS', position:'TOP',     level:13, isDead:false, respawnTimer:0, scores:{kills:4,deaths:2,assists:1,creepScore:81,wardScore:7}   },
      { championName:'Khazix',   summonerName:'Enemy5',       team:'CHAOS', position:'JUNGLE',  level:13, isDead:true,  respawnTimer:4,  scores:{kills:6,deaths:1,assists:4,creepScore:88,wardScore:19}  },
    ]
  }), 300)
  setTimeout(() => showAdvice('Jinx is free-farming — push wave and take outer plate before 14:30. Ward river tribush before recalling. Darius 4/2 is a threat if he hits E on you; respect range.'), 1100)
}
