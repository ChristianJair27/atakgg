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
  gameMode: string;
  items: number[];
  visionScore: number;
  killParticipation: number;
  myTeam: string;
  players: PlayerLite[];
  isActive: boolean;
}

export interface PlayerLite {
  championName: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  team: string;       // 'ORDER' | 'CHAOS'
  isDead: boolean;
  position: string;
  isMe: boolean;
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
  gameMode: '',
  items: [],
  visionScore: 0,
  killParticipation: 0,
  myTeam: 'ORDER',
  players: [],
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

      const myName = activePlayer.riotIdGameName || activePlayer.summonerName || '';
      const nameOf = (p: any) => p?.riotIdGameName || p?.summonerName || '';
      const myPlayer = allPlayers.find((p) => nameOf(p) === myName) ?? allPlayers[0];
      const myTeam = myPlayer?.team ?? 'ORDER';

      const items: number[] = (myPlayer?.items ?? [])
        .map((it: any) => it?.itemID)
        .filter((id: any) => typeof id === 'number' && id > 0);

      const players: PlayerLite[] = allPlayers.map((p: any) => ({
        championName: p?.championName ?? '',
        name: nameOf(p),
        kills: p?.scores?.kills ?? 0,
        deaths: p?.scores?.deaths ?? 0,
        assists: p?.scores?.assists ?? 0,
        cs: (p?.scores?.creepScore ?? 0),
        team: p?.team ?? 'ORDER',
        isDead: !!p?.isDead,
        position: p?.position ?? '',
        isMe: nameOf(p) === myName,
      }));

      // Kill participation = (my kills + assists) / team total kills
      const myK = myPlayer?.scores?.kills ?? 0;
      const myA = myPlayer?.scores?.assists ?? 0;
      const teamKills = players.filter((p) => p.team === myTeam).reduce((s, p) => s + p.kills, 0);
      const killParticipation = teamKills > 0 ? Math.round(((myK + myA) / teamKills) * 100) : 0;

      const state: GameState = {
        summonerName: myName,
        championName: myPlayer?.championName ?? '',
        kills: myK,
        deaths: myPlayer?.scores?.deaths ?? 0,
        assists: myA,
        cs: myPlayer?.scores?.creepScore ?? 0,
        gold: Math.floor(activePlayer?.currentGold ?? 0),
        level: activePlayer?.level ?? 1,
        gameTime: Math.floor(gameData?.gameTime ?? 0),
        position: myPlayer?.position ?? '',
        gameMode: gameData?.gameMode ?? '',
        items,
        visionScore: Math.round(myPlayer?.scores?.wardScore ?? 0),
        killParticipation,
        myTeam,
        players,
        isActive: true,
      };

      this.emit('state-update', state);
    } catch (e) {
      console.error('[ATAK] processGameData error:', e);
    }
  }
}
