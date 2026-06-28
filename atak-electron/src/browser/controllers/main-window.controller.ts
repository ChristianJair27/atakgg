import { app as electronApp, BrowserWindow, ipcMain, shell } from 'electron';
import { overwolf } from '@overwolf/ow-electron';
import path from 'path';
import { OverlayService } from '../services/overlay.service';
import { LiveClientService } from '../services/live-client.service';

const owApp = electronApp as overwolf.OverwolfApp;

// Default to localhost so it survives router/DHCP IP changes. Override with ATAK_URL env if you
// need to reach the dev server from another device on the LAN.
const ATAK_URL = process.env.ATAK_URL ?? 'http://localhost:8080/';

export class MainWindowController {
  private browserWindow: BrowserWindow = null;

  constructor(
    private readonly overlayService: OverlayService,
    private readonly liveClientService: LiveClientService
  ) {
    owApp.overwolf.packages.on('failed-to-initialize', (e, packageName, ...args) => {
      console.error('[ATAK] package failed:', packageName, ...args);
    });

    liveClientService.on('state-update', (state) => {
      this.sendToWindow('live-data', state);
    });

    liveClientService.on('game-ended', () => {
      this.sendToWindow('game-ended', null);
    });

    overlayService.on('game-injected', (gameInfo) => {
      this.sendToWindow('game-injected', { gameId: gameInfo?.id });
    });

    overlayService.on('game-exit', () => {
      this.sendToWindow('game-exit', null);
    });

    this.registerIpc();
  }

  public createAndShow() {
    this.browserWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: true,
      title: 'ATAK.GG Companion',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: true,
        preload: path.join(__dirname, '../preload/preload.js'),
      },
    });

    // Open external links in system browser, not Electron window
    this.browserWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Load ATAK.GG or fallback main page
    this.browserWindow.loadURL(ATAK_URL).catch(() => {
      this.browserWindow.loadFile(path.join(__dirname, '../renderer/main.html'));
    });

    this.browserWindow.on('closed', () => {
      this.browserWindow = null;
      electronApp.quit();
    });
  }

  private registerIpc() {
    ipcMain.handle('get-status', () => ({
      atakUrl: ATAK_URL,
      overlayReady: !!this.overlayService.overlayApi,
    }));
  }

  private sendToWindow(channel: string, data: any) {
    try {
      if (this.browserWindow && !this.browserWindow.isDestroyed()) {
        this.browserWindow.webContents.send(channel, data);
      }
    } catch {}
  }
}
