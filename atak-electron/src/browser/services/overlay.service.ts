import { app as electronApp } from 'electron';
import { overwolf } from '@overwolf/ow-electron';
import {
  IOverwolfOverlayApi,
  OverlayWindowOptions,
  OverlayBrowserWindow,
  GamesFilter,
} from '@overwolf/ow-electron-packages-types';
import EventEmitter from 'events';

const app = electronApp as overwolf.OverwolfApp;

export class OverlayService extends EventEmitter {
  private overlayApiRef: IOverwolfOverlayApi | null = null;

  public get overlayApi(): IOverwolfOverlayApi | null {
    return this.overlayApiRef;
  }

  constructor() {
    super();
    this.startOverlayWhenPackageReady();
  }

  public async createNewOsrWindow(options: OverlayWindowOptions): Promise<OverlayBrowserWindow> {
    return await this.overlayApi.createWindow(options);
  }

  public async registerToGames(gameIds: number[]): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[ATAK] registering overlay for game ids:', gameIds);
    try {
      const filter: GamesFilter = { gamesIds: gameIds };
      this.overlayApi?.registerGames(filter);
      console.log('[ATAK] overlay registered');
    } catch (err: any) {
      // registerGames may not be available in dev builds — overlay events still work
      console.warn('[ATAK] registerGames unavailable (dev build?):', err?.message);
    }
  }

  private startOverlayWhenPackageReady() {
    console.log('[ATAK] registering packages.on(ready) listener');
    app.overwolf.packages.on('ready', (e, packageName, version) => {
      console.log('[ATAK] package ready event:', packageName, version);
      if (packageName !== 'overlay') return;

      // packages.overlay may not be set synchronously during the ready callback;
      // defer one tick so the runtime has time to assign it.
      setImmediate(() => {
        const pkgs = app.overwolf.packages as any;
        this.overlayApiRef = pkgs.overlay as IOverwolfOverlayApi ?? null;

        if (!this.overlayApiRef) {
          // packages.overlay is not set in dev builds; fall back to the internal handler.
          // handler.api is a partial EventEmitter view — registerGames is guarded in registerToGames.
          const ctrl = pkgs.controller;
          const handler = ctrl?.getApiHandler('overlay');
          this.overlayApiRef = (handler?.overlay ?? handler?.api) as IOverwolfOverlayApi ?? null;
          console.log('[ATAK] overlay API via fallback:', this.overlayApiRef ? 'found' : 'not found');
        }

        if (!this.overlayApiRef) {
          console.error('[ATAK] overlay API not available after setImmediate — giving up');
          return;
        }

        console.log(`[ATAK] overlay package ready: ${version}`);
        this.registerOverlayEvents();
        this.emit('ready');
      });
    });
    app.overwolf.packages.on('failed-to-initialize', (e: any, packageName: string, ...args: any[]) => {
      console.error('[ATAK] package FAILED:', packageName, ...args);
    });
  }

  private registerOverlayEvents() {
    this.overlayApi.removeAllListeners();

    this.overlayApi.on('game-launched', (event, gameInfo) => {
      console.log('[ATAK] game launched:', gameInfo?.id, '| elevated:', gameInfo?.processInfo?.isElevated);
      this.emit('injection-decision-handling', event, gameInfo);
    });

    this.overlayApi.on('game-injected', (gameInfo) => {
      console.log('[ATAK] game injected:', gameInfo?.id);
      this.emit('game-injected', gameInfo);
    });

    this.overlayApi.on('game-exit', (gameInfo, wasInjected) => {
      console.log('[ATAK] game exit:', gameInfo?.id, wasInjected);
      this.emit('game-exit', gameInfo, wasInjected);
    });

    this.overlayApi.on('game-injection-error', (gameInfo, error) => {
      console.error('[ATAK] injection error:', error);
    });

    this.overlayApi.on('game-focus-changed', (window, game, focus) => {
      console.log('[ATAK] focus changed:', game?.name, focus);
    });

    this.overlayApi.on('game-window-changed', (gameWindowInfo, game, reason) => {
      this.emit('game-window-changed', gameWindowInfo, game, reason);
    });
  }
}
