import https from 'https';
import EventEmitter from 'events';

export interface GameState {
  summonerName: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  level: number;
  gameTime: number;
  position: string;
  isActive: boolean;
}

const EMPTY_STATE: GameState = {
  summonerName: '',
  championName: '',
  kills: 0,
  deaths: 0,
  assists: 0,
  cs: 0,
  gold: 0,
  level: 1,
  gameTime: 0,
  position: '',
  isActive: false,
};

export class LiveClientService extends EventEmitter {
  private pollInterval: NodeJS.Timeout = null;
  private isPolling = false;

  public startPolling() {
    if (this.pollInterval) return;
    console.log('[ATAK] starting Live Client API polling');
    this.pollInterval = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  public stopPolling() {
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.isPolling = false;
    console.log('[ATAK] stopped Live Client API polling');
    this.emit('game-ended');
  }

  private poll() {
    const options: https.RequestOptions = {
      hostname: '127.0.0.1',
      port: 2999,
      path: '/liveclientdata/allgamedata',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 1500,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          this.processGameData(data);
        } catch {
          // JSON parse failed - not in game yet
        }
      });
    });

    req.on('error', () => {
      // LoL not in a playable state or API not available
    });

    req.on('timeout', () => {
      req.destroy();
    });

    req.end();
  }

  private processGameData(data: any) {
    try {
      const activePlayer = data?.activePlayer;
      const allPlayers: any[] = data?.allPlayers ?? [];
      const gameData = data?.gameData;

      if (!activePlayer || !gameData) return;

      const myName = activePlayer.summonerName ?? '';
      const myPlayer = allPlayers.find(
        (p) => p.summonerName === myName
      ) ?? allPlayers[0];

      const state: GameState = {
        summonerName: myName,
        championName: myPlayer?.championName ?? '',
        kills: myPlayer?.scores?.kills ?? 0,
        deaths: myPlayer?.scores?.deaths ?? 0,
        assists: myPlayer?.scores?.assists ?? 0,
        cs: myPlayer?.scores?.creepScore ?? 0,
        gold: Math.floor(activePlayer?.currentGold ?? 0),
        level: activePlayer?.level ?? 1,
        gameTime: Math.floor(gameData?.gameTime ?? 0),
        position: myPlayer?.position ?? '',
        isActive: true,
      };

      this.emit('state-update', state);
    } catch (e) {
      console.error('[ATAK] processGameData error:', e);
    }
  }
}
