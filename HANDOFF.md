# ATAK.GG — Handoff Document
> Última actualización: 2026-06-30
> Repositorio: https://github.com/ChristianJair27/atakgg
> Owner: Christian (christianjair27@gmail.com)

---

## ¿Qué es ATAK.GG?

Plataforma de coaching para League of Legends con tres componentes integrados:

| Componente | Tecnología | Rol |
|---|---|---|
| **Web App** (`aka.gg-main`) | React + Vite + TypeScript | UI pública — perfil, torneos, brackets |
| **Backend API** (`sniperlol-main`) | Node.js + Express + TypeScript | Proxy LCU, OP.GG API, stats |
| **Overwolf Companion** (`atak-overwolf-companion`) | HTML/JS + Overwolf SDK | Overlay en juego, detección LCU |

---

## Cómo levantar el proyecto localmente

```bash
# Backend
cd sniperlol-main && npm install && npm run dev   # Puerto 8080

# Web app
cd aka.gg-main && npm install && npm run dev      # Puerto 5173

# Overwolf companion
# Cargar como extensión desempaquetada en Overwolf Developer Tools
# El manifest.json apunta a los archivos locales
```

---

## Lo que la app puede hacer HOY

### Overwolf Companion (overlay en juego)

**`home.html`** — Ventana principal al abrir ATAK
- Se conecta al LCU automáticamente (retry cada 2s hasta 50s)
- Navega directo al perfil del invocador detectado
- La región se obtiene de `/riotclient/region-locale` (clientes modernos ya no devuelven `platformId` en `/lol-summoner/v1/current-summoner`)
- Fallback: botón "Abrir sin perfil" si League no está abierto

**`champ_select.html`** — Panel durante selección de campeones
- Invocadores aliados y enemigos con sus campeones
- Rank Solo/Duo y Flex con winrate y LP
- Stats del campeón seleccionado desde OP.GG (WR%, partidas)
- Maestría con el campeón
- Recomendación de build via IA

**`queue_profile.html`** — Mini-perfil durante cola
- Perfil resumido del invocador local mientras espera partida

**`in_game.html` + `in_game.js`** — Overlay durante partida
- Stats en tiempo real del jugador local (KDA, CS, daño)
- Toggle: **F9**

**`player_stats.html`** — Panel de 10 jugadores estilo Porofessor (NUEVO)
- Toggle: **Ctrl+Shift+S** durante partida
- Grid de 10 jugadores: campeón, nombre, rank, WR% del campeón (OP.GG), KDA y CS en vivo
- Datos OP.GG pre-cargados desde champ select, actualizados con polling in-game
- Etiquetas automáticas por jugador

**`end_of_game.html`** — Resumen al final de partida
- Hero strip: stats completos del jugador local
- Scoreboard de 10 jugadores con 7 columnas (identidad, rendimiento, items, KDA, CS, KP%, daño)
- **Etiquetas de rendimiento por jugador** (columna RENDIMIENTO):
  `PENTA KILL`, `QUADRA KILL`, `TRIPLE KILL`, `INMORTAL`, `SE RINDIÓ`,
  `CARRY DE DAÑO`, `POCO DAÑO`, `DESTRUCTOR`, `BUENA VISIÓN`, `CIEGA`,
  `DEJO DE FARMEAR`, `GRANJERO ELITE`, `SIEMPRE PRESENTE`, `ASISTENTE PRO`, `ÁVARO`
- MVP calculado por (K+A)/muertes + porcentaje de daño relativo
- Detección de remake (partida < 3 min)
- Soporte Arena (modo CHERRY)
- Nombres de invocador con fallback Riot-ID: `gameName#tagLine`

### Web App (`aka.gg-main`)

- **ProfilePage**: Perfil estilo Porofessor — rank, campeones más jugados, historial
- **Torneos**: Sistema completo con brackets, equipos, invitaciones, privacidad por código
- **Autenticación**: Login/Registro con marca ATAK

### Backend API (`sniperlol-main`)

- LCU proxy: `/api/lcu/*` — bypass TLS/CORS del cliente de League
- Stats: `/api/stats/:region/:name`
- **OP.GG proxy** (NUEVO): `/api/opgg/summoner`, `/api/opgg/champion`, `/api/opgg/summoner-full`
- Champ select: `/api/champ-select/*` con summoner info + mastery

---

## Arquitectura técnica clave

### Flujo de datos

