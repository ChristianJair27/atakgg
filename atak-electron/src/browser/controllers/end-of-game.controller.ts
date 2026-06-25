import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { LcuService } from '../services/lcu.service';

// Post-game stats window. The End of Game screen lives on the client desktop
// (not over the running game), so a normal BrowserWindow works — no OSR / no
// Overwolf approval needed. Driven by the LCU eog-stats-block (all modes).
export class EndOfGameController {
  private window: BrowserWindow | null = null;

  constructor(private readonly lcuService: LcuService) {
    lcuService.on('eog-stats', (block: any) => this.show(block));
    // Leave the window open after the EOG phase so the player can read it;
    // they close it manually. (No auto-close on 'eog-closed'.)
  }

  private show(block: any) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      this.window.webContents.send('eog-data', block);
      return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const w = 920, h = 640;
    this.window = new BrowserWindow({
      width: w,
      height: h,
      x: Math.round((width - w) / 2),
      y: Math.round((height - h) / 2),
      frame: false,
      transparent: true,
      resizable: true,
      skipTaskbar: false,
      show: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: false,
      },
    });

    const htmlPath = path.join(__dirname, '../renderer/end-of-game.html');
    this.window.loadFile(htmlPath);

    // Send the data once the page is ready to receive it.
    this.window.webContents.once('did-finish-load', () => {
      this.window?.webContents.send('eog-data', block);
    });

    this.window.on('closed', () => { this.window = null; });

    console.log('[ATAK EOG] window created');
  }
}
