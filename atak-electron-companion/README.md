# ATAK Electron Companion (League of Legends)

Desktop AI companion for League of Legends. Runs locally, reads real-time game data, and uses your ATAK backend + Ollama for intelligent live coaching.

## Why Electron instead of Overwolf?

- Much easier to develop and debug
- Full control
- No strict manifest validation hell
- Direct access to Live Client Data API

## Quick Start (Windows)

1. Install dependencies (you already did this):
   ```powershell
   cd atak-electron-companion
   npm install
   ```

2. **Always run this command** to start development (it cleans old Electron processes first using a robust PowerShell one-liner):

   ```powershell
   npm run dev
   ```

   This runs the improved `clean` (targets only electron.exe variants safely) + `vite` to avoid the "no se encontró el proceso XXXXX" errors (like 21544 or 30976) that come from vite-plugin-electron's internal process management on Windows.

3. Make sure your backend is running:
   ```powershell
   cd ..\sniperlol-main
   npm run dev
   ```

4. Start League of Legends (custom or normal game). The companion window should appear automatically when a match is detected and start showing live data + AI advice.

**Important for "failed to fetch" when searching profile:**
- Backend must be running on localhost:4000 (the CORS now allows localhost:5174 automatically for dev).
- After changing server.ts, **restart the backend**.
- The profile search and AI use the ATAKGG backend data.

To run the main ATAKGG web app (required for the companion's embedded waiting UI):
- Make sure backend is up (see above).
- cd ..\aka.gg-main
- npm run dev   (Vite on :8080)
- The companion automatically embeds http://localhost:8080 (and /stats/:region/:name pages) while you wait.
- You can also open http://localhost:8080 directly in a browser tab for the main experience.
- Profile pages include champion stats ("campeones"), runes/keystones (in visualizer + mastery), solo/flex ranks, and you can extend with world/region ranks as needed — all of it appears in companion too.

For full experience (the current architecture):
- Terminal 1: backend (sniperlol-main `npm run dev`)
- Terminal 2: the main web UI `cd ..\aka.gg-main && npm run dev` (serves on :8080 with HMR)
- Terminal 3: companion `npm run dev` (in atak-electron-companion)

While waiting for a match, the companion window embeds the **exact same running atakgg web app** (via <webview> to http://localhost:8080). 
This means:
  * You see/implement campeones (champ stats + mastery), runas (runes in profile/live viz), rango del mundo y de región (rank cards + any leaderboard sections), full profiles, navigation, search, history, etc. exactly as in the browser.
  * Any change you make to improve atakgg (UI, data, new sections for ranks/champs/runes) is **immediately visible** in the companion's waiting screen too (shared source, no duplication).
  * You can freely navigate inside the embed (Home, search for other summoners, go to /stats pages, etc.).
- When League + a real match is detected (via LCD), the window auto-resizes to compact always-on-top HUD, hides the embed, and shows the dedicated native live view + AI coach. This keeps champ-select / in-game views separate as planned.
- On game end it switches back to the large window and auto-loads the just-played player's profile page inside the ATAKGG embed for review.

If you don't start the aka.gg-main dev server, the embed area will show a connection error / blank. You can still use the in-game HUD when playing. For the "espera" (pre-match) experience with full shared UI, run all three.

**Pro tip**: If you still see occasional PID noise, manually run the clean first or use `npm run electron:dev` after a `npm run build` for a more stable experience.

### Why you see "no se encontró el proceso" errors

These are very common with `vite-plugin-electron` on Windows during development. The dev server tries to kill previous Electron instances by PID. Our `clean` script kills them cleanly before starting, which greatly reduces the errors.

If you still see the error occasionally, just ignore it — the app should still work.

## How it works

- Detects when League is running
- Polls `http://127.0.0.1:2999/liveclientdata/allgamedata` (official Riot Local API)
- Sends relevant game state to your backend AI endpoint (`/api/ai/ai-live-coach`)
- Displays rich live stats + AI advice in a clean overlay window

## Next Steps (Recommended)

- Add more data (items, enemy builds, objective timers, etc.)
- Make the window draggable + always-on-top option
- Add voice output for the AI coach
- Build + package with `electron-builder`

This completely bypasses the web Spectator API limitations that were causing the 404s.

## Running the Web App (atakgg on localhost:8080)

If you see errors when opening http://localhost:8080:

1. Make sure the backend is running:
   ```powershell
   cd ..\sniperlol-main
   npm run dev
   ```

2. In the web folder, run the dev server (it will use port 8080 per vite.config):
   ```powershell
   cd ..\aka.gg-main
   npm run dev
   ```

3. Open http://localhost:8080

The .env has been set to use localhost:4000 for the API. If your backend is elsewhere, edit .env and restart the Vite dev server.

The companion's waiting/pre-match experience is now the literal atakgg web interface (embedded). This fulfills the goal of using the same app for campeones, runas, rangos (region/world as implemented in the profile pages), so that improving the web automatically benefits the desktop companion for the "espera" phase. In-game and champ-select specific views stay as native dedicated UIs (small resizable HUD + AI).

You navigate the full site inside the embed while waiting; the app switches seamlessly to the custom in-game view on match start (LCD authoritative).
