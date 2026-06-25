import { useEffect, useState, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerScore {
  assists: number; creepScore: number; deaths: number; kills: number; wardScore: number
}
interface GameItem { displayName: string; itemID: number; slot: number }
interface GamePlayer {
  championName: string; isBot: boolean; isDead: boolean; level: number
  position: string; summonerName: string; team: 'ORDER' | 'CHAOS'
  scores: PlayerScore; respawnTimer: number; items?: GameItem[]
}
interface LiveGameData {
  gameData?: { gameTime?: number; gameMode?: string }
  activePlayer?: {
    summonerName?: string; currentGold?: number; level?: number
    scores?: PlayerScore
  }
  allPlayers?: GamePlayer[]
}

declare global {
  interface Window {
    electronAPI?: {
      onGameStarted:        (cb: () => void) => void
      onGameEnded:          (cb: () => void) => void
      onLeagueDetected:     (cb: () => void) => void
      onLiveGameData:       (cb: (data: LiveGameData) => void) => void
      onAIAdvice:           (cb: (advice: string) => void) => void
      requestAIAdvice:      (data: any) => Promise<any>
      windowMinimize:       () => void
      windowClose:          () => void
      toggleAlwaysOnTop:    () => void
      onAlwaysOnTopChanged: (cb: (isOnTop: boolean) => void) => void
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
const POS: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'BOT', UTILITY: 'SUP',
}
const REGIONS = ['la1','la2','na1','euw1','eun1','kr','jp1','br1','oc1','tr1','ru']

const champIcon = (name: string) => {
  if (!name) return ''
  const clean = name.replace(/\s/g, '').replace(/'/g, '').replace(/\./g, '')
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${clean}.png`
}
const itemIcon = (id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${id}.png`

// Katarina-style dagger — ATAK brand mark.
const Dagger = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden="true">
    <path d="M12 1.2l1.85 12.4-1.85 2.5-1.85-2.5L12 1.2z" />
    <path d="M7.3 14.0h9.4v1.6H7.3z" />
    <path d="M11.05 15.8h1.9v4.9l-.95 1.1-.95-1.1z" />
  </svg>
)

// Loading screen — dancing Katarina + orbiting daggers (dev-portal vibe).
// Swap KATA_SRC for a dancing-Katarina .gif when available.
const KATA_SRC = 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Katarina_0.jpg'
function Loader({ hidden }: { hidden: boolean }) {
  return (
    <div id="akl" className={hidden ? 'hide' : ''}>
      <div className="akl-stage">
        <img className="akl-kata" src={KATA_SRC} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <div className="akl-ring">
          <div className="akl-d d1"><Dagger /></div>
          <div className="akl-d d2"><Dagger /></div>
          <div className="akl-d d3"><Dagger /></div>
        </div>
      </div>
      <div className="akl-word"><Dagger />atak</div>
      <div className="akl-sub">AI Companion</div>
      <div className="akl-bar"><i /></div>
    </div>
  )
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({ p, isMe }: { p: GamePlayer; isMe: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const kda = p.scores?.deaths === 0
    ? 'Perfect'
    : (((p.scores?.kills ?? 0) + (p.scores?.assists ?? 0)) / Math.max(p.scores?.deaths ?? 1, 1)).toFixed(1)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 6px', marginBottom: 2, borderRadius: 6,
      background: isMe ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'}`,
      opacity: p.isDead ? 0.32 : 1,
      transition: 'opacity 0.3s',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {!imgErr ? (
          <img src={champIcon(p.championName)} onError={() => setImgErr(true)}
            style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,0.08)' }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
            {p.championName.slice(0, 2).toUpperCase()}
          </div>
        )}
        {p.isDead && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 5, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#f87171', fontWeight: 700 }}>
            {p.respawnTimer > 0 ? `${p.respawnTimer}s` : '✕'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: isMe ? 700 : 500, color: isMe ? '#fff' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.championName}
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
          {isMe ? '▸ YOU' : (POS[p.position] ?? p.position ?? '—')} · Lv{p.level}
        </div>
      </div>

      <div style={{ fontFamily: 'monospace', fontSize: 9, textAlign: 'right', flexShrink: 0, lineHeight: 1.5 }}>
        <div>
          <span style={{ color: '#4ade80' }}>{p.scores?.kills ?? 0}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span style={{ color: '#f87171' }}>{p.scores?.deaths ?? 0}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span style={{ color: '#93c5fd' }}>{p.scores?.assists ?? 0}</span>
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>{kda}</div>
      </div>
    </div>
  )
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '2px 7px', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#fff', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 7, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

// ─── HeaderBtn ────────────────────────────────────────────────────────────────

function HeaderBtn({ onClick, title, danger, children }: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: h ? (danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)') : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}

// ─── NavBtn ───────────────────────────────────────────────────────────────────

function NavBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: h ? 'rgba(255,255,255,0.07)' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: h ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.15s', flexShrink: 0 }}>
      {children}
    </button>
  )
}

// ─── EmptyTeam ────────────────────────────────────────────────────────────────

function EmptyTeam() {
  return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', padding: '4px 6px', fontStyle: 'italic' }}>Waiting for data...</div>
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [isInGame,        setIsInGame]        = useState(false)
  const [leagueOpen,      setLeagueOpen]      = useState(false)
  const [gameData,        setGameData]        = useState<LiveGameData | null>(null)
  const [aiAdvice,        setAiAdvice]        = useState('Waiting for your match...')
  const [loadingAI,       setLoadingAI]       = useState(false)
  const [isAlwaysOnTop,   setIsAlwaysOnTop]   = useState(false)
  const [preferredRegion, setPreferredRegion] = useState('la1')
  const [embedUrl,        setEmbedUrl]        = useState('http://localhost:8080')
  const [lastPlayerName,  setLastPlayerName]  = useState<string | null>(null)
  const [champImgErr,     setChampImgErr]     = useState(false)
  const [regionOpen,      setRegionOpen]      = useState(false)
  const [loaderHidden,    setLoaderHidden]    = useState(false)
  const [showLoader,      setShowLoader]      = useState(true)

  useEffect(() => {
    const t1 = setTimeout(() => setLoaderHidden(true), 1900)
    const t2 = setTimeout(() => setShowLoader(false), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const webviewRef         = useRef<any>(null)
  const lastPlayerNameRef  = useRef<string | null>(null)
  const preferredRegionRef = useRef('la1')
  const regionDropRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { preferredRegionRef.current = preferredRegion }, [preferredRegion])

  const navigateTo = (url: string) => {
    setEmbedUrl(url)
    requestAnimationFrame(() => {
      const wv = webviewRef.current
      if (wv) { try { wv.src = url } catch {} }
    })
  }

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.onLeagueDetected?.(() => setLeagueOpen(true))
    api.onGameStarted(() => {
      setIsInGame(true); setLeagueOpen(true)
      setChampImgErr(false)
      setAiAdvice('Match detected — ATAK AI is analyzing...')
    })
    api.onGameEnded(() => {
      setIsInGame(false); setGameData(null)
      setAiAdvice('Watching for your match...')
      setTimeout(() => {
        const name = lastPlayerNameRef.current
        if (name) navigateTo(`http://localhost:8080/stats/${preferredRegionRef.current}/${encodeURIComponent(name)}`)
      }, 800)
    })
    api.onLiveGameData((data) => {
      setGameData(data)
      if (data.activePlayer?.summonerName) {
        lastPlayerNameRef.current = data.activePlayer.summonerName
        setLastPlayerName(data.activePlayer.summonerName)
      }
    })
    api.onAIAdvice((advice) => { setAiAdvice(advice); setLoadingAI(false) })
    api.onAlwaysOnTopChanged?.((v) => setIsAlwaysOnTop(v))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (regionDropRef.current && !regionDropRef.current.contains(e.target as Node))
        setRegionOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const requestAdvice = async () => {
    if (!gameData || !window.electronAPI) return
    setLoadingAI(true)
    await window.electronAPI.requestAIAdvice(gameData)
  }

  // Derived
  const gameTime   = gameData?.gameData?.gameTime ?? 0
  const gold       = Math.floor(gameData?.activePlayer?.currentGold ?? 0)
  const cs         = gameData?.activePlayer?.scores?.creepScore ?? 0
  const kills      = gameData?.activePlayer?.scores?.kills ?? 0
  const deaths     = gameData?.activePlayer?.scores?.deaths ?? 0
  const assists    = gameData?.activePlayer?.scores?.assists ?? 0
  const level      = gameData?.activePlayer?.level ?? 1
  const csPerMin   = gameTime > 60 ? (cs / (gameTime / 60)).toFixed(1) : '—'
  const kda        = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)
  const allPlayers = gameData?.allPlayers ?? []
  const myName     = gameData?.activePlayer?.summonerName
  const myEntry    = allPlayers.find(p => p.summonerName === myName)
  const myTeam     = myEntry?.team ?? 'ORDER'
  const allies     = allPlayers.filter(p => p.team === myTeam)
  const enemies    = allPlayers.filter(p => p.team !== myTeam)
  const myChamp    = myEntry?.championName ?? ''

  return (
    <div style={ROOT_STYLE}>
      <style>{CSS}</style>
      {showLoader && <Loader hidden={loaderHidden} />}

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header className="drag-region" style={HEADER_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Katarina dagger brand mark */}
          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg, rgba(226,59,78,.18), rgba(226,59,78,.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Dagger style={{ width: 13, height: 13, color: '#e23b4e' }} />
          </div>
          <span className="serif-i" style={{ fontSize: 21, color: '#fff', lineHeight: 1 }}>atak</span>
          <span style={{ fontSize: 7, fontWeight: 500, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.25)' }}>COMPANION</span>
        </div>

        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Status indicator */}
          {isInGame ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 6 }}>
              <div className="live-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.3em', color: '#f87171' }}>LIVE</span>
            </div>
          ) : leagueOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#facc15' }} />
              <span style={{ fontSize: 7, letterSpacing: '0.2em', color: '#fde047' }}>CLIENT</span>
            </div>
          ) : (
            <span style={{ fontSize: 7, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.18)', marginRight: 6 }}>STANDBY</span>
          )}

          {/* Pin */}
          <HeaderBtn onClick={() => window.electronAPI?.toggleAlwaysOnTop?.()} title={isAlwaysOnTop ? 'Unpin' : 'Pin on top'}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V9M6 1L3 4M6 1L9 4" stroke={isAlwaysOnTop ? '#fff' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </HeaderBtn>
          {/* Minimize */}
          <HeaderBtn onClick={() => window.electronAPI?.windowMinimize?.()}>
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
              <path d="M1 1H9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </HeaderBtn>
          {/* Close */}
          <HeaderBtn onClick={() => window.electronAPI?.windowClose?.()} danger>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </HeaderBtn>
        </div>
      </header>

      {/* ═══ MAIN ══════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {isInGame ? (

          /* ─── LIVE IN-GAME OVERLAY ─────────────────────────────────────── */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Time + gold bar */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.45)' }}>
              <div>
                <div className="serif-i" style={{ fontSize: 30, letterSpacing: '-0.5px', color: '#fff', lineHeight: 1 }}>
                  {fmtTime(gameTime)}
                </div>
                <div style={{ fontSize: 7, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.2)', marginTop: 3, textTransform: 'uppercase' }}>
                  {gameData?.gameData?.gameMode ?? 'CLASSIC'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
                  <span className="serif-i" style={{ fontSize: 20, color: '#fbbf24' }}>{gold.toLocaleString()}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>g</span>
                </div>
                <div style={{ fontSize: 7, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>Gold</div>
              </div>
            </div>

            {/* My champion card */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#060606' }}>
              {/* Champion icon */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {!champImgErr && myChamp ? (
                  <img src={champIcon(myChamp)} onError={() => setChampImgErr(true)}
                    style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)', display: 'block' }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
                    {myChamp?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: -4, right: -4, background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '0px 5px', fontSize: 8, fontWeight: 800, color: '#fff', lineHeight: 1.6 }}>
                  {level}
                </div>
              </div>

              {/* KDA */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 3, fontWeight: 500 }}>{myChamp}</div>
                <div className="serif-i" style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontSize: 20 }}>
                  <span style={{ color: '#4ade80' }}>{kills}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>/</span>
                  <span style={{ color: '#f87171' }}>{deaths}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>/</span>
                  <span style={{ color: '#93c5fd' }}>{assists}</span>
                </div>
              </div>

              {/* Stat chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <StatChip label="KDA" value={kda} />
                  <StatChip label="CS" value={cs} />
                </div>
                <StatChip label="CS/min" value={csPerMin} />
              </div>
            </div>

            {/* My items row */}
            {myEntry?.items && myEntry.items.filter(i => i.itemID > 0).length > 0 && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#040404' }}>
                <span style={{ fontSize: 7, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.18)', marginRight: 4, textTransform: 'uppercase' }}>Items</span>
                {myEntry.items.filter(i => i.itemID > 0).slice(0, 7).map((item, i) => (
                  <img key={i} src={itemIcon(item.itemID)}
                    style={{ width: 22, height: 22, borderRadius: 3, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.07)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ))}
              </div>
            )}

            {/* AI Coach */}
            <div className="lg" style={{ flexShrink: 0, margin: '7px 10px', borderRadius: 12, background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(16px) saturate(150%)', WebkitBackdropFilter: 'blur(16px) saturate(150%)', boxShadow: '0 8px 28px rgba(0,0,0,.38), inset 0 1px 1px rgba(255,255,255,.10)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Dagger style={{ width: 11, height: 11, color: '#e23b4e' }} />
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>ATAK AI</span>
                </div>
                <button onClick={requestAdvice} disabled={loadingAI} className="no-drag"
                  style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.15em', padding: '2px 8px', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', background: 'transparent', cursor: loadingAI ? 'default' : 'pointer', opacity: loadingAI ? 0.4 : 1, borderRadius: 4, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!loadingAI) { (e.currentTarget.style.background = 'rgba(255,255,255,0.07)'); (e.currentTarget.style.color = '#fff') } }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = 'rgba(255,255,255,0.45)') }}
                >
                  {loadingAI ? '···' : '↻ ANALYZE'}
                </button>
              </div>
              <div style={{ padding: '8px 10px', fontSize: 10, lineHeight: 1.65, color: loadingAI ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)', minHeight: 50, fontStyle: loadingAI ? 'italic' : 'normal', transition: 'color 0.3s' }}>
                {loadingAI ? 'Analyzing game state...' : aiAdvice}
              </div>
            </div>

            {/* Teams grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.28)', marginBottom: 5, paddingLeft: 2, textTransform: 'uppercase' }}>
                    ◈ {myTeam === 'ORDER' ? 'Blue' : 'Red'}
                  </div>
                  {allies.length > 0
                    ? allies.map((p, i) => <PlayerRow key={i} p={p} isMe={p.summonerName === myName} />)
                    : <EmptyTeam />}
                </div>
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.28)', marginBottom: 5, paddingLeft: 2, textTransform: 'uppercase' }}>
                    ◈ {myTeam === 'ORDER' ? 'Red' : 'Blue'}
                  </div>
                  {enemies.length > 0
                    ? enemies.map((p, i) => <PlayerRow key={i} p={p} isMe={false} />)
                    : <EmptyTeam />}
                </div>
              </div>
            </div>
          </div>

        ) : (

          /* ─── PRE-GAME / WAITING VIEW ──────────────────────────────────── */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Nav bar */}
            <div className="no-drag" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.55)' }}>
              <NavBtn onClick={() => navigateTo('http://localhost:8080')} title="Home">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M1 5.5L6 1L11 5.5V11H8V7.5H4V11H1V5.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                </svg>
              </NavBtn>
              <NavBtn onClick={() => { const wv = webviewRef.current; if (wv?.goBack) wv.goBack() }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </NavBtn>
              <NavBtn onClick={() => { const wv = webviewRef.current; if (wv?.goForward) wv.goForward() }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </NavBtn>
              <NavBtn onClick={() => { const wv = webviewRef.current; if (wv?.reload) wv.reload(); else navigateTo(embedUrl) }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M10 6A4 4 0 1 1 6 2M10 6V2M10 6H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </NavBtn>

              {/* URL display */}
              <div style={{ flex: 1, padding: '2px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 8, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.06)' }}>
                {embedUrl.replace('http://localhost:8080', 'atakgg')}
              </div>

              {lastPlayerName && (
                <button className="no-drag"
                  onClick={() => navigateTo(`http://localhost:8080/stats/${preferredRegion}/${encodeURIComponent(lastPlayerName)}`)}
                  style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.1)'); (e.currentTarget.style.color = '#fff') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.04)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.55)') }}
                >
                  MY STATS
                </button>
              )}

              {/* Region selector */}
              <div ref={regionDropRef} style={{ position: 'relative' }}>
                <button className="no-drag" onClick={() => setRegionOpen(v => !v)}
                  style={{ fontSize: 8, fontWeight: 700, padding: '3px 7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.08)'); (e.currentTarget.style.color = '#fff') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.04)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.5)') }}
                >
                  {preferredRegion.toUpperCase()} ▾
                </button>
                {regionOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.9)', minWidth: 72 }}>
                    {REGIONS.map(r => (
                      <button key={r} className="no-drag"
                        onClick={() => { setPreferredRegion(r); setRegionOpen(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', background: r === preferredRegion ? 'rgba(255,255,255,0.1)' : 'transparent', color: r === preferredRegion ? '#fff' : 'rgba(255,255,255,0.45)', border: 'none', transition: 'all 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.08)'); (e.currentTarget.style.color = '#fff') }}
                        onMouseLeave={e => { (e.currentTarget.style.background = r === preferredRegion ? 'rgba(255,255,255,0.1)' : 'transparent'); (e.currentTarget.style.color = r === preferredRegion ? '#fff' : 'rgba(255,255,255,0.45)') }}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Embedded ATAK web app */}
            <webview ref={webviewRef as any} src={embedUrl} allowpopups={true}
              style={{ flex: 1, width: '100%', border: 'none' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Static styles ────────────────────────────────────────────────────────────

const ROOT_STYLE: React.CSSProperties = {
  width: '100%', height: '100vh',
  // Frosted veil — the transparent Electron window shows the game faintly behind.
  background: 'linear-gradient(180deg, rgba(6,7,10,0.86), rgba(4,5,8,0.9))',
  backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
  color: '#f1f5f9',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: "'Barlow', system-ui, -apple-system, sans-serif",
  userSelect: 'none',
}

const HEADER_STYLE: React.CSSProperties = {
  height: 40, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  paddingLeft: 12, paddingRight: 6,
  background: 'rgba(0,0,0,0.82)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(12px)',
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { overflow: hidden; }

  ::-webkit-scrollbar       { width: 2px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 1px; }

  .drag-region { -webkit-app-region: drag; }
  .no-drag     { -webkit-app-region: no-drag; }

  webview { display: flex; width: 100%; height: 100%; border: none; }

  @keyframes pulse-dot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.7); }
    50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
  }
  .live-dot { animation: pulse-dot 1.8s ease-in-out infinite; }

  /* ── Liquid glass card ── */
  .lg { position: relative; overflow: hidden; }
  .lg::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px;
    background: linear-gradient(180deg,
      rgba(255,255,255,.45) 0%, rgba(255,255,255,.14) 20%,
      rgba(255,255,255,0) 42%, rgba(255,255,255,0) 58%,
      rgba(255,255,255,.14) 80%, rgba(255,255,255,.45) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
  }
  .serif-i { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; }

  /* ── Katarina loading screen ── */
  #akl { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    background: radial-gradient(ellipse 75% 60% at 50% 42%, rgba(40,8,14,.6), transparent 70%),
      linear-gradient(180deg, rgba(2,3,6,.86), rgba(2,3,6,.95));
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    opacity: 1; transition: opacity .6s ease; }
  #akl.hide { opacity: 0; pointer-events: none; }
  .akl-stage { position: relative; width: 132px; height: 132px; display: flex; align-items: center; justify-content: center; }
  .akl-kata { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; object-position: top center;
    border: 1.5px solid rgba(226,59,78,.5); box-shadow: 0 0 34px rgba(200,30,50,.32), inset 0 0 22px rgba(0,0,0,.45);
    animation: aklDance 1.9s ease-in-out infinite; }
  @keyframes aklDance { 0%,100%{transform:translateY(0) rotate(-3.5deg)} 25%{transform:translateY(-5px) rotate(2.5deg)}
    50%{transform:translateY(0) rotate(3.5deg)} 75%{transform:translateY(-5px) rotate(-2.5deg)} }
  .akl-ring { position: absolute; inset: 0; animation: aklSpin 3.4s linear infinite; }
  @keyframes aklSpin { to { transform: rotate(360deg); } }
  .akl-d { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .akl-d svg { position: absolute; left: -8px; top: -73px; width: 16px; height: 16px; color: #e23b4e;
    filter: drop-shadow(0 0 5px rgba(226,59,78,.7)); }
  .akl-d.d2 { transform: rotate(120deg); } .akl-d.d3 { transform: rotate(240deg); }
  .akl-word { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 36px; color: #fff;
    display: flex; align-items: center; gap: 9px; line-height: 1; }
  .akl-word svg { width: 24px; height: 24px; color: #e23b4e; filter: drop-shadow(0 0 6px rgba(226,59,78,.55)); }
  .akl-sub { font-family: 'Barlow', sans-serif; font-weight: 300; font-size: 9.5px; letter-spacing: .42em;
    text-transform: uppercase; color: rgba(255,255,255,.42); margin-top: -6px; }
  .akl-bar { width: 132px; height: 2px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; margin-top: 4px; }
  .akl-bar i { display: block; height: 100%; width: 38%; border-radius: 2px;
    background: linear-gradient(90deg, transparent, #e23b4e, transparent); animation: aklSweep 1.25s ease-in-out infinite; }
  @keyframes aklSweep { 0%{transform:translateX(-110%)} 100%{transform:translateX(330%)} }
`
