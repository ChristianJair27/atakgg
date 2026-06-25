import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import EventEmitter from 'events';

// Possible lockfile locations across different install paths
const LOCKFILE_PATHS = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  path.join(os.homedir(), 'AppData', 'Local', 'Riot Games', 'League of Legends', 'lockfile'),
  'D:\\Riot Games\\League of Legends\\lockfile',
  'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
];

interface LockfileData {
  port: number;
  password: string;
  protocol: string;
}

interface ChampSelectPlayer {
  championId: number;
  assignedPosition: string;
  summonerId: number;
  cellId: number;
  isLocalPlayer?: boolean;
}

export interface ChampSelectState {
  inChampSelect: boolean;
  localPlayerChampionId: number;
  localPlayerPosition: string;
  phase: string;  // 'PLANNING' | 'BAN_PICK' | 'FINALIZATION' | ''
}

// Self-signed cert agent for LCU API (LoL uses its own cert)
const lcuAgent = new https.Agent({ rejectUnauthorized: false });

export class LcuService extends EventEmitter {
  private lockfile: LockfileData | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private champSelectActive = false;
  private lastChampionId = 0;
  private lastGameflowPhase = '';
  private eogFetched = false;

  public startPolling() {
    if (this.pollInterval) return;
    console.log('[ATAK LCU] starting lockfile polling');
    this.pollInterval = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  public stopPolling() {
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.lockfile = null;
    this.champSelectActive = false;
    this.lastChampionId = 0;
    this.lastGameflowPhase = '';
    this.eogFetched = false;
    console.log('[ATAK LCU] stopped');
  }

  private findLockfile(): LockfileData | null {
    for (const p of LOCKFILE_PATHS) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          const parts = content.split(':');
          // format: LeagueClient:pid:port:password:protocol
          if (parts.length >= 5) {
            return { port: Number(parts[2]), password: parts[3], protocol: parts[4].trim() };
          }
        } catch {}
      }
    }
    return null;
  }

  private async lcuGet(lockfile: LockfileData, endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`riot:${lockfile.password}`).toString('base64');
      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: lockfile.port,
        path: endpoint,
        method: 'GET',
        agent: lcuAgent,
        headers: { Authorization: `Basic ${auth}` },
        timeout: 1500,
      };
      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON parse failed')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  // Watch the gameflow phase; when it reaches EndOfGame, fetch the end-of-game
  // stats block (works for ALL modes: SR, ARAM, Arena/CHERRY…) and emit it once.
  private async checkGameflow() {
    if (!this.lockfile) return;
    let phase = '';
    try {
      const p = await this.lcuGet(this.lockfile, '/lol-gameflow/v1/gameflow-phase');
      phase = typeof p === 'string' ? p : '';
    } catch { return; }

    if (phase === 'EndOfGame' || phase === 'PreEndOfGame') {
      if (!this.eogFetched) {
        try {
          const block = await this.lcuGet(this.lockfile, '/lol-end-of-game/v1/eog-stats-block');
          if (block && !block.errorCode && Array.isArray(block.teams) && block.teams.length) {
            await this.normalizeEog(block);
            this.eogFetched = true;
            console.log('[ATAK EOG] end-of-game stats ready:', block.gameMode);
            this.emit('eog-stats', block);
          }
        } catch { /* block not ready yet — retry next poll */ }
      }
    } else {
      if (this.eogFetched) this.emit('eog-closed');
      this.eogFetched = false;
    }
    this.lastGameflowPhase = phase;
  }

  // The raw eog-stats-block doesn't always carry gameMode / a resolved local
  // player, so fill those in (best-effort) before emitting.
  private async normalizeEog(block: any) {
    if (!block.gameMode) {
      try {
        const s = await this.lcuGet(this.lockfile!, '/lol-gameflow/v1/session');
        block.gameMode = s?.map?.gameMode || s?.gameData?.queue?.gameMode || 'CLASSIC';
      } catch { block.gameMode = 'CLASSIC'; }
    }
    const all: any[] = [];
    for (const t of (block.teams || [])) for (const p of (t.players || [])) all.push(p);
    if (!block.localPlayer) {
      let me = all.find((p) => p.isLocalPlayer || p.localPlayer);
      if (!me) {
        try {
          const cur = await this.lcuGet(this.lockfile!, '/lol-summoner/v1/current-summoner');
          const nm = cur?.gameName || cur?.displayName;
          if (nm) me = all.find((p) => p.summonerName === nm || p.riotIdGameName === nm);
        } catch {}
      }
      block.localPlayer = me || all[0] || { stats: {}, championId: 0, level: 0 };
    }
  }

  private async poll() {
    // Re-find lockfile each poll in case LoL just launched
    if (!this.lockfile) {
      this.lockfile = this.findLockfile();
      if (!this.lockfile) {
        if (this.champSelectActive) {
          this.champSelectActive = false;
          this.lastChampionId = 0;
          this.emit('champ-select-ended');
        }
        return;
      }
    }

    // Detect end-of-game (all modes) and surface the post-game stats block.
    await this.checkGameflow();

    try {
      const session = await this.lcuGet(this.lockfile, '/lol-champ-select/v1/session');

      // Error response means not in champ select
      if (session?.httpStatus || session?.errorCode) {
        if (this.champSelectActive) {
          this.champSelectActive = false;
          this.lastChampionId = 0;
          this.emit('champ-select-ended');
        }
        return;
      }

      const localPlayer = session?.myTeam?.find((p: ChampSelectPlayer) => p.summonerId === session.localPlayerCellId || p.cellId === session.localPlayerCellId);
      const champId: number = localPlayer?.championId ?? 0;
      const position: string = localPlayer?.assignedPosition ?? '';
      const phase: string = session?.timer?.phase ?? '';

      const state: ChampSelectState = {
        inChampSelect: true,
        localPlayerChampionId: champId,
        localPlayerPosition: position,
        phase,
      };

      if (!this.champSelectActive) {
        this.champSelectActive = true;
        this.emit('champ-select-started', state);
      }

      if (champId !== this.lastChampionId) {
        this.lastChampionId = champId;
        this.emit('champ-select-update', state);
      }

    } catch {
      // LoL client not running or not responding — clear lockfile to re-detect
      this.lockfile = null;
      if (this.champSelectActive) {
        this.champSelectActive = false;
        this.lastChampionId = 0;
        this.emit('champ-select-ended');
      }
    }
  }
}
