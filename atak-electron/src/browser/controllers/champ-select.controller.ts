import { BrowserWindow, screen } from 'electron';
import * as https from 'https';
import * as path from 'path';
import { LcuService, ChampSelectState } from '../services/lcu.service';

const BACKEND = process.env.ATAK_BACKEND ?? 'https://atakback.revolution505.com';
const DDRAGON_VERSION_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';

// Minimal https fetch for champion ID→name conversion (avoids extra npm dep)
function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, { agent }, (res: any) => {
      let raw = '';
      res.on('data', (c: Buffer) => (raw += c));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON')); } });
    }).on('error', reject);
  });
}

export class ChampSelectController {
  private window: BrowserWindow | null = null;
  private champIdMap: Record<number, string> = {};
  private patch = '14.24.1';
  // Track the most recently requested champion so a slower in-flight fetch for a
  // previously-hovered champion can't overwrite the current one (race guard).
  private currentChampionId: number | null = null;

  constructor(private readonly lcuService: LcuService) {
    this.loadChampionIdMap();

    lcuService.on('champ-select-started', (state: ChampSelectState) => {
      console.log('[ATAK CS] champ select started');
      this.createAndShow();
      if (state.localPlayerChampionId) this.sendChampionData(state.localPlayerChampionId);
    });

    lcuService.on('champ-select-update', (state: ChampSelectState) => {
      console.log('[ATAK CS] champion update:', state.localPlayerChampionId);
      if (!this.window || this.window.isDestroyed()) this.createAndShow();
      if (state.localPlayerChampionId) {
        this.sendChampionData(state.localPlayerChampionId);
      } else {
        this.currentChampionId = null;
        this.sendToWindow('champion-cleared', null);
      }
    });

    lcuService.on('champ-select-ended', () => {
      console.log('[ATAK CS] champ select ended');
      this.close();
    });
  }

  private async loadChampionIdMap() {
    try {
      const versions = await httpsGet(DDRAGON_VERSION_URL);
      this.patch = versions[0];
      const data = await httpsGet(`https://ddragon.leagueoflegends.com/cdn/${this.patch}/data/en_US/champion.json`);
      for (const champ of Object.values<any>(data.data)) {
        this.champIdMap[Number(champ.key)] = champ.name;
      }
      console.log('[ATAK CS] loaded', Object.keys(this.champIdMap).length, 'champions for patch', this.patch);
    } catch (err: any) {
      console.error('[ATAK CS] failed to load champion map:', err?.message);
    }
  }

  private async sendChampionData(championId: number) {
    // Mark this as the active request; later results from older champions are dropped.
    this.currentChampionId = championId;

    const champName = this.champIdMap[championId];
    if (!champName) {
      this.sendToWindow('champion-data', { championId, champName: null, loading: true });
      return;
    }

    this.sendToWindow('champion-data', { championId, champName, loading: true });

    try {
      const res = await fetch(`${BACKEND}/api/champ-select?champion=${encodeURIComponent(champName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Stale-response guard: ignore if the user has since hovered another champion.
      if (this.currentChampionId !== championId) return;
      this.sendToWindow('champion-data', { ...data, loading: false });
    } catch (err: any) {
      console.error('[ATAK CS] failed to fetch recommendations:', err?.message);
      if (this.currentChampionId !== championId) return;
      this.sendToWindow('champion-data', { championId, champName, loading: false, error: true });
    }
  }

  public createAndShow() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    this.window = new BrowserWindow({
      width: 340,
      height: 560,
      x: width - 360,
      y: Math.floor(height / 2) - 280,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
      },
    });

    const htmlPath = path.join(__dirname, '../renderer/champ-select.html');
    this.window.loadFile(htmlPath);

    this.window.setAlwaysOnTop(true, 'screen-saver', 1);

    this.window.on('closed', () => {
      this.window = null;
    });

    console.log('[ATAK CS] window created');
  }

  public close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
  }

  private sendToWindow(channel: string, data: any) {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(channel, data);
      }
    } catch {}
  }
}
