# Production Deployment Checklist

## Infrastructure Setup

- [ ] **Hosting selected** — backend: Railway / Render / Fly.io; frontend: Vercel / Netlify / same host
- [ ] **PostgreSQL database** — Neon, Supabase, or managed Postgres with connection pooling
- [ ] **Domain name** configured with DNS pointing to hosting provider
- [ ] **SSL certificates** active (auto via host, or Cloudflare)
- [ ] **CDN** for static assets (optional — Vercel/Netlify include this)

## Environment Variables

Copy `.env.example` and set every value for production:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Production Postgres connection string with `?sslmode=require` |
| `SESSION_SECRET` | Yes | Strong random string (`openssl rand -base64 32`) |
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | Yes | Usually set by host (default 8080) |
| `BASE_URL` | Yes | Public frontend origin, no trailing slash |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated production origins |
| `ISSUER_URL` | If auth | OIDC discovery endpoint |
| `GOOGLE_CLIENT_ID` | If auth | OAuth client ID for production redirect URI |
| `GOOGLE_CLIENT_SECRET` | If auth | OAuth client secret |
| `REPL_ID` | If auth | Same as client ID on Replit |
| `REPLIT_DOMAINS` | If auth | Backend host(s) for login/callback |
| `SENTRY_DSN` | Recommended | Server-side error tracking |
| `VITE_SENTRY_DSN` | Recommended | Client-side error tracking |
| `SENTRY_ENVIRONMENT` | Recommended | `production` |
| `CORS_ALLOWED_ORIGIN_SUFFIXES` | Optional | e.g. `.vercel.app` for preview deploys |

## Pre-Deploy

```bash
# Run the automated pre-deploy checks
cd server
npm run predeploy
```

This runs `scripts/pre-deploy.sh` which verifies:
- `DATABASE_URL` is set
- Database is reachable
- Prisma Client is generated
- Migration status is clean

### Manual checks

```bash
# Build client
cd client && npm run build

# Run all server tests
cd server && npm test

# Security audit
cd server && npm audit
cd client && npm audit
```

## Deployment Steps

### 1. Database

```bash
cd server
npx prisma migrate deploy
```

Verify migration applied:
```bash
npx prisma migrate status
```

### 2. Backend

Deploy the `server/` directory. Ensure the start command is:
```bash
NODE_ENV=production node index.js
```

Health check endpoint: `GET /health` — returns `200` when healthy, `503` when degraded.

### 3. Frontend

Build and deploy the `client/` directory:
```bash
cd client
VITE_SERVER_URL=https://api.yourdomain.com npm run build
```

Deploy the `dist/` folder. Configure the host to serve `index.html` for all routes (SPA fallback).

### 4. Verify

```bash
# Health check
curl https://api.yourdomain.com/health

# Readiness (word lists loaded)
curl https://api.yourdomain.com/ready

# Liveness
curl https://api.yourdomain.com/alive

# CORS check — should include Access-Control-Allow-Origin
curl -I -H "Origin: https://yourdomain.com" https://api.yourdomain.com/health
```

Or run the automated verification:
```bash
cd server
BASE_URL=https://api.yourdomain.com bash scripts/post-deploy-verify.sh
```

### 5. Smoke Test

Open the app in a browser and manually verify:
- [ ] Home screen loads
- [ ] Can create a Duel room
- [ ] Can join a room from another tab/device
- [ ] Guesses are scored correctly
- [ ] Daily challenge loads and saves progress
- [ ] Battle Royale mode works with 2+ players

## Post-Deploy Monitoring

- [ ] **Sentry** — Verify events are flowing: check Sentry dashboard for the `production` environment
- [ ] **Uptime monitoring** — Set up UptimeRobot / Better Uptime to poll `/alive` every 60s
- [ ] **Alerts** — Configure Sentry alert rules for error spikes
- [ ] **Database** — Monitor connection count and query latency via your Postgres provider dashboard
- [ ] **Logs** — Verify structured logging is accessible in your hosting provider's log viewer

## Rollback

If something goes wrong:

1. **Backend** — Redeploy the previous working version via your hosting provider's dashboard or `git revert`
2. **Database** — Follow `server/prisma/MIGRATIONS.md` for rollback procedures
3. **Frontend** — Redeploy previous build (Vercel/Netlify have instant rollback)

## Ongoing

- Run `npm audit` weekly
- Keep dependencies updated (`npm outdated`)
- Review Sentry errors weekly
- Monitor bundle size with `npm run build:analyze` in the client