```
LCU (lockfile) ──── background.js ──── sendMessage ──── ventanas overlay
Port 2999       ──── background.js (poll 2s) ─────────── in_game / player_stats
OP.GG MCP API  ──── sniperlol backend ──── cache ──────── champ_select / player_stats
```

### Variables globales críticas en background.js

| Variable | Descripción |
|---|---|
| `lcuPort`, `lcuPass` | Credenciales LCU (del lockfile) |
| `lcuPlatform` | Región: "LA1", "NA1", etc. (de `/riotclient/region-locale`) |
| `gamePhase` | Fase actual: Lobby / Queue / ChampSelect / InProgress / EndOfGame / None |
| `playerRankCache` | `summonerName → rankData` — se limpia al salir de InProgress |
| `playerOpggCache` | `summonerName → opggData` — persiste desde champ select hasta fin de partida |
| `currentGameState` | Datos completos de port-2999 (todos los jugadores en vivo) |
| `homeWindowId`, `champSelWindowId`, `playerStatsWindowId` | IDs de ventanas activas |

### Formato de nombres de invocadores

- Clientes modernos Riot ID: `summonerName = ""` — usar `gameName + "#" + tagLine`
- LCU champ select usa `"Nombre"` sin tag; port-2999 usa `"Nombre#TAG"`
- `getPlayerName(p)` en `end_of_game.html` y `findByName()` en `player_stats.html` manejan todos los casos

### Hotkeys configurados

| Hotkey | Acción |
|---|---|
| F9 | Toggle overlay in-game (`toggle_app`) |
| Ctrl+Shift+S | Toggle player stats panel (`toggle_scoreboard`) |

---

## Cómo compartir la app con amigos

### Opción A — Solo la web (más fácil, sin instalar nada)
- URL de producción: `https://atakgg.revolution505.com`
- Pueden ver perfiles de invocadores, torneos, brackets
- Sin instalación requerida

### Opción B — Overlay completo (Overwolf)
1. Instalar **Overwolf** en su PC
2. Cargar la extensión desde Developer Tools (`atak-overwolf-companion/`)
3. El backend debe correr en su máquina (`npm run dev` en `sniperlol-main`) O apuntar a la URL de producción
4. El overlay se activa automáticamente al abrir League of Legends

### Para crear una versión instalable (.opk)
```bash
# Desde el Developer Tools de Overwolf:
# Package > Create OPK
# Distribuir el archivo .opk por Discord, drive, etc.
```

---

## Próximos pasos recomendados

### Alta prioridad — bugs activos

1. **Items en EOG** — Si `ITEM0-ITEM6` están vacíos en el EOG del LCU (algunos clientes), el fallback a `p.items[]` puede no cubrir todos los casos. Loguear `JSON.stringify(p.stats)` en una partida real para confirmar los field names exactos.

2. **Player stats sin champ select** — Si el usuario abre la ventana Ctrl+Shift+S en mitad de una partida sin haber pasado por champ select, los datos OP.GG estarán vacíos. Agregar botón "Recargar" que dispare `fetchMissingRanks` desde in-game.

3. **OP.GG rate limits** — El proxy OP.GG MCP no tiene manejo de rate limits ni caché persistente. Si muchos usuarios lo usan simultáneamente puede fallar.

### Media prioridad — features nuevas

4. **Build advisor en juego** — En `in_game.html`, mostrar el build recomendado del campeón (items en orden de compra). Los datos ya están disponibles desde OP.GG vía `/api/opgg/summoner-full`.

5. **Historial en EOG** — Después del resumen de la partida, mostrar las últimas 5 partidas del jugador. El backend ya tiene el endpoint de stats.

6. **Draft counter en champ select** — Basado en los picks enemigos en tiempo real, sugerir contra-picks usando winrate data de OP.GG.

7. **Auto-registro de resultados de torneo** — Al terminar una partida de torneo, que el EOG auto-registre el resultado en el sistema de torneos de la web app.

8. **Notificaciones de torneo** — Cuando un torneo en el que participas está por empezar, mostrar notificación en el overlay.

### Largo plazo

9. **Modo espectador** — Panel de stats para quien está viendo una partida de torneo en modo espectador.

10. **Analytics de torneo** — Dashboard con gráficas por equipo, campeón más usado en torneo, KDA promedio, etc.

11. **Bot de Discord** — Anuncia resultados de torneo, muestra stats de jugadores, integrado con la web app.

12. **Mobile** — App React Native que muestre stats de partida en tiempo real desde el teléfono (via WebSockets al backend).

---

## Estrategia de agentes y automatización

