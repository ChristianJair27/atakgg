import path from 'path';
import { ipcMain } from 'electron';
import {
  OverlayBrowserWindow,
  OverlayWindowOptions,
} from '@overwolf/ow-electron-packages-types';
import { OverlayService } from '../services/overlay.service';
import { LiveClientService, GameState } from '../services/live-client.service';

// LoL game IDs the overlay supports — matches kGameIds values:
// LeagueofLegends=5426, LeagueofLegendsPBE=22848, TeamfightTactics=21570
const LOL_GAME_IDS = [5426, 22848, 21570];

export class OverlayController {
  private overlayWindow: OverlayBrowserWindow = null;
  private isVisible = true;

  constructor(
    private readonly overlayService: OverlayService,
    private readonly liveClientService: LiveClientService
  ) {
    overlayService.on('ready', () => {
      this.registerOverlayEvents();
      this.registerHotkeys();
      // Check if a supported game is already running when we start
      this.checkForAlreadyRunningGame();
    });

    liveClientService.on('state-update', (state: GameState) => {
      this.sendToOverlay('live-data', state);
    });

    liveClientService.on('game-ended', () => {
      this.sendToOverlay('game-ended', null);
    });
  }

  private registerOverlayEvents() {
    this.overlayService.overlayApi.on('game-injected', (gameInfo) => {
      console.log('[ATAK] game injected:', gameInfo?.id);
      this.createAndShow();
      this.liveClientService.startPolling();
    });

    this.overlayService.overlayApi.on('game-exit', (gameInfo, wasInjected) => {
      if (!wasInjected) return;
      console.log('[ATAK] game exited');
      this.liveClientService.stopPolling();
      if (this.overlayWindow?.window && !this.overlayWindow.window.isDestroyed()) {
        this.overlayWindow.window.hide();
      }
      this.overlayWindow = null;
    });
  }

  private registerHotkeys() {
    // F8 to toggle overlay
    try {
      this.overlayService.overlayApi.hotkeys.register(
        { name: 'atakToggle', keyCode: 119, passthrough: true },
        (hotkey, state) => {
          if (state === 'pressed') this.toggleVisibility();
        }
      );
    } catch (e) {
      console.error('[ATAK] hotkey register error:', e);
    }
  }

  private async checkForAlreadyRunningGame() {
    try {
      const activeGame = this.overlayService.overlayApi.getActiveGameInfo();
      if (!activeGame) return;

      const isSupported = LOL_GAME_IDS.includes(activeGame.gameInfo?.id);
      console.log('[ATAK] game already running at startup:', activeGame.gameInfo?.id, '| supported:', isSupported);

      if (isSupported) {
        // Game is running but wasn't injected (app started after game)
        // Start polling Live Client API — overlay will appear as regular window
        this.liveClientService.startPolling();
        // Still try to create the overlay window (it may appear as regular window)
        await this.createAndShow();
      }
    } catch (e) {
      console.log('[ATAK] no active game at startup');
    }
  }

  public async createAndShow() {
    if (this.overlayWindow) {
      if (!this.overlayWindow.window.isDestroyed()) {
        this.overlayWindow.window.show();
      }
      return;
    }

    const activeGame = this.overlayService.overlayApi?.getActiveGameInfo();
    const screenWidth = activeGame?.gameWindowInfo?.size?.width ?? 1920;
    console.log('[ATAK] creating overlay at screenWidth:', screenWidth);

    const options: OverlayWindowOptions = {
      name: 'atak-hud',
      width: 290,
      height: 340,
      x: screenWidth - 310,
      y: 20,
      show: true,
      transparent: true,
      resizable: false,
      passthrough: 'passThrough',
      zOrder: 'topMost',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
      },
    };

    try {
      this.overlayWindow = await this.overlayService.createNewOsrWindow(options);

      this.overlayWindow.window.webContents.ipc.on('toggle-overlay', () => {
        this.toggleVisibility();
      });

      this.overlayWindow.window.on('closed', () => {
        this.overlayWindow = null;
      });

      // Use loadFile for reliable local file loading on Windows
      const overlayHtmlPath = path.join(__dirname, '../renderer/overlay.html');
      await this.overlayWindow.window.loadFile(overlayHtmlPath);

      this.isVisible = true;
      console.log('[ATAK] overlay window created at', options.x, options.y);
    } catch (e) {
      console.error('[ATAK] failed to create overlay window:', e);
      this.overlayWindow = null;
    }
  }

  private toggleVisibility() {
    if (!this.overlayWindow?.window || this.overlayWindow.window.isDestroyed()) return;
    if (this.isVisible) {
      this.overlayWindow.window.hide();
    } else {
      this.overlayWindow.window.show();
    }
    this.isVisible = !this.isVisible;
  }

  private sendToOverlay(channel: string, data: any) {
    try {
      if (this.overlayWindow?.window && !this.overlayWindow.window.isDestroyed()) {
        this.overlayWindow.window.webContents.send(channel, data);
      }
    } catch {}
  }
}
