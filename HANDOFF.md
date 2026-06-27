# ATAK.GG — Handoff / Estado y pendientes

Documento para retomar el trabajo (p. ej. en otra computadora desde el repo).

## 🖥️ Cómo continuar en otra compu
1. **Clonar**: `git clone https://github.com/ChristianJair27/atakgg.git` (rama `master` o `integration` — ambas tienen todo).
2. **Requisitos**: Node 20+ (se usó v24), Git. Opcional: **Ollama** (IA de champ-select/coach) y **ffmpeg** (re-encodear videos de fondo).
3. **Instalar dependencias por subproyecto**:
   ```
   cd sniperlol-main        && npm install
   cd ../aka.gg-main        && npm install
   cd ../atak-electron      && npm install
   cd ../atak-electron-companion && npm install
   ```
4. **Crear los `.env`** (NO están en el repo, son gitignored). Copia `*.env.example` → `.env` y llena los valores reales (los tienes en tu `.env` actual / servidor de prod):
   - `sniperlol-main/.env`  (Riot key, MySQL, JWT, Google, RSO, etc.)
   - `aka.gg-main/.env`     (`VITE_API_URL=http://localhost:4000`)
5. **Ollama** (para champ-select IA y coach): instala Ollama y `ollama pull llama3.1:8b`.
6. **ffmpeg** (para re-encodear el video de fondo con keyframes densos): `winget install Gyan.FFmpeg`.
7. **Correr**:
   ```
   # backend  :4000
   cd sniperlol-main && npm run dev
   # frontend :8080
   cd aka.gg-main && npm run dev
   # overlay in-game (ow-electron)
   cd atak-electron && npm run build && npx ow-electron .
   # companion ventana flotante (sin Overwolf)
   cd atak-electron-companion && npx vite
   ```

## 🧱 Arquitectura
- **sniperlol-main** — backend Node/Express/TS. Proxy de Riot (API key server-side), stats, torneos (Tournament-V5), auth (local/Google/**RSO**), champ-select con IA. DB **MySQL remota** (Hostinger).
- **aka.gg-main** — frontend React + Vite + TS + Tailwind. Perfil tipo Porofessor (`/profile/:region/:name` y `/stats/:region/:name`), detalle de partida (`/match/:region/:matchId`), torneos, social, dashboard. Fondo vivo `ScrollVideoBg`.
- **atak-electron** — overlay in-game (ow-electron): HUD live, champ-select, End of Game. Con **fallback de ventana normal** cuando el OSR no está disponible.
- **atak-electron-companion** / **atak-overwolf-companion** — companions alternativos.

## ✅ Hecho (resumen)
- Higiene + seguridad + auto-resultado de **torneos**; rediseño UX de torneos (glass + shadcn).
- Overlays rediseñados (liquid glass + loader Katarina 3D + daga).
- **Perfil** estilo Porofessor: rango (fix `league/v4/entries/by-puuid`), maestrías, partidas, detalle con gráficos, jugadores recientes clickeables, top%/rango regional (apex exacto / resto estimado), iconos arreglados (items/runas/rangos).
- **RSO** (login con Riot) implementado (backend + botón).
- **Fondo vivo** scroll-scrubbed (daga) + glass minimalista en Profile, Tournaments, Social, Home (sección), Dashboard.
- Champ-select: recomendaciones **IA reales por campeón** (Ollama), cacheadas, sin random.

## ⏳ Pendientes
### RSO (producción)
- La redirect registrada es del **frontend** (`https://atakgg.revolution505.com/auth/callback`) pero el código usa **backend** (`/auth/riot/callback`). Para prod: **registrar** `https://atakback.revolution505.com/auth/riot/callback` en RSO **o** refactorizar al patrón frontend-callback.
- Poner `RSO_CLIENT_SECRET` real en el `.env` de prod. **No funciona en localhost** (RSO no acepta `http://localhost`).

### Perfil
- **Temporadas anteriores**: solo *forward* (tabla `profile_ranked_snapshots`); Riot no da histórico → se llena con el tiempo.
- **"Mejor jugador por campeón"**: best-effort actual (jugador mejor rankeado visto con ese champ). Falta pipeline real de leaderboard.
- **Rank regional/top%**: exacto solo apex (Master+); en tiers menores es **estimado** (tabla de distribución, marcado `estimated`).

### Dashboard
- "Próximo Torneo" (placeholder) y "Editar Perfil" (no-wired): faltan endpoints/handlers.

### Overlays (atak-electron)
- **OSR real bloqueado por el whitelist de Overwolf** (app que apunta a juego de Riot) — depende de aprobación de Overwolf. El **fallback de ventana plana** funciona (requiere LoL en **modo Sin bordes**).
- Champ-select en **Arena**: parseo de campeón devolvía `-3` — revisar.
- Estilo Porofessor "siempre visible" (rango/winrate por jugador en las filas) — pendiente.

### Augments (fase 2 estilo Porofessor)
- Pipeline propio de **pick/winrate de augments** desde Match-V5 + **GEP de Overwolf** (los augments ofrecidos en vivo no están en la Live Client Data pública; el GEP requiere el whitelist de Overwolf).

### Modelos 3D
- Slot del campeón con más maestría: dejar GLBs de baile en `aka.gg-main/public/models/champions/{ChampKey}.glb` (export desde modelviewer.lol, animación *dance*). El loader global usa `public/models/katarina.glb`.

### Video de fondo
- Compartido en `aka.gg-main/public/video/dagger-scroll.mp4` (re-encodeado `-g 1`). Para video distinto por página: cambiar el prop `src` de `<ScrollVideoBg>` de esa página. Re-encode para scrub: `ffmpeg -i in.mp4 -an -c:v libx264 -g 1 -crf 20 out.mp4`.

### Torneos
- El flujo de **generación REAL de códigos** contra Riot prod **aún no se probó end-to-end**. Para validar: `RIOT_STUB_MODE=true` o un código controlado. **No disparar creación real sin confirmar.**

### Limpieza / deuda técnica
- `SummonerPage.tsx` ya no se rutea (reemplazada por `ProfilePage`); hay un `TopBar` muerto en `ProfilePage` y `ScrollDagger.tsx` sin usar → se pueden borrar.
- Errores de typecheck **preexistentes** en algunos componentes (`ChampionDance3D`, `FeaturedPlayers`, `LiveGameVisualizer`, `RotatingText`, `SummonerPage`) — no afectan el build (Vite/esbuild). Limpiarlos cuando se pueda.

## 🌿 Ramas
- `master` y `integration`: contienen todo el trabajo.
- `feature/tournaments-hardening-redesign`, `feature/overlay-liquid-glass-redesign`: checkpoints por feature.
