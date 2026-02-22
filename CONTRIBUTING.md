# Contributing to WordlePlus

## Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted — [Neon](https://neon.tech) free tier works)
- Git

## Setup

```bash
git clone <repo-url> && cd Wordleplus

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL at minimum

# Initialize the database
cd server
npx prisma migrate dev
npx prisma db seed
```

## Development Workflow

Start both processes in separate terminals:

```bash
# Terminal 1 — Backend (port 8080)
cd server && npm run dev

# Terminal 2 — Frontend (port 5000)
cd client && npm run dev
```

The Vite dev server proxies `/api` and `/socket.io` requests to the backend automatically.

## Code Organization

### Adding a New Game Mode

1. Create `server/modes/{mode}.js` with exported functions for init, guess handling, etc.
2. Register the mode in `server/modes/index.js`
3. Add socket event handlers in `server/index.js`
4. Create `client/src/modes/{mode}/` with `index.js`, `actions.js`, `selectors.js`
5. Create the screen component in `client/src/screens/`
6. Add the mode option to `HomeScreenV2.jsx`
7. Add screen routing in `GameRouter.jsx`

### Modifying the Database

1. Edit `server/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name describe-your-change`
3. Update any affected database helpers in `server/daily-db.js`

See [server/prisma/MIGRATIONS.md](server/prisma/MIGRATIONS.md) for full migration procedures.

## Testing

### Server

```bash
cd server
npm test              # All tests (unit + integration)
npm test -- duel      # Run only tests matching "duel"
```

Tests are in `server/tests/`:
- `tests/*.test.js` — Unit tests for game logic, sanitization, scoring
- `tests/integration/*.test.js` — End-to-end Socket.IO flow tests

Integration tests boot the real server, connect Socket.IO clients, and exercise full game flows.

### Client

```bash
cd client
npm run lint          # ESLint with accessibility rules
npm run build         # Type-check and build
```

## Linting

The client uses ESLint with `eslint-plugin-jsx-a11y` for accessibility enforcement:

```bash
cd client && npm run lint
```

## Pull Request Process

1. Create a feature branch from `production-ready`
2. Make your changes with clear, small commits
3. Ensure all tests pass: `cd server && npm test`
4. Ensure the client builds: `cd client && npm run build`
5. Run the linter: `cd client && npm run lint`
6. Open a PR with:
   - A summary of what changed and why
   - Steps to manually test (if applicable)
   - Screenshots for UI changes

## Environment Variables

All variables are documented in `.env.example` with comments. Key ones for development:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PORT` | `8080` | Backend server port |
| `BASE_URL` | `http://localhost:5000` | Frontend origin |
| `SKIP_AUTH_SETUP` | — | Set to `true` to skip OAuth in development |

## Useful Commands

```bash
# Open Prisma Studio (visual database browser)
cd server && npx prisma studio

# Analyze client bundle size
cd client && npm run build:analyze

# Generate Prisma client after schema changes
cd server && npx prisma generate
```
