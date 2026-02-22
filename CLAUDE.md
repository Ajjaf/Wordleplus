# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WordlePlus is a multiplayer Wordle game with real-time competitive modes: Duel (1v1), Battle Royale, Battle AI, Daily Challenge, and Shared mode. Built with React + Socket.IO (client) and Node.js + Express + Socket.IO + Prisma (server).

## Development Commands

### Server (Backend)
```bash
cd server
npm install
npm run dev                    # Start dev server (port 4000 or 8080)
npm test                       # Run all tests with Jest
npm run prisma:generate        # Generate Prisma Client after schema changes
npm run prisma:migrate:dev     # Create and apply new migration
npm run prisma:studio          # Open Prisma Studio (visual DB browser)
npm run prisma:db:push         # Push schema changes without migration
npm run prisma:seed            # Seed database with word list
```

### Client (Frontend)
```bash
cd client
npm install
npm run dev                    # Start dev server (port 5173)
npm run build                  # Build for production
npm run preview                # Preview production build
```

### Environment Setup
- Copy `.env.example` to `.env` in root directory
- Set `DATABASE_URL` for PostgreSQL connection (required)
- Set `SESSION_SECRET` for cookie signing
- Set `VITE_SERVER_URL` to backend URL (default: http://localhost:8080)
- Configure OAuth credentials if using authentication

## High-Level Architecture

### Client-Server Communication Pattern
The app uses Socket.IO for real-time bidirectional communication:
1. Client connects via `socket.io-client` with session cookies (`withCredentials: true`)
2. Server authenticates socket connections via cookie-based sessions
3. Socket events drive all game state updates
4. `roomState` event broadcasts full game state to all players in a room

### Mode-Based Architecture
Each game mode is a self-contained module with:
- **Server-side handler**: `server/modes/{mode}.js` - Validates moves, manages game state, emits events
- **Client-side logic**: `client/src/modes/{mode}/` - UI components and local state
- **Client hooks**: `client/src/hooks/use{Mode}Game.js` - Socket event handlers and game actions
- **Shared logic**: `server/modes/shared.js` - Common utilities across modes

Game modes:
- **duel**: 1v1 where each player sets a secret word for the opponent
- **battle**: Host sets word, multiple players race to solve it first
- **battle_ai**: Automated host with timed rounds
- **daily**: Single daily puzzle tracked in database
- **shared**: Collaborative gameplay (legacy)

### Key Server Components

**server/index.js**
- Main entry point: Express app + Socket.IO server
- Loads word lists (`words.txt`, `allowed_guesses.txt`)
- Defines API endpoints for daily challenges
- Registers Socket.IO event handlers via mode modules
- In-memory room storage (`io.rooms Map`)

**server/modes/{mode}.js**
Each mode exports an object with:
- `events`: Object mapping socket event names to handler functions
- Handlers receive `(socket, data, { io, getRoom, updateRoom, ... })`
- All game logic validation happens server-side
- Emit `roomState` after each state change to sync all clients

**server/daily-db.js**
Database helpers for daily challenge:
- `getOrCreateAnonymousUser(deviceId)`: Cookie-based user tracking
- `getTodaysPuzzle()`: Get or generate daily word
- `createOrUpdateDailyResult()`: Save player progress
- Uses Prisma Client for type-safe queries

**server/auth.js**
- OAuth/OpenID Connect setup via `passport`
- Session management with `express-session` + PostgreSQL store
- `authenticateSocket()`: Extracts user from session cookie
- Supports anonymous sessions with device ID fallback

### Key Client Components

**client/src/App.jsx**
- Root component orchestrating all game modes
- Manages global state via `GameContext`
- Delegates to mode-specific hooks (`useDuelGame`, `useBattleGame`, `useDailyGame`)
- Handles socket connection and room management

**client/src/hooks/**
Game logic hooks that encapsulate mode-specific behavior:
- `useGameState.js`: Derives computed state from room data (players, scores, permissions)
- `use{Mode}Game.js`: Socket event handlers and key input for each mode
- `useSocketConnection.js`: Reconnection logic, saved session restoration
- `useRoomManagement.js`: Room creation, joining, navigation

**client/src/screens/**
Screen components for different game states:
- `HomeScreen.jsx`: Mode selection and room creation
- `DuelGameScreen.jsx`: Dual-board view for 1v1 gameplay
- `BattleGameScreen.jsx`: Multi-player race view
- `DailyGameScreen.jsx`: Single-player daily challenge
- `LobbyScreen.jsx`: Pre-game waiting room

**client/src/components/**
Reusable UI components:
- `Board.jsx`: Wordle grid with guess history and animations
- `Keyboard.jsx`: On-screen keyboard with letter state colors
- `VictoryModal.jsx`: End-game modal with results and rematch options
- `GameRouter.jsx`: Routes between screens based on `screen` state

### Database Schema (Prisma)

**User** - Player accounts (anonymous or authenticated)
- Supports device-based anonymous users and OAuth users
- `mergedIntoUserId`: Tracks account merges for migration
- Denormalized game stats: `totalWins`, `totalGames`, `streak`

**DailyPuzzle** - One row per date
- `date`: String key (e.g., "2025-02-07")
- `word`: Answer word
- `locked`: Prevents word changes after first solve

**DailyResult** - One row per user per daily puzzle
- `guesses`, `patterns`: JSON arrays of game history
- `attempts`, `won`, `completed`: Game outcome
- Unique constraint on `[userId, puzzleId]`

**WordLexicon** - Master word list
- `active`: Toggle words on/off without deletion
- Indexed by `[length, active]` for fast filtering

**Event** - Append-only analytics stream
- Tracks all game events with `type`, `roomId`, `meta`

**Session** - Cookie-based session tracking
- Links anonymous device IDs to user records
- `expiresAt`: Automatic session cleanup

### Word Validation Flow
1. Client sends guess via socket event (`makeGuess`, `guessBattle`, etc.)
2. Server validates guess is in `GUESSSET` (allowed_guesses.txt + words.txt)
3. Server calls `scoreGuess(guess, secretWord)` from `game.js`
4. Returns pattern array: `['correct', 'present', 'absent', ...]`
5. Server updates room state and broadcasts `roomState` to all clients
6. Client renders updated board with new row

### Socket Event Patterns

**Room lifecycle:**
```javascript
// Client emits
socket.emit('createRoom', { name, mode, roomId, secretWord? })
socket.emit('joinRoom', { name, roomId })
socket.emit('leaveRoom')

// Server broadcasts
socket.emit('roomState', { players, guesses, status, ... })
```

**Gameplay events (mode-specific):**
```javascript
// Duel mode
socket.emit('setSecret', { word })
socket.emit('makeGuess', { guess })

// Battle mode
socket.emit('guessBattle', { guess })
socket.emit('startGame')        // Host only
socket.emit('nextRound')        // Host only (AI mode)
```

## Testing

### Server Tests
Located in `server/tests/`:
- `game.test.js`: Word scoring logic
- `duel.test.js`: Duel mode game flow
- `battle.test.js`: Battle Royale game flow
- `sanitize.test.js`: Input validation utilities
- `health.test.js`: API endpoint health checks

Run with `npm test` (uses Jest with experimental VM modules for ESM support)

### Testing Approach
Tests use in-memory mocks for Socket.IO and room state. The pattern:
```javascript
const mockSocket = { id: 'socket1', emit: jest.fn(), to: jest.fn() }
const mockIo = { to: jest.fn(), rooms: new Map() }
duelMode.events.makeGuess(mockSocket, { guess: 'HOUSE' }, { io: mockIo, ... })
```

## Common Patterns

### Adding a New Game Mode
1. Create `server/modes/{mode}.js` with `events` export
2. Register in `server/modes/index.js`
3. Add socket event handlers in `server/index.js`
4. Create `client/src/modes/{mode}/` directory for UI components
5. Create `client/src/hooks/use{Mode}Game.js` for client logic
6. Add mode option to `HomeScreen.jsx` mode selector
7. Add screen routing in `client/src/App.jsx` and `GameRouter.jsx`

### Modifying Prisma Schema
1. Edit `server/prisma/schema.prisma`
2. Run `npm run prisma:generate` to update TypeScript types
3. Run `npm run prisma:migrate:dev` to create migration
4. Update relevant database helper functions in `server/daily-db.js`

### Debugging Socket Issues
- Enable Socket.IO debug logs: `localStorage.debug = 'socket.io-client:socket'`
- Check server logs for socket connection/disconnection events
- Verify `withCredentials: true` in client socket config for cookie auth
- Use browser DevTools Network tab to inspect Socket.IO frames

## Session Architecture

WordlePlus uses two session tables:

1. **express-session** (`user_sessions` table via connect-pg-simple)
   - Used for: HTTP cookie-based authentication
   - Stores: Express session data, Passport user ID
   - Cleanup: Automatic via connect-pg-simple TTL

2. **Prisma Session** (`Session` table)
   - Used for: Device tracking, anonymous users
   - Stores: Device ID, session tokens, metadata
   - Cleanup: Automatic hourly via `server/jobs/cleanupSessions.js`

This is intentional — express-session handles auth, Prisma Session handles device/analytics tracking.

## Important Constraints

- **Word validation**: Server is source of truth; never trust client input
- **Room state**: Stored in-memory on server (does not persist across restarts)
- **Session cookies**: Require `withCredentials: true` and proper CORS config
- **Anonymous users**: Tracked via `deviceId` in cookie; can be merged with OAuth accounts later
- **Daily puzzle**: Locked after first solve to prevent word changes mid-day
- **Game timing**: Duel mode has 6-minute round timer (configurable via `DUEL_ROUND_MS`)

## Client-Side Development Notes

See `docs/README.md` for detailed learning paths on:
- Database integration (Prisma + PostgreSQL)
- API endpoint design
- Testing and debugging strategies
- Schema design decisions

The `GEMINI.md` file contains legacy global rules that may overlap with this document.
