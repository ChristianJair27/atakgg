import { app as ElectronApp } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Application } from './application';
import { OverlayService } from './services/overlay.service';
import { LiveClientService } from './services/live-client.service';
import { LcuService } from './services/lcu.service';
import { MainWindowController } from './controllers/main-window.controller';
import { OverlayController } from './controllers/overlay.controller';
import { ChampSelectController } from './controllers/champ-select.controller';

const LOG_FILE = path.join(require('os').homedir(), 'Desktop', 'atak-debug.log');
const origLog = console.log.bind(console);
const origErr = console.error.bind(console);
const writeLog = (prefix: string, args: any[]) => {
  const line = `[${new Date().toISOString()}] ${prefix} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  fs.appendFileSync(LOG_FILE, line);
};
console.log = (...args) => { origLog(...args); writeLog('LOG', args); };
console.error = (...args) => { origErr(...args); writeLog('ERR', args); };
fs.writeFileSync(LOG_FILE, `=== ATAK Companion started ${new Date().toISOString()} ===\n`);

const bootstrap = (): Application => {
  const overlayService = new OverlayService();
  const liveClientService = new LiveClientService();
  const lcuService = new LcuService();
  const overlayController = new OverlayController(overlayService, liveClientService);
  const mainWindowController = new MainWindowController(overlayService, liveClientService);
  const champSelectController = new ChampSelectController(lcuService);
  return new Application(overlayService, liveClientService, lcuService, mainWindowController, overlayController, champSelectController);
};

ElectronApp.whenReady().then(() => {
  writeLog('LOG', ['OVERWOLF_APP_UID:', process.env.OVERWOLF_APP_UID]);
});
writeLog('LOG', ['bootstrap starting']);
const app = bootstrap();
writeLog('LOG', ['bootstrap done, waiting for app ready']);

ElectronApp.whenReady().then(() => {
  writeLog('LOG', ['ElectronApp ready, running app']);
  app.run();
});

ElectronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    ElectronApp.quit();
  }
});
