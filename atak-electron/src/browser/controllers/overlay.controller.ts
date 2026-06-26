import path from 'path';
import { ipcMain, BrowserWindow, screen, shell } from 'electron';
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
  private overlayWindow: OverlayBrowserWindow = null;   // OSR-injected window (when Overwolf overlay package is available)
  private fallbackWindow: BrowserWindow = null;         // plain always-on-top window (works without OSR / Overwolf approval)
  private isVisible = true;
  private lastDataTs = 0;
  private inactivityTimer: NodeJS.Timeout = null;

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

    // Poll the Live Client API (port 2999) unconditionally. It errors silently
    // out of game and only emits 'state-update' while a match is running — this
    // is what drives the plain-window fallback when OSR injection is unavailable
    // (e.g. the Overwolf overlay package is still pending app approval).
    this.liveClientService.startPolling();

    liveClientService.on('state-update', (state: GameState) => {
      this.lastDataTs = Date.now();
      this.ensureWindow();
      this.sendToOverlay('live-data', state);
    });

    liveClientService.on('game-ended', () => {
      this.sendToOverlay('game-ended', null);
    });

    // Hide the fallback window a few seconds after the live data stops flowing.
    this.inactivityTimer = setInterval(() => {
      if (this.fallbackWindow && this.lastDataTs && Date.now() - this.lastDataTs > 12000) {
        if (!this.fallbackWindow.isDestroyed()) this.fallbackWindow.hide();
      }
    }, 4000);
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
        this.liveClientService.startPolling();
        await this.createAndShow();
      }
    } catch (e) {
      console.log('[ATAK] no active game at startup');
    }
  }

  // Ensure SOME overlay window exists. Prefer the OSR window; if it isn't
  // available (no Overwolf overlay package), fall back to a plain window.
  private ensureWindow() {
    if (this.overlayWindow?.window && !this.overlayWindow.window.isDestroyed()) return;
    this.ensureFallbackWindow();
  }

  private ensureFallbackWindow() {
    if (this.fallbackWindow && !this.fallbackWindow.isDestroyed()) {
      if (!this.fallbackWindow.isVisible()) this.fallbackWindow.show();
      return;
    }

    const { width } = screen.getPrimaryDisplay().workAreaSize;
    this.fallbackWindow = new BrowserWindow({
      width: 340,
      height: 680,
      x: width - 360,
      y: 20,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      // focusable so the header buttons (pin/profile/close) are clickable;
      // shown with showInactive() below so it doesn't steal focus from the game.
      focusable: true,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
      },
    });
    // 'screen-saver' level is the most reliable for floating over a
    // borderless-windowed game on Windows.
    this.fallbackWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    this.fallbackWindow.setVisibleOnAllWorkspaces(true);

    const overlayHtmlPath = path.join(__dirname, '../renderer/overlay.html');
    this.fallbackWindow.loadFile(overlayHtmlPath);
    // Show without grabbing keyboard focus from the game.
    this.fallbackWindow.once('ready-to-show', () => this.fallbackWindow?.showInactive());

    const wc = this.fallbackWindow.webContents;
    wc.ipc.on('toggle-overlay', () => this.toggleVisibility());
    wc.ipc.on('pin-overlay', () => {
      if (!this.fallbackWindow || this.fallbackWindow.isDestroyed()) return;
      const on = this.fallbackWindow.isAlwaysOnTop();
      this.fallbackWindow.setAlwaysOnTop(!on, 'screen-saver', 1);
    });
    wc.ipc.on('open-profile', (_e, name: string) => {
      const n = (name || '').trim();
      const url = n
        ? `http://localhost:8080/stats/la1/${encodeURIComponent(n)}`
        : 'http://localhost:8080';
      shell.openExternal(url).catch(() => {});
    });
    this.fallbackWindow.on('closed', () => { this.fallbackWindow = null; });

    this.isVisible = true;
    console.log('[ATAK] plain fallback overlay window created (OSR unavailable)');
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

      const overlayHtmlPath = path.join(__dirname, '../renderer/overlay.html');
      await this.overlayWindow.window.loadFile(overlayHtmlPath);

      this.isVisible = true;
      console.log('[ATAK] overlay window created at', options.x, options.y);
    } catch (e) {
      console.error('[ATAK] OSR overlay unavailable, using plain fallback:', (e as Error)?.message);
      this.overlayWindow = null;
      this.ensureFallbackWindow();
    }
  }

  private toggleVisibility() {
    const win = (this.overlayWindow?.window && !this.overlayWindow.window.isDestroyed())
      ? this.overlayWindow.window
      : (this.fallbackWindow && !this.fallbackWindow.isDestroyed() ? this.fallbackWindow : null);
    if (!win) return;
    if (this.isVisible) win.hide(); else win.show();
    this.isVisible = !this.isVisible;
  }

  private sendToOverlay(channel: string, data: any) {
    try {
      if (this.overlayWindow?.window && !this.overlayWindow.window.isDestroyed()) {
        this.overlayWindow.window.webContents.send(channel, data);
      }
      if (this.fallbackWindow && !this.fallbackWindow.isDestroyed()) {
        this.fallbackWindow.webContents.send(channel, data);
      }
    } catch {}
  }
}
