# WordlePlus

A multiplayer Wordle game with real-time competitive modes. Challenge friends to 1v1 duels, race against a lobby in Battle Royale, or tackle the daily puzzle.

## Game Modes

**Duel** — Two players each set a secret 5-letter word for the other to guess. Six attempts, timed rounds. The player who solves first (or in fewer guesses) wins.

**Battle Royale** — A host picks a word and starts the round. Any number of players race to solve it first. First correct guess wins.

**Battle AI** — Like Battle Royale, but the server automatically picks words and starts rounds on a timer. Drop in and play anytime.

**Daily Challenge** — A single puzzle that changes every day. Track your streak, compare stats, and compete on the leaderboard.

**Shared** — Cooperative mode where players take turns guessing a shared word.

## Features

- Real-time multiplayer via WebSocket (Socket.IO)
- Animated game board with color-coded feedback (green / yellow / gray)
- On-screen keyboard with letter state tracking
- Player reconnection — drop out and rejoin with the same name
- Rematch support in Duel and Battle modes
- Leaderboard with top players and win streaks
- Mobile-responsive design with keyboard and touch support
- Accessibility: ARIA labels, screen reader announcements, keyboard navigation

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL via Prisma ORM |
| Auth | OpenID Connect (Passport.js) + anonymous sessions |
| Monitoring | Sentry (client + server), health check endpoints |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd Wordleplus
cd server && npm install
cd ../client && npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL

# 3. Set up database
cd server
npx prisma migrate dev
npx prisma db seed

# 4. Start development
cd server && npm run dev     # Backend on :8080
cd client && npm run dev     # Frontend on :5000
```

Open http://localhost:5000 to play.

## Project Structure

```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI (Board, Keyboard, VictoryModal)
│   │   ├── screens/        # Page-level components (Home, Duel, Battle, Daily)
│   │   ├── hooks/          # Game logic hooks (useGameState, useDuelGame, etc.)
│   │   └── modes/          # Mode-specific actions, selectors, screens
│   └── vite.config.js
├── server/                 # Node.js backend
│   ├── modes/              # Game mode logic (duel, battle, shared)
│   ├── config/             # Centralized environment config
│   ├── middleware/          # Rate limiting
│   ├── prisma/             # Schema, migrations, seed
│   ├── tests/              # Unit + integration tests
│   └── index.js            # Express + Socket.IO entry point
├── .env.example            # All environment variables documented
├── DEPLOY_CHECKLIST.md     # Production deployment guide
└── CONTRIBUTING.md         # Developer onboarding
```

## Documentation

- [Contributing Guide](CONTRIBUTING.md) — development setup, workflow, and PR process
- [Deployment Checklist](DEPLOY_CHECKLIST.md) — production deployment steps
- [Deployment & Ops Guide](DEPLOYMENT.md) — environment variables, monitoring, troubleshooting
- [Migration Strategy](server/prisma/MIGRATIONS.md) — database migration procedures
- [Changelog](CHANGELOG.md) — version history

## Post-Launch Checklist

After deploying v1.0:

1. **Monitor error rates** — Watch Sentry for the first 24 hours, triage any new errors
2. **Track performance** — Check `/health` response times, database query latency, bundle load times
3. **Gather feedback** — Share with users, collect bug reports and feature requests
4. **Triage** — File issues into a backlog, label by priority
5. **Plan v1.1** — Prioritize from the roadmap below based on user feedback

## Roadmap (v1.1)

| Feature | Status | Notes |
|---|---|---|
| Leaderboard | Shipped in v1.0 | Top players and streaks |
| Audio feedback | Planned | Sound effects for guesses, wins, errors |
| Player color indicators | Planned | Distinguish players visually in multiplayer |
| TypeScript migration | Planned | Incremental, starting with server |
| Advanced analytics | Planned | Game event tracking, play patterns |
| PWA support | Planned | Offline daily challenge, install prompt |

## License

MIT
