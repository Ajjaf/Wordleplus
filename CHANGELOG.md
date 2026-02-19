# Changelog

All notable changes to WordlePlus are documented here.

## [1.0.0] - 2026-02-16

### Game Modes
- **Duel** — 1v1 mode with secret word exchange, 6-guess limit, timed rounds
- **Battle Royale** — Host picks a word, any number of players race to solve it
- **Battle AI** — Automated host with timed rounds and auto-start
- **Daily Challenge** — Single daily puzzle with streak tracking and leaderboard
- **Shared** — Cooperative turn-based guessing

### Features
- Real-time multiplayer via Socket.IO with reconnection support
- Animated game board with color-coded guess feedback
- On-screen keyboard with letter state tracking
- Player leaderboard (top players by wins and streaks)
- Mobile-responsive UI with Tailwind CSS and Framer Motion
- OAuth authentication with anonymous session fallback

### Infrastructure
- Centralized server configuration (`server/config/env.js`)
- Sentry error tracking (client and server)
- Helmet security headers with production CSP
- HTTP and Socket.IO rate limiting
- Health check endpoints (`/health`, `/ready`, `/alive`)
- Async word list loading with validation
- Simplified CORS with suffix matching and rejection logging
- Session cleanup background job
- Database migration strategy with pre-deploy and post-deploy scripts

### Testing
- 83 unit tests (game logic, sanitization, modes, health checks)
- 21 integration tests (full Socket.IO game flows for Duel, Battle, room management)
- ESLint with `jsx-a11y` accessibility rules

### Accessibility
- ARIA roles and labels on game board, keyboard, and modals
- Screen reader announcements for game outcomes
- `@axe-core/react` runtime audits in development

### Build
- Vite with manual chunk splitting (react-vendor, socket, ui-vendor)
- Lazy-loaded screen components for code splitting
- Bundle analyzer via `npm run build:analyze`

### Documentation
- Comprehensive `README.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`
- Production deployment checklist (`DEPLOY_CHECKLIST.md`)
- Database migration guide (`server/prisma/MIGRATIONS.md`)
- Full environment variable reference (`.env.example`)
