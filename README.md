# ATAK.GG — LoL Stats & Tournament Platform

> AI-powered League of Legends stats tracker, tournament organizer, and live in-game coaching overlay.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      ATAK.GG Platform                   │
├──────────────────────┬──────────────────────────────────┤
│   aka.gg-main        │   sniperlol-main                 │
│   React + Vite SPA   │   Node.js / Express API          │
│   Nginx (port 80)    │   (port 4000)                    │
│                      │   ┌─────────────────────────┐   │
│   • Player profiles  │   │ MySQL (Hostinger/Cloud) │   │
│   • Match history    │   └─────────────────────────┘   │
│   • Tournaments      │   ┌─────────────────────────┐   │
│   • Live game view   │   │ Ollama (local AI)        │   │
│                      │   │ llama3.1:8b              │   │
│                      │   └─────────────────────────┘   │
├──────────────────────┴──────────────────────────────────┤
│              Desktop Companions (local only)             │
│   atak-overwolf-companion  │  atak-electron-companion   │
│   Overwolf WebApp          │  Electron desktop app      │
│   • In-game overlay        │  • Same overlay via        │
│   • Arena augment guide    │    native window           │
│   • Live LCU polling       │  • LCU polling             │
│   • Local AI coaching      │                            │
└─────────────────────────────────────────────────────────┘
```

---

## Services

| Directory | Type | Port | Deploy |
|---|---|---|---|
| `sniperlol-main` | Node.js API | 4000 | Docker → Coolify |
| `aka.gg-main` | React SPA (Nginx) | 80 | Docker → Coolify |
| `atak-overwolf-companion` | Overwolf app | — | Sideloaded / Store |
| `atak-electron-companion` | Electron | — | Local build |

---

## Local Development

### Prerequisites
- Node.js 20+
- MySQL 8+
- Ollama (for AI features): https://ollama.com — run `ollama pull llama3.1:8b`

### Backend (`sniperlol-main`)

```bash
cd sniperlol-main
cp .env.example .env        # fill in your values
npm install
npm run dev                 # tsx watch — auto-reloads on save
```

Backend runs on `http://localhost:4000`.

### Frontend (`aka.gg-main`)

```bash
cd aka.gg-main
cp .env.example .env        # set VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # Vite dev server on http://localhost:8080
```

Vite dev server proxies `/api` and `/auth` to `localhost:4000` automatically.

### Overwolf Companion (`atak-overwolf-companion`)

1. Open Overwolf Developer Tools (`Ctrl+Shift+I` in Overwolf client)
2. Load unpacked extension → select `atak-overwolf-companion/`
3. Launch League of Legends — the overlay appears automatically

---

## Environment Variables

### Backend — `sniperlol-main/.env`

| Variable | Description |
|---|---|
| `PORT` | API listen port (default `4000`) |
| `RIOT_API_KEY` | Riot Games API key from developer.riotgames.com |
| `MYSQL_HOST` | MySQL hostname |
| `MYSQL_USER` | MySQL user |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DB` | MySQL database name |
| `CORS_ORIGIN` | Comma-separated allowed origins (your frontend domain) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (`https://your-backend/auth/google/callback`) |
| `WEB_ORIGIN` | Frontend domain (used in OAuth redirects) |
| `CLIENT_URL` | Frontend domain (same as WEB_ORIGIN) |
| `JWT_SECRET` | Random string for JWT signing — use a strong secret in prod |
| `DEFAULT_PLATFORM` | Default LoL region code (`la1`, `na1`, `euw1`, …) |
| `RIOT_STUB_MODE` | `true` = test tournament API, `false` = real production API |
| `RIOT_REGION` | Tournament region (`LAN`, `NA`, `EUW`, …) |
| `TOURNAMENT_CALLBACK_URL` | Webhook URL for Riot tournament callbacks |

### Frontend — `aka.gg-main/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL (baked into the JS bundle at build time) |

> **Note:** In Coolify, set `VITE_API_URL` as a **build argument**, not a runtime environment variable. Vite bakes it into the static JS at build time.

---

## Deployment on Coolify

Coolify is a self-hosted PaaS (like Heroku) that builds and runs Docker containers from your GitHub repo.

### One-time Setup

1. Install Coolify on your server: https://coolify.io/docs/installation
2. Add your GitHub account as a source in Coolify Settings → Sources
3. Have your MySQL database ready (Hostinger, PlanetScale, Railway, etc.)

---

### Service 1 — Backend API (`sniperlol-main`)

1. **New Resource** → Application → GitHub → select this repo
2. **Build Pack**: `Dockerfile`
3. **Dockerfile location**: `sniperlol-main/dockerfile`
4. **Base directory**: `sniperlol-main`
5. **Port**: `4000`
6. **Domain**: e.g. `atakback.yourdomain.com`
7. **Environment Variables** — add all vars from `sniperlol-main/.env.example`:

```env
PORT=4000
RIOT_API_KEY=RGAPI-...
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DB=...
CORS_ORIGIN=https://your-frontend-domain.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://atakback.yourdomain.com/auth/google/callback
WEB_ORIGIN=https://your-frontend-domain.com
CLIENT_URL=https://your-frontend-domain.com
JWT_SECRET=<strong-random-secret>
DEFAULT_PLATFORM=la1
RIOT_STUB_MODE=false
RIOT_REGION=LAN
TOURNAMENT_CALLBACK_URL=https://atakback.yourdomain.com/api/tournaments/tournament-callback
```

8. **Deploy** → Coolify builds the Docker image and starts the container.
9. Health check endpoint: `GET /api/health` → `{ ok: true }`

---

### Service 2 — Frontend SPA (`aka.gg-main`)

1. **New Resource** → Application → GitHub → select this repo
2. **Build Pack**: `Dockerfile`
3. **Dockerfile location**: `aka.gg-main/dockerfile`
4. **Base directory**: `aka.gg-main`
5. **Port**: `80`
6. **Domain**: e.g. `atakgg.yourdomain.com`
7. **Build Arguments** (not env vars — these are baked in at build time):

```
VITE_API_URL=https://atakback.yourdomain.com
```

8. **Deploy** → Coolify builds React app with Vite, serves via Nginx.
9. Health check endpoint: `GET /healthz` → `ok`

---

### Auto-Deploy on Push

In Coolify, enable **Auto Deploy** on the main branch for both services. Every `git push` to `master`/`main` will trigger a rebuild and rolling restart with zero downtime.

---

## AI Features (Local — Overwolf Companion)

The Overwolf companion talks to the backend for AI coaching. In production, the backend tries to reach Ollama on `localhost:11434` — this works when both the backend **and** Ollama run on the same machine.

If your Coolify server doesn't have a GPU, disable the AI routes or set `OLLAMA_URL` to point at a separate GPU machine.

```bash
# On any machine with a GPU:
ollama pull llama3.1:8b
ollama serve         # listens on :11434
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Radix UI, GSAP, Three.js |
| Backend | Node.js 20, Express 5, TypeScript, MySQL 2, Zod |
| AI | Ollama + llama3.1:8b (local inference) |
| Overlay | Overwolf SDK (game ID 5426), GEP events |
| Desktop | Electron |
| Infra | Docker, Nginx, Coolify, MySQL |
