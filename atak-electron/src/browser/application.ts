import { GameLaunchEvent, GameInfo } from '@overwolf/ow-electron-packages-types';
import { kGameIds } from '@overwolf/ow-electron-packages-types/game-list';
import { OverlayService } from './services/overlay.service';
import { LiveClientService } from './services/live-client.service';
import { LcuService } from './services/lcu.service';
import { MainWindowController } from './controllers/main-window.controller';
import { OverlayController } from './controllers/overlay.controller';
import { ChampSelectController } from './controllers/champ-select.controller';

export class Application {
  constructor(
    private readonly overlayService: OverlayService,
    private readonly liveClientService: LiveClientService,
    private readonly lcuService: LcuService,
    private readonly mainWindowController: MainWindowController,
    private readonly overlayController: OverlayController,
    private readonly champSelectController: ChampSelectController
  ) {
    overlayService.on('ready', this.onOverlayReady.bind(this));

    overlayService.on('injection-decision-handling', (
      event: GameLaunchEvent,
      gameInfo: GameInfo
    ) => {
      event.inject();
    });
  }

  public run() {
    this.mainWindowController.createAndShow();
    // Start LCU polling for champion select detection
    this.lcuService.startPolling();
    console.log('[ATAK] LCU champ-select polling started');
  }

  private onOverlayReady() {
    this.overlayService.registerToGames([
      kGameIds.LeagueofLegends,
      kGameIds.LeagueofLegendsPBE,
      kGameIds.TeamfightTactics,
    ]);
  }
}
