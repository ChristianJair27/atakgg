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
