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
- **Production Backend**: Hosted externally at https://wordleplus-1-8f2s.onrender.com

### Running in Replit
The project has TWO workflows configured:
1. **Frontend**: Runs Vite dev server on port 5000 with proxy to backend
2. **Backend**: Runs Express server on port 8080 (required for Daily Challenge mode testing)

### Key Configurations
- Vite is configured to bind to `0.0.0.0:5000` to work with Replit's proxy
- Backend proxies are set up in `vite.config.js` to forward `/api`, `/socket.io`, and `/health` to `localhost:8080` (development) or hosted backend (production)
- The local `server/` directory contains Daily Challenge endpoints that must be deployed to the hosted backend for production use

## Game Modes

1. **Duel (1v1)**: Each player sets a secret word for the other; 6 guesses; winner by solve/steps
2. **Battle Royale**: Host sets one word; 2+ players guess; first correct wins
3. **Shared Duel**: Players share a common word challenge
4. **Daily Challenge**: Single-player daily puzzle with deterministic word generation; same word for all players each day; progress tracked via session cookies; 6 guesses max; victory modal on completion

## Recent Changes

### October 19, 2025 (Evening) - Database Setup Completed
- Set up Neon PostgreSQL database with Prisma ORM
- Created complete database schema with models:
  - **User**: Anonymous and registered users with optional email/password
  - **WordLexicon**: 12,972 5-letter words seeded from words.txt
  - **DailyPuzzle**: Daily challenge puzzles with deterministic generation
  - **DailyResult**: User results for daily puzzles
  - **Event**: Game events and leaderboard tracking for all modes
- Successfully ran database migration and seed (12,972 words loaded)
- Added database management scripts to package.json (db:push, db:seed, db:studio)
- Configured DATABASE_URL via Replit Secrets

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
