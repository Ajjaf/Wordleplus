# Deployment & Operations Guide

## Architecture Overview

```
┌─────────────┐       ┌──────────────────┐       ┌────────────┐
│   Client    │──────>│   Server         │──────>│ PostgreSQL │
│  (Vite SPA) │  WS   │  Express +       │ Prisma│  (Neon /   │
│  Vercel /   │  HTTP  │  Socket.IO       │       │  Supabase) │
│  Netlify    │       │  Railway / Render │       │            │
└─────────────┘       └──────────────────┘       └────────────┘
                             │
                             ▼
                        ┌─────────┐
                        │ Sentry  │
                        └─────────┘
```

The client is a static SPA that connects to the backend via HTTP (REST endpoints) and WebSocket (Socket.IO). Game state is held in-memory on the server; the database stores users, daily puzzles, results, and sessions.

## Environment Variables

All variables are documented in `.env.example`. Below are the production-critical ones.

### Required

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Must include `sslmode=require` for hosted Postgres |
| `SESSION_SECRET` | (random 32+ chars) | Generate with `openssl rand -base64 32` |
| `NODE_ENV` | `production` | Enables production CORS, helmet CSP, static file serving |
| `PORT` | `8080` | Usually set by your hosting provider |
| `BASE_URL` | `https://wordleplus.com` | Public frontend origin, no trailing slash |
| `CORS_ALLOWED_ORIGINS` | `https://wordleplus.com` | Comma-separated allowed origins |

### Auth (if enabled)

| Variable | Notes |
|---|---|
| `ISSUER_URL` | OIDC provider discovery URL |
| `GOOGLE_CLIENT_ID` | OAuth client ID configured for production redirect URIs |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `REPL_ID` | Client ID for Replit auth |
| `REPLIT_DOMAINS` | Backend hostname(s) for auth callbacks |

### Monitoring (recommended)

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Server-side Sentry DSN |
| `VITE_SENTRY_DSN` | Client-side Sentry DSN (set at build time) |
| `SENTRY_ENVIRONMENT` | `production` |

## Deployment Process

### 1. Database

```bash
cd server
npx prisma migrate deploy
npx prisma migrate status   # Verify all migrations applied
```

### 2. Backend

The server entry point is `server/index.js`. Start command:

```bash
NODE_ENV=production node index.js
```

The pre-deploy script validates config and runs tests:

```bash
npm run predeploy
```

### 3. Frontend

Build with the production backend URL:

```bash
cd client
VITE_SERVER_URL=https://api.yourdomain.com npm run build
```

Deploy the `client/dist/` directory. Configure your host to return `index.html` for all routes (SPA fallback).

### 4. Verify

```bash
BASE_URL=https://api.yourdomain.com bash server/scripts/post-deploy-verify.sh
```

## Health Check Endpoints

| Endpoint | Purpose | Healthy | Degraded |
|---|---|---|---|
| `GET /health` | Full status (DB, word lists, rooms) | `200` | `503` |
| `GET /ready` | Word lists loaded | `200` `{ ready: true }` | `503` |
| `GET /alive` | Process is running | `200` `{ alive: true }` | — |

Configure your hosting provider's health check to poll `/alive` or `/ready`.

## Monitoring

### Sentry

Both client and server report errors to Sentry when the DSN is configured. The server also captures CORS rejections as warnings.

Check the Sentry dashboard for:
- Unhandled exceptions
- CORS rejection patterns
- Performance traces

### Uptime

Set up an external monitor (UptimeRobot, Better Uptime) to poll `GET /alive` every 60 seconds. Alert on 2+ consecutive failures.

### Logs

The server logs to stdout. Key log messages:

| Message | Meaning |
|---|---|
| `Server listening on {port}` | Startup successful |
| `[words] Loaded N solutions` | Word lists loaded |
| `CORS rejected: {origin}` | Blocked cross-origin request |
| `[session-cleanup] Deleted N expired sessions` | Periodic session cleanup ran |

## Troubleshooting

### Socket.IO connections fail

- Verify `CORS_ALLOWED_ORIGINS` includes the frontend origin
- Check that the client's `VITE_SERVER_URL` points to the correct backend
- Ensure WebSocket upgrade is not blocked by a proxy (configure your reverse proxy to pass `Upgrade` headers)

### Database connection errors

- Verify `DATABASE_URL` is correct and includes `?sslmode=require`
- Check `GET /health` — the `database` field shows `connected` or `disconnected`
- Run `npx prisma db execute --stdin <<< "SELECT 1"` to test connectivity

### Auth not working

- Verify `REPLIT_DOMAINS` matches your backend hostname
- Verify OAuth redirect URIs in your identity provider include `https://yourdomain.com/api/callback`
- Check server logs for OIDC discovery errors

### Word lists not loading

- Check `GET /ready` — returns `{ ready: false }` if word lists failed to load
- Verify `words.txt` and `allowed_guesses.txt` exist in the server directory
- Check server startup logs for `[words] Loaded` messages

### High memory usage

- Room state is in-memory. Many concurrent rooms will increase memory.
- Disconnected players are kept for reconnection. Rooms are not automatically cleaned up.
- The session cleanup job runs hourly and removes expired Prisma sessions.

## Session Architecture

The server uses two independent session systems:

1. **Express session** (`express-session` + `connect-pg-simple`) — Cookie-based HTTP sessions for OAuth login flow. Stored in `public.session` table.

2. **Prisma Session** (`Session` model) — Tracks anonymous device IDs for the daily challenge. Cleaned up hourly by `server/jobs/cleanupSessions.js`.

These are separate systems with separate lifecycles.

## Rate Limiting

| Scope | Limit |
|---|---|
| `GET/POST /api/*` | 100 requests / 15 min per IP |
| `POST /api/login`, `/api/callback` | 10 requests / 15 min per IP |
| Socket: `createRoom` | 5 per minute per socket |
| Socket: `joinRoom` | 10 per minute per socket |
| Socket: `makeGuess` | 10 per minute per socket |
