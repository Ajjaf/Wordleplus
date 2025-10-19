# WordlePlus - Multiplayer Wordle Game

## Overview
WordlePlus is a multiplayer Wordle clone featuring competitive game modes including Duel (1v1), Battle Royale, and Shared Duel. Players can create rooms, share codes, and compete against friends in real-time word-guessing challenges.

## Project Architecture

### Tech Stack
- **Frontend**: React 18 + Vite 5
- **Backend**: Express + Socket.IO (WebSockets)
- **Styling**: TailwindCSS with Radix UI components
- **Language**: JavaScript (ES Modules)

### Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── screens/      # Game screens (Home, Lobby, Battle, Duel)
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── modes/        # Game mode logic (battle, duel, shared, daily)
│   │   └── config.js     # Client configuration
│   └── vite.config.js
│
└── server/          # Express + Socket.IO backend
    ├── modes/       # Server-side game mode handlers
    ├── game.js      # Core game logic (scoring, validation)
    ├── index.js     # Main server file
    ├── words.txt    # Word list (12,972 5-letter words)
    └── wordlist.json
```

## Development Setup

### Ports
- **Frontend (Development)**: Port 5000 (Vite dev server)
- **Backend (Development)**: Port 8080 (Express + Socket.IO)

### Running in Replit
The project has TWO workflows configured:
1. **Frontend**: Runs Vite dev server on port 5000 with proxy to backend
2. **Backend**: Runs Express server on port 8080 (required for Daily Challenge database integration)

### Key Configurations
- Vite is configured to bind to `0.0.0.0:5000` to work with Replit's proxy
- Backend proxy is configured in `vite.config.js` to forward `/api`, `/socket.io`, and `/health` to `localhost:8080`
- All game modes (Duel, Battle Royale, Shared, Daily Challenge) use the local backend for development

## Game Modes

1. **Duel (1v1)**: Each player sets a secret word for the other; 6 guesses; winner by solve/steps
2. **Battle Royale**: Host sets one word; 2+ players guess; first correct wins
3. **Shared Duel**: Players share a common word challenge
4. **Daily Challenge**: Single-player daily puzzle with deterministic word generation; same word for all players each day; progress tracked via session cookies; 6 guesses max; victory modal on completion

## Recent Changes

### October 19, 2025 (Evening) - Daily Challenge UI Updates & Bug Fixes
- **UI Overhaul**: Updated Daily Challenge screen to match Battle player view layout
  - Removed "Submit Guess" button for cleaner interface
  - Larger, centered board matching Battle mode design (maxTile=112, minTile=56)
  - Improved header styling with bold title and status messages
  - Persistent keyboard footer for better UX
  - **Correct word display**: When player loses, the correct word is displayed above the board
- **Gameplay Consistency**: Core gameplay matches other modes
  - Press ENTER key to submit guess (no auto-submit)
  - Board provides feedback for invalid guesses (wrong length, invalid word)
  - Backend returns correct word when game ends
- **Critical Bug Fix**: Fixed "Invalid response from server" error
  - Updated Vite proxy configuration to point to local backend (localhost:8080)
  - All API endpoints now correctly routed through local Express server
  - Database integration now fully functional in development

### October 19, 2025 (Evening) - Daily Challenge Database Integration Completed
- **Database Setup**: Set up Neon PostgreSQL database with Prisma ORM
  - Created complete database schema with models:
    - **User**: Anonymous users tracked by cookie-based IDs with optional upgrade to registered accounts
    - **WordLexicon**: 12,972 5-letter words seeded from words.txt
    - **DailyPuzzle**: Daily challenge puzzles with deterministic word generation
    - **DailyResult**: Stores guesses, patterns, completion status, and win data per user per puzzle
    - **Event**: Game events and leaderboard tracking for all modes
  - Successfully ran database migration and seed (12,972 words loaded)
  - Added database management scripts to package.json (db:push, db:seed, db:studio)
  - Configured DATABASE_URL via Replit Secrets

- **Daily Challenge Database Integration**:
  - Created database helper module (server/daily-db.js) for user/puzzle/result operations
  - Updated Daily Challenge API endpoints to use persistent storage:
    - GET /api/daily: Loads puzzle from DailyPuzzle table, retrieves user progress from DailyResult
    - POST /api/daily/guess: Validates and stores guesses with patterns in database
    - GET /api/daily/stats: Returns user statistics including win rate, current streak, and max streak
  - Anonymous user system: Auto-creates users on first visit, tracks via cookie (1-year expiration)
  - Deterministic puzzle generation: Same word for all players each day, stored in database
  - Progress persistence: All guesses, patterns, and completion status stored in DailyResult table
  - Statistics tracking: Win streaks, completion rates, recent game history
  - Re-enabled local Backend workflow on port 8080 for testing daily mode with database

- **Learning Documentation Created**:
  - Created comprehensive documentation in `docs/` folder:
    - `DATABASE_INTEGRATION_GUIDE.md` - Complete overview of database integration
    - `PRISMA_BASICS.md` - Prisma ORM tutorial with real examples
    - `DATABASE_SCHEMA_EXPLAINED.md` - Detailed explanation of all tables
    - `API_ENDPOINTS_GUIDE.md` - Step-by-step API endpoint walkthrough
    - `TESTING_AND_DEBUGGING.md` - Practical testing and debugging guide
    - `README.md` - Documentation index with learning paths

### October 19, 2025 (Afternoon) - Daily Challenge Mode Completed
- Implemented complete Daily Challenge mode functionality:
  - Backend API endpoints: GET /api/daily and POST /api/daily/guess
  - Deterministic daily word generation (same word for all players per day)
  - Session-based progress tracking using cookie-parser
  - Letter states computation for keyboard hints
  - Victory modal with custom daily mode celebration
  - Full integration with existing UI components
- Added cookie-parser dependency for session management
- Re-enabled local Backend workflow for testing daily mode (ports 5000 frontend, 8080 backend)
- Updated Vite proxy to use localhost:8080 for development

### October 19, 2025 (Morning)
- Removed local Backend workflow (backend hosted externally)
- Updated Vite proxy configuration to connect to hosted backend at https://wordleplus-1-8f2s.onrender.com
- Configured frontend-only setup in Replit

### October 18, 2025
- Initial import from GitHub
- Removed deprecated npm packages (`badge`, `button`, `card`) that contained security vulnerabilities
- Configured Vite for Replit environment (0.0.0.0:5000, proxy setup)
- Set up workflows for both frontend and backend

## Deployment
- **Target**: VM (required for WebSocket support and stateful game rooms)
- **Build**: Installs dependencies and builds frontend
- **Run**: Starts Express server in production mode on port 5000
- The server handles both API/WebSocket requests and serves the frontend SPA

## Notes
- The application uses Socket.IO for real-time multiplayer functionality
- Rooms are stored in-memory and support reconnection
- Players can rejoin games if disconnected within 30 minutes
- Word validation uses a curated list of 12,972 5-letter words
