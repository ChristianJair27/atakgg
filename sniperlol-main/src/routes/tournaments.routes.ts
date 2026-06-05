// src/routes/tournaments.routes.ts — MySQL-backed tournament system
import { Router } from 'express';
import {
  createProvider, createTournament, generateCodes,
  getLobbyEvents, getCodeInfo,
} from '../services/riot-tournament.service.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getMatchById, getMatchIdsByPUUID, getAccountByRiotId, getSummonerByPUUID, getLiveGame, getLiveGameByPuuid } from '../services/riot.js';
import { pool } from '../db.js';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────
type TournamentPhase = 'registration' | 'checkin' | 'active' | 'complete';
type MatchStatus     = 'pending' | 'ready' | 'active' | 'complete';

interface Standing {
  position: number; team: string; wins: number; losses: number; points: number;
}
interface BracketMatch {
  id: string; round: number; matchNumber: number;
  team1: string | null; team2: string | null;
  winner: string | null; code: string | null;
  matchStatus: MatchStatus;
  score1?: number; score2?: number;
  gameId?: number; gameRegion?: string;
}
interface TeamRegistration {
  teamName: string; captainRiotId: string;
  players: Array<{ name: string; riotId: string }>;
  contact: string; registeredAt: string;
  checkedIn: boolean; checkedInAt?: string;
}
interface TournamentData {
  id: string; name: string; phase: TournamentPhase;
  participants: number; maxParticipants: number;
  prize: string; startDate: string; format: string; description: string;
  standings?: Standing[];
  riotTournamentId?: number;
  bracket?: BracketMatch[];
  checkinDeadline?: string;
  codePool: string[];
  createdBy?: number;
  region?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

// ─── DB init ──────────────────────────────────────────────────────────────────
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id                VARCHAR(200) PRIMARY KEY,
      name              VARCHAR(500) NOT NULL,
      phase             VARCHAR(20)  DEFAULT 'registration',
      participants      INT          DEFAULT 0,
      max_participants  INT          DEFAULT 16,
      prize             VARCHAR(500) DEFAULT 'Por definir',
      start_date        VARCHAR(50)  NOT NULL,
      format            VARCHAR(200) DEFAULT '5v5 Single Elimination',
      description       TEXT,
      riot_tournament_id INT,
      code_pool         JSON,
      bracket           JSON,
      standings         JSON,
      checkin_deadline  VARCHAR(50),
      created_by        INT,
      created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_registrations (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id    VARCHAR(200) NOT NULL,
      team_name        VARCHAR(500) NOT NULL,
      captain_riot_id  VARCHAR(200) NOT NULL,
      players          JSON         NOT NULL,
      contact          VARCHAR(500),
      checked_in       TINYINT(1)   DEFAULT 0,
      checked_in_at    VARCHAR(50),
      registered_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_team (tournament_id, team_name(100)),
      INDEX idx_tournament (tournament_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // New columns (idempotent)
  for (const col of [
    `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'la1'`,
    `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1000)`,
    `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_url VARCHAR(1000)`,
    `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1000)`,
  ]) { await pool.query(col).catch(() => {}); }
  // Seed only if empty
  const [[{ cnt }]] = await pool.query<any[]>('SELECT COUNT(*) AS cnt FROM tournaments');
  if (Number(cnt) === 0) {
    const seeds = [
      ['lqc-split-primavera-2026','LQC Split Primavera 2026','registration',22,32,
       '$15,000 MXN + Skins + Trofeo','2026-03-15','Liga regular + Playoffs Double Elimination',
       'Torneo oficial de la Liga Queretana. Clasifica a playoffs y compite por el título.',null,null],
      ['copa-atak-2026','Copa ATAK.GG x LQC','registration',0,16,
       'RP, Skins y Coaching profesional','2026-02-20','5v5 Single Elimination',
       'Torneo abierto comunitario con premios para todos los rangos.',null,null],
      ['lqc-otono-2025','LQC Otoño 2025','complete',28,32,
       '$12,000 MXN','2025-09-10','Liga + Playoffs','Campeón: Team Eclipse QRO',null,
       JSON.stringify([
         {position:1,team:'Eclipse QRO',wins:9,losses:0,points:27},
         {position:2,team:'Dragones Querétaro',wins:7,losses:2,points:21},
         {position:3,team:'Corregidora Warriors',wins:6,losses:3,points:18},
         {position:4,team:'ATAK Academy',wins:5,losses:4,points:15},
         {position:5,team:'Santiago Knights',wins:4,losses:5,points:12},
       ])],
    ];
    for (const s of seeds) {
      await pool.query(
        `INSERT IGNORE INTO tournaments (id,name,phase,participants,max_participants,prize,start_date,format,description,riot_tournament_id,standings)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`, s
      );
    }
  }
}
initTables().catch(err => console.error('[tournaments] initTables error:', err.message));

// ─── DB helpers ───────────────────────────────────────────────────────────────
function parseJson(v: any) { if (!v) return undefined; return typeof v === 'string' ? JSON.parse(v) : v; }

function rowToTournament(row: any): TournamentData {
  return {
    id: row.id, name: row.name, phase: row.phase,
    participants: row.participants, maxParticipants: row.max_participants,
    prize: row.prize, startDate: row.start_date, format: row.format,
    description: row.description || '',
    riotTournamentId: row.riot_tournament_id || undefined,
    codePool:   parseJson(row.code_pool)   || [],
    bracket:    parseJson(row.bracket)     || undefined,
    standings:  parseJson(row.standings)   || undefined,
    checkinDeadline: row.checkin_deadline  || undefined,
    createdBy:  row.created_by             || undefined,
    region:     row.region                 || 'la1',
    logoUrl:    row.logo_url               || undefined,
    bannerUrl:  row.banner_url             || undefined,
  };
}

async function getT(id: string): Promise<TournamentData | null> {
  const [[row]] = await pool.query<any[]>('SELECT * FROM tournaments WHERE id = ?', [id]);
  return row ? rowToTournament(row) : null;
}

async function saveT(t: TournamentData) {
  await pool.query(
    `UPDATE tournaments SET
       phase=?, participants=?, max_participants=?, prize=?, start_date=?,
       format=?, description=?, riot_tournament_id=?,
       code_pool=?, bracket=?, standings=?, checkin_deadline=?,
       region=?, logo_url=?, banner_url=?
     WHERE id=?`,
    [
      t.phase, t.participants, t.maxParticipants, t.prize, t.startDate,
      t.format, t.description, t.riotTournamentId ?? null,
      JSON.stringify(t.codePool),
      t.bracket   ? JSON.stringify(t.bracket)   : null,
      t.standings ? JSON.stringify(t.standings) : null,
      t.checkinDeadline ?? null,
      t.region ?? 'la1',
      t.logoUrl ?? null,
      t.bannerUrl ?? null,
      t.id,
    ]
  );
}

function serialize(t: TournamentData) {
  const status = (t.phase==='registration'||t.phase==='checkin') ? 'abiertas'
               : t.phase==='active' ? 'progreso' : 'finalizado';
  return {
    id:t.id, name:t.name, phase:t.phase, status,
    participants:t.participants, maxParticipants:t.maxParticipants,
    prize:t.prize, startDate:t.startDate, format:t.format, description:t.description,
    standings:t.standings, riotTournamentId:t.riotTournamentId,
    bracket:t.bracket, checkinDeadline:t.checkinDeadline,
    codesAvailable:t.codePool.length, createdBy:t.createdBy,
    region:t.region||'la1', logoUrl:t.logoUrl, bannerUrl:t.bannerUrl,
  };
}

async function getRegs(tournamentId: string): Promise<TeamRegistration[]> {
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM tournament_registrations WHERE tournament_id = ? ORDER BY registered_at ASC',
    [tournamentId]
  );
  return rows.map(r => ({
    teamName: r.team_name, captainRiotId: r.captain_riot_id,
    players: parseJson(r.players) || [],
    contact: r.contact || '', registeredAt: r.registered_at,
    checkedIn: !!r.checked_in, checkedInAt: r.checked_in_at || undefined,
  }));
}

function isOwner(req: any, t: TournamentData) {
  return req.auth?.userId === t.createdBy || req.auth?.role === 'admin';
}

// ─── Bracket generator ────────────────────────────────────────────────────────
function generateBracket(teams: string[]): BracketMatch[] {
  const n = Math.pow(2, Math.ceil(Math.log2(Math.max(teams.length, 2))));
  const padded = [...teams];
  while (padded.length < n) padded.push('BYE');
  for (let i = padded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [padded[i], padded[j]] = [padded[j], padded[i]];
  }
  const totalRounds = Math.log2(n);
  const matches: BracketMatch[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const cnt = n / Math.pow(2, r);
    for (let m = 1; m <= cnt; m++) {
      const t1 = r===1 ? padded[(m-1)*2] : null;
      const t2 = r===1 ? padded[(m-1)*2+1] : null;
      const isBye = t1==='BYE'||t2==='BYE';
      matches.push({ id:`r${r}m${m}`, round:r, matchNumber:m,
        team1:t1, team2:t2, winner:null, code:null,
        matchStatus: (t1&&t2&&!isBye) ? 'ready' : 'pending' });
    }
  }
  matches.filter(m=>m.round===1&&(m.team1==='BYE'||m.team2==='BYE')).forEach(match=>{
    const winner = match.team1!=='BYE' ? match.team1 : match.team2;
    match.winner=winner; match.matchStatus='complete';
    const next = matches.find(m=>m.id===`r2m${Math.ceil(match.matchNumber/2)}`);
    if (next) {
      if (match.matchNumber%2===1) next.team1=winner; else next.team2=winner;
      if (next.team1&&next.team2&&next.team1!=='BYE'&&next.team2!=='BYE') next.matchStatus='ready';
    }
  });
  return matches;
}

function riotRegionToPlatform(region: string): string {
  const m: Record<string,string> = {
    LAN:'la1',LA1:'la1',LA2:'la2',LAS:'la2',NA1:'na1',NA:'na1',BR1:'br1',BR:'br1',
    EUW1:'euw1',EUW:'euw1',EUN1:'eun1',EUNE:'eun1',KR:'kr',JP1:'jp1',OC1:'oc1',RU:'ru',TR1:'tr1',
  };
  return m[region.toUpperCase()] || 'la1';
}
function riotMatchId(gameId: number, platform: string) { return `${platform.toUpperCase()}_${gameId}`; }

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET all
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM tournaments ORDER BY created_at DESC');
    res.json(rows.map(r => serialize(rowToTournament(r))));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST / — create
router.post('/', requireAuth, async (req: any, res) => {
  const { name, prize, startDate, format, description, maxParticipants, checkinDeadline, createRiot } = req.body;
  if (!name || !startDate) return res.status(400).json({ error:'name y startDate requeridos' });

  let riotTournamentId: number|undefined;
  let initialCodes: string[] = [];

  if (createRiot) {
    try {
      let providerId = req.app.locals.riotProviderId;
      if (!providerId) {
        const p = await createProvider(); providerId = p.id;
        req.app.locals.riotProviderId = providerId;
      }
      const rt = await createTournament(providerId, name);
      riotTournamentId = rt.id;
      initialCodes = await generateCodes(riotTournamentId, Math.min((maxParticipants||16)*2, 100));
    } catch (err: any) { return res.status(500).json({ error:'Error Riot: '+err.message }); }
  }

  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const id = `${slug}-${Date.now()}`;
  const newT: TournamentData = {
    id, name, phase:'registration', participants:0,
    maxParticipants:maxParticipants||16,
    prize:prize||'Por definir', startDate,
    format:format||'5v5 Single Elimination', description:description||'',
    riotTournamentId, codePool:initialCodes,
    checkinDeadline:checkinDeadline||undefined,
    createdBy:req.auth.userId,
  };

  try {
    await pool.query(
      `INSERT INTO tournaments (id,name,phase,participants,max_participants,prize,start_date,format,description,riot_tournament_id,code_pool,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,name,'registration',0,newT.maxParticipants,newT.prize,startDate,newT.format,
       newT.description,riotTournamentId??null,JSON.stringify(initialCodes),req.auth.userId]
    );
    res.json({ success:true, tournament:serialize(newT) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Riot callback
router.post('/tournament-callback', async (req, res) => {
  const { shortCode, gameId, region } = req.body;
  console.log('[Riot Callback]', req.body);
  if (shortCode && gameId) {
    try {
      const platform = riotRegionToPlatform(region || 'LAN');
      const [rows] = await pool.query<any[]>('SELECT id, bracket FROM tournaments WHERE bracket IS NOT NULL');
      for (const row of rows) {
        const bracket: BracketMatch[] = parseJson(row.bracket) || [];
        const idx = bracket.findIndex(m => m.code === shortCode);
        if (idx !== -1) {
          bracket[idx].gameId = Number(gameId);
          bracket[idx].gameRegion = platform;
          await pool.query('UPDATE tournaments SET bracket=? WHERE id=?', [JSON.stringify(bracket), row.id]);
          break;
        }
      }
    } catch (err) { console.error('[Callback] error:', err); }
  }
  res.status(200).send('OK');
});

// GET by id
router.get('/:id', async (req, res) => {
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    res.json(serialize(t));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Register team
router.post('/:id/register', requireAuth, async (req: any, res) => {
  const { teamName, captainRiotId, players, contact } = req.body;
  if (!teamName||!captainRiotId||!Array.isArray(players)||players.length<5)
    return res.status(400).json({ error:'Datos incompletos (mínimo 5 jugadores)' });
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (t.phase!=='registration') return res.status(400).json({ error:'Inscripciones cerradas' });
    if (t.participants>=t.maxParticipants) return res.status(400).json({ error:'Torneo lleno' });

    await pool.query(
      `INSERT INTO tournament_registrations (tournament_id,team_name,captain_riot_id,players,contact)
       VALUES (?,?,?,?,?)`,
      [t.id, teamName, captainRiotId, JSON.stringify(players), contact||'']
    );
    await pool.query('UPDATE tournaments SET participants=participants+1 WHERE id=?', [t.id]);
    res.json({ success:true, message:'¡Equipo inscrito!', teamName, currentParticipants:t.participants+1 });
  } catch (err: any) {
    if (err.code==='ER_DUP_ENTRY') return res.status(400).json({ error:'Ya existe un equipo con ese nombre' });
    res.status(500).json({ error: err.message });
  }
});

// GET registrations
router.get('/:id/registrations', async (req, res) => {
  try { res.json(await getRegs(req.params.id)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Close registration → checkin
router.post('/:id/close-registration', requireAuth, async (req: any, res) => {
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador puede hacer esto' });
    if (t.phase!=='registration') return res.status(400).json({ error:'No está en fase de inscripciones' });
    const regs = await getRegs(req.params.id);
    if (regs.length<2) return res.status(400).json({ error:'Mínimo 2 equipos' });
    t.phase='checkin';
    if (req.body.checkinDeadline) t.checkinDeadline=req.body.checkinDeadline;
    await saveT(t);
    res.json({ success:true, phase:'checkin', teamsRegistered:regs.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Check-in
router.post('/:id/checkin', requireAuth, async (req: any, res) => {
  const { teamName, captainRiotId } = req.body;
  if (!teamName) return res.status(400).json({ error:'teamName requerido' });
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (t.phase!=='checkin') return res.status(400).json({ error:'Check-in no activo' });

    const [[reg]] = await pool.query<any[]>(
      'SELECT * FROM tournament_registrations WHERE tournament_id=? AND LOWER(team_name)=LOWER(?)',
      [t.id, teamName]
    );
    if (!reg) return res.status(404).json({ error:'Equipo no encontrado' });
    if (captainRiotId && reg.captain_riot_id!==captainRiotId)
      return res.status(403).json({ error:'Riot ID del capitán no coincide' });
    if (reg.checked_in) return res.status(400).json({ error:'Ya hizo check-in' });

    await pool.query(
      'UPDATE tournament_registrations SET checked_in=1, checked_in_at=? WHERE id=?',
      [new Date().toISOString(), reg.id]
    );
    const [[{ checkedIn }]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS checkedIn FROM tournament_registrations WHERE tournament_id=? AND checked_in=1',
      [t.id]
    );
    const [[{ total }]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM tournament_registrations WHERE tournament_id=?', [t.id]
    );
    res.json({ success:true, message:'Check-in confirmado', checkedIn:Number(checkedIn), total:Number(total) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Start tournament
router.post('/:id/start', requireAuth, async (req: any, res) => {
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador puede hacer esto' });
    if (t.phase==='active'||t.phase==='complete') return res.status(400).json({ error:'Torneo ya activo o completado' });
    const allRegs = await getRegs(req.params.id);
    const activeRegs = t.phase==='checkin' ? allRegs.filter(r=>r.checkedIn) : allRegs;
    if (activeRegs.length<2) return res.status(400).json({ error:'Mínimo 2 equipos' });

    const teams = activeRegs.map(r=>r.teamName);
    const bracket = generateBracket(teams);
    bracket.filter(m=>m.round===1&&m.matchStatus==='ready').forEach(m=>{
      const code=t.codePool.shift()||null;
      if (code) { m.code=code; m.matchStatus='active'; }
    });
    const standings: Standing[] = teams.map((team,i)=>({position:i+1,team,wins:0,losses:0,points:0}));
    t.phase='active'; t.bracket=bracket; t.standings=standings; t.participants=teams.length;
    await saveT(t);
    res.json({ success:true, bracket, standings });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET bracket
router.get('/:id/bracket', async (req, res) => {
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    res.json({ bracket:t.bracket||[], phase:t.phase });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Activate match
router.post('/:id/matches/:matchId/activate', requireAuth, async (req: any, res) => {
  const { id, matchId } = req.params;
  try {
    const t = await getT(id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador puede hacer esto' });
    if (!t.bracket) return res.status(400).json({ error:'Sin bracket' });
    const mi = t.bracket.findIndex(m=>m.id===matchId);
    if (mi===-1) return res.status(404).json({ error:'Partido no encontrado' });
    const match = t.bracket[mi];
    if (match.matchStatus==='active'||match.matchStatus==='complete')
      return res.json({ success:true, code:match.code });
    if (!match.team1||!match.team2) return res.status(400).json({ error:'Faltan equipos' });
    let code = t.codePool.shift()||null;
    if (!code&&t.riotTournamentId) {
      const newCodes = await generateCodes(t.riotTournamentId, 1);
      code = newCodes[0]||null;
    }
    t.bracket[mi].code=code; t.bracket[mi].matchStatus=code?'active':'ready';
    await saveT(t);
    res.json({ success:true, code, matchId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Report result
router.post('/:id/matches/:matchId/result', requireAuth, async (req: any, res) => {
  const { id, matchId } = req.params;
  const { winner, score1, score2 } = req.body;
  try {
    const t = await getT(id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador puede hacer esto' });
    if (!t.bracket) return res.status(400).json({ error:'Sin bracket' });
    if (t.phase!=='active') return res.status(400).json({ error:'Torneo no activo' });
    const mi = t.bracket.findIndex(m=>m.id===matchId);
    if (mi===-1) return res.status(404).json({ error:'Partido no encontrado' });
    const match = t.bracket[mi];
    if (winner!==match.team1&&winner!==match.team2) return res.status(400).json({ error:'Ganador inválido' });
    if (match.matchStatus==='complete') return res.status(400).json({ error:'Partido ya completado' });
    const loser = winner===match.team1?match.team2:match.team1;
    t.bracket[mi] = {...match, winner, matchStatus:'complete',
      score1:score1!==undefined?score1:match.score1,
      score2:score2!==undefined?score2:match.score2};
    // Advance winner
    const nextId = `r${match.round+1}m${Math.ceil(match.matchNumber/2)}`;
    const ni = t.bracket.findIndex(m=>m.id===nextId);
    if (ni!==-1) {
      if (match.matchNumber%2===1) t.bracket[ni].team1=winner; else t.bracket[ni].team2=winner;
      if (t.bracket[ni].team1&&t.bracket[ni].team2) {
        const code = t.codePool.shift()||null;
        t.bracket[ni].code=code; t.bracket[ni].matchStatus=code?'active':'ready';
      }
    }
    // Standings
    if (t.standings) {
      t.standings = t.standings
        .map(s=>s.team===winner?{...s,wins:s.wins+1,points:s.points+3}:s.team===loser?{...s,losses:s.losses+1}:s)
        .sort((a,b)=>b.points-a.points).map((s,i)=>({...s,position:i+1}));
    }
    // Check completion
    const maxRound = Math.max(...t.bracket.map(m=>m.round));
    if (t.bracket.find(m=>m.round===maxRound)?.matchStatus==='complete') t.phase='complete';
    await saveT(t);
    res.json({ success:true, bracket:t.bracket, standings:t.standings,
      tournamentComplete:t.phase==='complete',
      champion:t.phase==='complete'?t.bracket.find(m=>m.round===maxRound)?.winner:null });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Link gameId manually
router.post('/:id/matches/:matchId/link-game', requireAuth, async (req: any, res) => {
  const { id, matchId } = req.params;
  const { gameId, region } = req.body;
  if (!gameId) return res.status(400).json({ error:'gameId requerido' });
  try {
    const t = await getT(id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador' });
    const mi = t.bracket?.findIndex(m=>m.id===matchId)??-1;
    if (mi===-1) return res.status(404).json({ error:'Partido no encontrado' });
    t.bracket![mi].gameId=Number(gameId);
    t.bracket![mi].gameRegion=riotRegionToPlatform(region||'LAN');
    await saveT(t);
    res.json({ success:true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Resolve gameId to platform by trying all Americas platforms directly (no PUUID needed)
async function resolveGamePlatform(gameId: number): Promise<{ platform: string; riotMatchId: string } | null> {
  const platforms = ['la1', 'la2', 'na1', 'br1'];
  for (const pf of platforms) {
    const mid = riotMatchId(gameId, pf);
    const data = await getMatchById(pf, mid);
    if (data) return { platform: pf, riotMatchId: mid };
  }
  return null;
}

// Link gameId directly — probes all platforms to find where the game lives
router.post('/:id/matches/:matchId/link-gameid', async (req, res) => {
  const { id, matchId } = req.params;
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId requerido' });
  try {
    const t = await getT(id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!t.bracket) return res.status(400).json({ error: 'Sin bracket' });
    const mi = t.bracket.findIndex(m => m.id === matchId);
    if (mi === -1) return res.status(404).json({ error: 'Partido no encontrado' });

    const resolved = await resolveGamePlatform(Number(gameId));
    if (!resolved) return res.status(404).json({ error: `gameId ${gameId} no encontrado en ninguna plataforma Americas` });

    t.bracket[mi].gameId     = Number(gameId);
    t.bracket[mi].gameRegion = resolved.platform;
    await saveT(t);
    res.json({ success: true, gameId: Number(gameId), platform: resolved.platform, riotMatchId: resolved.riotMatchId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Auto-detect gameId from captain's recent match history and link it
router.post('/:id/matches/:matchId/auto-detect-game', async (req, res) => {
  const { id, matchId } = req.params;
  try {
    let t = await getT(id) ?? await (async () => {
      const [[row]] = await pool.query<any[]>('SELECT * FROM tournaments WHERE riot_tournament_id = ?', [id]);
      return row ? rowToTournament(row) : null;
    })();
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!t.bracket) return res.status(400).json({ error: 'Sin bracket' });
    const mi = t.bracket.findIndex(m => m.id === matchId);
    if (mi === -1) return res.status(404).json({ error: 'Partido no encontrado', available: t.bracket.map(m => m.id) });

    const match = t.bracket[mi];
    const platform = t.region || 'la1';
    const probePlatforms = SPECTATOR_PROBE_PLATFORMS[platform] ?? [platform];

    // Find captain riot ID
    const regs = await getRegs(t.id);
    const captainRiotId = regs.find(r => r.teamName === match.team1)?.captainRiotId
                       ?? regs.find(r => r.teamName === match.team2)?.captainRiotId;
    if (!captainRiotId) return res.status(400).json({ error: 'No se encontró capitán registrado' });

    const [gameName, tagLine] = captainRiotId.split('#');
    if (!gameName || !tagLine) return res.status(400).json({ error: `Riot ID inválido: ${captainRiotId}` });

    const account = await getAccountByRiotId(gameName.trim(), tagLine.trim(), { platformHint: platform });
    if (!account?.puuid) return res.status(404).json({ error: `No se encontró cuenta para ${captainRiotId}` });

    // Try each platform's match history to find the most recent custom/tournament game
    let foundMatchId: string | null = null;
    let foundPlatform = platform;
    for (const pf of probePlatforms) {
      const ids = await getMatchIdsByPUUID(pf, account.puuid, 5, 0);
      if (ids && ids.length > 0) {
        foundMatchId = ids[0];
        foundPlatform = pf;
        break;
      }
    }

    if (!foundMatchId) return res.status(404).json({ error: 'No se encontraron partidas recientes. Espera unos minutos y reintenta.' });

    // Extract numeric gameId from matchId (e.g. "LA1_1234567890" → 1234567890)
    const parts = foundMatchId.split('_');
    const gameId = Number(parts[parts.length - 1]);

    t.bracket[mi].gameId = gameId;
    t.bracket[mi].gameRegion = foundPlatform;
    await saveT(t);

    res.json({ success: true, matchId, riotMatchId: foundMatchId, gameId, platform: foundPlatform });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Assign code and/or gameId to match (no auth — for manual tournament ops)
router.post('/:id/matches/:matchId/set-code', async (req, res) => {
  const { id, matchId } = req.params;
  const { code, gameId, region } = req.body;
  if (!code && !gameId) return res.status(400).json({ error: 'Se requiere code o gameId' });
  try {
    const t = await getT(id) ?? await (async () => {
      const [[row]] = await pool.query<any[]>('SELECT * FROM tournaments WHERE riot_tournament_id = ?', [id]);
      return row ? rowToTournament(row) : null;
    })();
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!t.bracket) return res.status(400).json({ error: 'Sin bracket' });
    const mi = t.bracket.findIndex(m => m.id === matchId);
    if (mi === -1) return res.status(404).json({ error: 'Partido no encontrado', available: t.bracket.map(m => m.id) });
    if (code) t.bracket[mi].code = code;
    if (gameId) {
      t.bracket[mi].gameId     = Number(gameId);
      t.bracket[mi].gameRegion = region ? riotRegionToPlatform(region) : (t.region || 'la1');
    }
    if (t.bracket[mi].matchStatus === 'pending' || t.bracket[mi].matchStatus === 'ready') {
      t.bracket[mi].matchStatus = 'active';
    }
    await saveT(t);
    for (const [k] of liveCache) { if (k.includes('live')) liveCache.delete(k); }
    res.json({ success: true, matchId, code: t.bracket[mi].code, gameId: t.bracket[mi].gameId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Try lobby events for a code directly (no auth — for testing)
router.get('/debug-lobby/:code', async (req, res) => {
  try {
    const events = await getLobbyEvents(req.params.code);
    res.json(events);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Match stats
router.get('/:id/matches/:matchId/stats', async (req, res) => {
  const { id, matchId } = req.params;
  try {
    const t = await getT(id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    const match = t.bracket?.find(m=>m.id===matchId);
    if (!match) return res.status(404).json({ error:'Partido no encontrado' });
    if (!match.gameId) return res.status(404).json({ error:'No hay gameId para este partido. Linkea el gameId primero.' });

    // Try stored platform first, then LATAM sibling if it returns null
    const primaryPlatform = match.gameRegion || t.region || 'la1';
    const tryPlatforms = primaryPlatform === 'la1' ? ['la1','la2']
                       : primaryPlatform === 'la2' ? ['la2','la1']
                       : [primaryPlatform];

    let data: any = null;
    let usedPlatform = primaryPlatform;
    for (const pf of tryPlatforms) {
      data = await getMatchById(pf, riotMatchId(match.gameId, pf));
      if (data) { usedPlatform = pf; break; }
    }

    if (!data) return res.status(404).json({ error:`Partida ${match.gameId} no encontrada en Riot (intenté: ${tryPlatforms.join(', ')})` });
    const info = (data as any).info;
    const participants = info.participants.map((p: any) => ({
      summonerName:p.riotIdGameName||p.summonerName, tagLine:p.riotIdTagLine,
      championName:p.championName, champLevel:p.champLevel,
      teamId:p.teamId, win:p.win,
      kills:p.kills, deaths:p.deaths, assists:p.assists,
      kda:p.deaths===0?(p.kills+p.assists):((p.kills+p.assists)/p.deaths),
      cs:p.totalMinionsKilled+p.neutralMinionsKilled,
      csPerMin:Math.round(((p.totalMinionsKilled+p.neutralMinionsKilled)/info.gameDuration)*60*10)/10,
      goldEarned:p.goldEarned, totalDamageDealt:p.totalDamageDealtToChampions,
      visionScore:p.visionScore, wardsPlaced:p.wardsPlaced, wardsKilled:p.wardsKilled,
      items:[p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(Boolean),
      pentaKills:p.pentaKills, quadraKills:p.quadraKills, tripleKills:p.tripleKills,
      firstBloodKill:p.firstBloodKill,
    }));
    res.json({
      matchId:riotMatchId(match.gameId, usedPlatform),
      gameDuration:info.gameDuration, gameStartTimestamp:info.gameStartTimestamp,
      gameMode:info.gameMode,
      blueTeam:participants.filter((p:any)=>p.teamId===100),
      redTeam:participants.filter((p:any)=>p.teamId===200),
      winner:info.teams.find((t:any)=>t.win)?.teamId===100?'blue':'red',
      teams:info.teams,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Generate codes
router.post('/:id/generate-codes', requireAuth, async (req: any, res) => {
  const { count=10 } = req.body;
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador puede hacer esto' });
    let providerId = req.app.locals.riotProviderId;
    if (!providerId) {
      const p = await createProvider(); providerId = p.id;
      req.app.locals.riotProviderId = providerId;
    }
    let riotTournamentId = t.riotTournamentId;
    if (!riotTournamentId) {
      const rt = await createTournament(providerId, t.name);
      riotTournamentId = rt.id; t.riotTournamentId = riotTournamentId;
    }
    const newCodes = await generateCodes(riotTournamentId!, count);
    t.codePool = [...t.codePool, ...newCodes];
    await saveT(t);
    res.json({ success:true, generated:newCodes.length, poolSize:t.codePool.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET codes (owner only)
router.get('/:id/codes', requireAuth, async (req: any, res) => {
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error:'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error:'Solo el creador' });
    res.json({ codePool:t.codePool, poolSize:t.codePool.length, riotTournamentId:t.riotTournamentId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/lobby-events/:code', async (req, res) => {
  try { res.json(await getLobbyEvents(req.params.code)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/code-info/:code', async (req, res) => {
  try { res.json(await getCodeInfo(req.params.code)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── PATCH /:id — update logo/banner/region (owner only) ─────────────────────
router.patch('/:id', requireAuth, async (req: any, res) => {
  const { logoUrl, bannerUrl, region, name, prize, description } = req.body;
  try {
    const t = await getT(req.params.id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!isOwner(req, t)) return res.status(403).json({ error: 'Solo el creador puede editar' });
    if (logoUrl    !== undefined) t.logoUrl    = logoUrl    || undefined;
    if (bannerUrl  !== undefined) t.bannerUrl  = bannerUrl  || undefined;
    if (region     !== undefined) t.region     = region     || 'la1';
    if (name       !== undefined) t.name       = name;
    if (prize      !== undefined) t.prize      = prize;
    if (description !== undefined) t.description = description;
    await saveT(t);
    res.json({ success: true, tournament: serialize(t) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Shared cache for live-match spectator lookups ────────────────────────────
const liveCache = new Map<string, { data: any; exp: number }>();
function lcGet(k: string) { const e = liveCache.get(k); return e && e.exp > Date.now() ? e.data : undefined; }
function lcSet(k: string, v: any, ms: number) { liveCache.set(k, { data: v, exp: Date.now() + ms }); }

// Platforms to probe when searching for a live game — includes regional siblings
// so a LAN tournament can detect a player whose summoner is on LAS and vice-versa.
const SPECTATOR_PROBE_PLATFORMS: Record<string, string[]> = {
  la1: ['la1', 'la2'],
  la2: ['la2', 'la1'],
  na1: ['na1'],
  br1: ['br1'],
  euw1: ['euw1'],
  eun1: ['eun1'],
  kr:   ['kr'],
  jp1:  ['jp1'],
};

// ─── Core helper — build live data for a tournament ──────────────────────────
async function buildLiveData(id: string) {
  const t = await getT(id);
  if (!t) return null;

  const platform = t.region || 'la1';
  const activeMatches = (t.bracket || []).filter(
    m => m.matchStatus === 'active' || m.matchStatus === 'ready'
  );

  const regs = await getRegs(t.id);

  // Map teamName → all registered player Riot IDs (captain first, then rest of roster)
  const teamPlayersMap = new Map<string, string[]>();
  regs.forEach(r => {
    const ids: string[] = [r.captainRiotId];
    (r.players || []).forEach((p: any) => {
      if (p.riotId && p.riotId !== r.captainRiotId) ids.push(p.riotId);
    });
    teamPlayersMap.set(r.teamName, ids);
  });

  // Resolve PUUID from Riot ID (cached 10 min)
  async function resolvePuuid(riotId: string): Promise<string | null> {
    const ck = `puuid:${platform}:${riotId}`;
    const cached = lcGet(ck);
    if (cached !== undefined) return cached as string | null;
    try {
      const [gameName, tagLine] = riotId.split('#');
      if (!gameName || !tagLine) return null;
      const account = await getAccountByRiotId(gameName.trim(), tagLine.trim(), { platformHint: platform });
      const puuid = account?.puuid ?? null;
      if (puuid) lcSet(ck, puuid, 10 * 60_000);
      return puuid;
    } catch { return null; }
  }

  console.log(`[live:${id}] platform=${platform} activeMatches=${activeMatches.length} regs=${regs.length}`);
  activeMatches.forEach(m => console.log(`  match ${m.id}: ${m.team1} vs ${m.team2} (${m.matchStatus})`));
  regs.forEach(r => console.log(`  reg team="${r.teamName}" captain="${r.captainRiotId}" players=${(r.players||[]).length}`));

  const results = await Promise.all(activeMatches.map(async (match) => {
    // Gather all players from both teams (up to 10 Riot IDs to probe)
    const allRiotIds: string[] = [];
    for (const tn of [match.team1, match.team2]) {
      if (!tn) continue;
      const ids = teamPlayersMap.get(tn) ?? [];
      ids.forEach(rid => { if (rid && !allRiotIds.includes(rid)) allRiotIds.push(rid); });
    }

    console.log(`[live:${id}] match ${match.id} → probing ${allRiotIds.length} Riot IDs:`, allRiotIds);

    let liveGame: any = null;
    for (const riotId of allRiotIds) {
      const ck = `live:${platform}:${riotId}`;
      const cached = lcGet(ck);
      if (cached) { console.log(`  [cache HIT game] ${riotId}`); liveGame = cached; break; }

      const puuid = await resolvePuuid(riotId);
      if (!puuid) { console.log(`  [puuid FAIL] ${riotId}`); continue; }
      console.log(`  [puuid ok] ${riotId} → ${puuid.slice(0,12)}...`);

      try {
        const probePlatforms = SPECTATOR_PROBE_PLATFORMS[platform] ?? [platform];
        let game: any = null;

        for (const pf of probePlatforms) {
          // 1. Try spectator by-puuid
          game = await getLiveGameByPuuid(pf, puuid);
          if (game) { console.log(`  [LIVE by-puuid] ${riotId} on ${pf} gameId=${game.gameId}`); break; }

          // 2. Try spectator by-summoner
          try {
            const summoner = await getSummonerByPUUID(pf, puuid);
            if (summoner?.id) {
              console.log(`  [by-summoner] ${riotId} on ${pf} summonerId=${summoner.id.slice(0,10)}...`);
              game = await getLiveGame(pf, summoner.id);
              if (game) { console.log(`  [LIVE by-summoner] ${riotId} on ${pf} gameId=${game.gameId}`); break; }
              console.log(`  [by-summoner] ${riotId} on ${pf} → not in game`);
            } else {
              console.log(`  [by-summoner] ${riotId} on ${pf} → no summoner found`);
            }
          } catch (e: any) {
            console.log(`  [by-summoner ERROR] ${riotId} on ${pf}:`, e?.response?.status ?? e?.message);
          }
        }

        if (game) {
          console.log(`  [LIVE FOUND] ${riotId} gameId=${game.gameId}`);
          lcSet(ck, game, 60_000);
          liveGame = game;
          break;
        } else {
          console.log(`  [not in game] ${riotId}`);
          lcSet(ck, null, 15_000);
        }
      } catch (err: any) {
        console.error(`  [spectator ERROR] ${riotId}:`, err?.response?.status, err?.message);
      }
    }

    // ── Fallback: lobby events ─────────────────────────────────────────────────
    // If no player had a valid Riot ID (bad registration data), try fetching the
    // summoner IDs directly from the tournament code's lobby events.
    if (!liveGame && match.code) {
      console.log(`  [lobby fallback] trying code ${match.code}`);
      try {
        const events = await getLobbyEvents(match.code);
        const summonerIds: string[] = [
          ...new Set(
            ((events?.eventList ?? []) as any[])
              .filter(e => e.summonerId)
              .map(e => e.summonerId as string)
          ),
        ];
        console.log(`  [lobby fallback] found ${summonerIds.length} summonerIds`);
        for (const sid of summonerIds) {
          const ck = `live-sid:${platform}:${sid}`;
          const cached = lcGet(ck);
          if (cached) { liveGame = cached; break; }
          try {
            const game = await getLiveGame(platform, sid);
            if (game) {
              console.log(`  [LIVE via lobby] summonerId=${sid.slice(0,10)}... gameId=${game.gameId}`);
              lcSet(ck, game, 60_000);
              liveGame = game;
              break;
            } else {
              lcSet(ck, null, 15_000);
            }
          } catch {}
        }
      } catch (lobbyErr: any) {
        console.log(`  [lobby fallback error] ${lobbyErr.message}`);
      }
    }

    let blueTeam: any[] = [], redTeam: any[] = [], gameLength = 0, gameId: number | null = null;
    if (liveGame) {
      gameLength = liveGame.gameLength ?? 0;
      gameId     = liveGame.gameId ?? null;
      (liveGame.participants ?? []).forEach((p: any) => {
        const entry = {
          summonerName: p.riotId?.split('#')[0] ?? p.summonerName ?? 'Unknown',
          riotId:       p.riotId ?? null,
          championId:   p.championId,
          spell1Id:     p.spell1Id,
          spell2Id:     p.spell2Id,
          teamId:       p.teamId,
        };
        if (p.teamId === 100) blueTeam.push(entry); else redTeam.push(entry);
      });
    }

    return {
      matchId: match.id, round: match.round, matchNumber: match.matchNumber,
      team1: match.team1, team2: match.team2,
      score1: match.score1 ?? 0, score2: match.score2 ?? 0,
      matchStatus: match.matchStatus, code: match.code,
      isLive: !!liveGame, gameId, gameLength, blueTeam, redTeam,
      bannedChampions: (liveGame?.bannedChampions ?? []).map((b: any) => ({
        championId: b.championId, teamId: b.teamId, pickTurn: b.pickTurn,
      })),
    };
  }));

  return {
    tournamentId: t.id, tournamentName: t.name, phase: t.phase,
    region: platform, logoUrl: t.logoUrl, bannerUrl: t.bannerUrl,
    matches: results, timestamp: Date.now(),
  };
}

// GET /debug-list — list all tournament IDs (for debugging)
router.get('/debug-list', async (_req, res) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT id, name, phase, riot_tournament_id, region FROM tournaments ORDER BY created_at DESC'
    );
    res.json(rows.map(r => ({
      id: r.id, name: r.name, phase: r.phase,
      riotTournamentId: r.riot_tournament_id, region: r.region,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/debug-live — returns raw resolution info for troubleshooting
router.get('/:id/debug-live', async (req, res) => {
  try {
    // Accept either internal slug OR riot_tournament_id
    let t = await getT(req.params.id);
    if (!t) {
      const [[row]] = await pool.query<any[]>(
        'SELECT * FROM tournaments WHERE riot_tournament_id = ?', [req.params.id]
      );
      if (row) t = rowToTournament(row);
    }
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado', hint: 'Llama a /api/tournaments/debug-list para ver los IDs disponibles' });
    const platform = t.region || 'la1';
    const regs = await getRegs(t.id);
    const activeMatches = (t.bracket || []).filter(
      m => m.matchStatus === 'active' || m.matchStatus === 'ready'
    );

    const info: any = { tournamentId: t.id, phase: t.phase, platform, activeMatches: activeMatches.length, teams: [] };

    for (const r of regs) {
      const teamInfo: any = { teamName: r.teamName, captainRiotId: r.captainRiotId, players: [], spectatorResults: [] };
      const allIds = [r.captainRiotId, ...(r.players||[]).map((p:any)=>p.riotId).filter(Boolean)];
      for (const riotId of allIds) {
        try {
          const [gameName, tagLine] = riotId.split('#');
          if (!gameName || !tagLine) { teamInfo.players.push({ riotId, error: 'formato inválido (falta #tag)' }); continue; }
          const account = await getAccountByRiotId(gameName.trim(), tagLine.trim(), { platformHint: platform });
          if (!account?.puuid) { teamInfo.players.push({ riotId, error: 'cuenta no encontrada' }); continue; }
          const puuid = account.puuid;
          let gameInfo: any = null;
          try {
            const g = await getLiveGameByPuuid(platform, puuid);
            gameInfo = g ? { gameId: g.gameId, gameLength: g.gameLength, participants: g.participants?.length } : null;
          } catch (e: any) { gameInfo = { error: e?.response?.status ?? e?.message }; }
          teamInfo.players.push({ riotId, puuid: puuid.slice(0,12)+'...', inGame: !!gameInfo, gameInfo });
        } catch (e: any) {
          teamInfo.players.push({ riotId, error: e?.response?.status ?? e?.message });
        }
      }
      info.teams.push(teamInfo);
    }
    res.json(info);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/live-matches — REST endpoint (polling)
router.get('/:id/live-matches', async (req, res) => {
  try {
    const data = await buildLiveData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Torneo no encontrado' });
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /:id/live-stream — SSE endpoint (real-time, every 15s)
router.get('/:id/live-stream', async (req, res) => {
  res.setHeader('Content-Type',     'text/event-stream');
  res.setHeader('Cache-Control',    'no-cache');
  res.setHeader('Connection',       'keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();

  const push = (obj: object) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      (res as any).flush?.();
    } catch {}
  };

  const tick = async () => {
    try {
      const data = await buildLiveData(req.params.id);
      if (data) push(data);
      else push({ error: 'Torneo no encontrado' });
    } catch (e: any) { push({ error: e.message }); }
  };

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); (res as any).flush?.(); } catch {}
  }, 30_000);

  await tick();
  const interval = setInterval(tick, 15_000);
  req.on('close', () => { clearInterval(interval); clearInterval(heartbeat); });
});

export default router;