### MCPs ya integrados

- **OP.GG MCP** (`https://mcp-api.op.gg/mcp`) — Herramientas: `lol_get_summoner_profile`, `lol_get_summoner_rank`, `lol_get_champion_stats`

### MCPs recomendados para agregar

| MCP | Para qué |
|---|---|
| **Riot Games API MCP** | Datos oficiales de partidas, maestría, historial permanente |
| **Supabase MCP** | Gestionar DB de torneos directamente desde el agente |
| **Vercel / Railway MCP** | Deploy automático del backend desde el agente sin salir del chat |
| **Discord MCP** | Enviar resultados de torneo a servidores de Discord automáticamente |
| **Cloudinary MCP** | Subir y optimizar imágenes de perfil y torneos |

### Skills recomendadas (comandos `/`)

Skills son atajos contextualizados para tareas frecuentes:
- `/deploy` — Build y deploy completo del backend + frontend
- `/test-overlay` — Checklist de pruebas del overlay contra LCU en vivo
- `/generate-post` — Genera contenido de redes sociales sobre un feature o resultado de torneo
- `/review-pr` — Code review con contexto completo del proyecto ATAK

### Routines (triggers automáticos)

- **Agente QA nocturno**: cada noche revisa los cambios del día y reporta posibles regresiones
- **Agente de contenido semanal**: genera 3 posts de Instagram + 1 guión de TikTok sobre el feature más reciente
- **Backup automático**: exporta la DB de torneos a un archivo seguro semanalmente

---

## Estrategia de contenido y crecimiento

### Formatos de contenido por red

**TikTok / Reels / Shorts** (corto, alto alcance):
- "Así se ve el overlay de ATAK.GG en una partida real" — captura el panel in-game
- "¿Quién fue el MVP?" — muestra el end_of_game con etiquetas de rendimiento
- "Crea tu torneo gratis en 60 segundos" — demo rápido del sistema de torneos
- "Tu rival lleva 65% WR con ese campeón 😬" — panel de champ select mostrando datos OP.GG

**Instagram posts / stories**:
- Capturas del UI con stats reales (con permiso de los jugadores)
- Infografías de tips usando datos de ATAK
- Resultados de torneos con el bracket visual
- Behind the scenes del desarrollo

### Propuesta de valor para el contenido

- **Gratis vs Porofessor** (que es premium) — diferenciador principal
- **Torneos gratuitos** para comunidades, streamer y sus viewers
- **Hecho en LAN/LATAM**, en español, entiende la región
- **Todo integrado**: overlay + perfil + torneos en un solo lugar

### Funnel de crecimiento sugerido

```
TikTok/Reels mostrando overlay
        ↓
Usuario instala Overwolf + ATAK companion
        ↓
Ve su perfil y el de sus compañeros
        ↓
Crea o se une a un torneo gratuito
        ↓
Comparte resultados en redes → nuevo ciclo
```

### El diferenciador más fuerte: Torneos gratuitos

1. Content creator crea un torneo en ATAK.GG → comparte el código con su comunidad
2. Los viewers participan gratis, se forman equipos
3. El overlay muestra stats en tiempo real durante las partidas del torneo
4. Los resultados se registran automáticamente → bracket se actualiza
5. Genera contenido orgánico (clips del EOG con etiquetas, bracket screenshots)

---

## Para el próximo agente: contexto esencial

**Repo local**: `G:\ATAKGG\atakgg`
**Repo remoto**: `https://github.com/ChristianJair27/atakgg`
**Branch principal**: `master`

**Primer paso**: leer este HANDOFF.md + `atak-overwolf-companion/background.js` (cerebro del overlay) + `sniperlol-main/src/server.ts` (entry point del backend).

**Limitaciones actuales conocidas**:
- Backend debe correr en local o en `https://atakgg.revolution505.com`
- OP.GG data es best-effort / cache, no garantizada en tiempo real
- Overlay solo en Windows con Overwolf
- No hay suite de tests automatizados — pruebas son manuales con League abierto
- `lcuPlatform` (región) se obtiene de `/riotclient/region-locale` porque `/lol-summoner/v1/current-summoner` ya no devuelve `platformId` en clientes modernos

**Convenciones de código**:
- Ventanas overlay: HTML/CSS/JS vanilla (sin frameworks)
- Backend: TypeScript, Express, sin ORM
- Web app: React + React Query + Axios, estilos con Tailwind o CSS-in-JS
- Comentarios solo cuando el "por qué" no es obvio, nunca el "qué"
