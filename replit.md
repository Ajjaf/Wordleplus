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

### October 20, 2025 - Duel Mode Mobile Board Fix
- **Critical Bug Fix**: Fixed board visibility in Duel mobile view
  - Removed blocking progress indicator ("You (0/6)" and "Opponent (0/6)")
  - Simplified MobileBoardSwitcher component to show only player's board
  - Removed toggle button for opponent view (temporarily disabled)
  - Board now displays correctly with full visibility on mobile devices
  - Players can see and interact with their game board without obstructions

### October 20, 2025 - Mobile UX Optimization (Production-Ready)
- **2025 Mobile Standards Compliance**: All touch targets and spacing now meet WCAG AAA/iOS/Android guidelines
  - **Touch targets**: 48×48px minimum for all interactive elements (buttons, inputs, keyboard keys)
  - **Spacing**: 8px minimum between all interactive elements (keyboard keys, buttons)
  - **Safe areas**: iPhone notches and Android cutouts fully supported with viewport-fit=cover
  
- **Keyboard Improvements**:
  - Increased key height from 44px to 48px on mobile
  - Improved spacing: 8px between keys (horizontal and vertical)
  - Added touch-manipulation to prevent double-tap zoom
  - Maintained responsive breakpoints for desktop (40px keys with 4px spacing)
  
- **Home Screen Mobile Optimization**:
  - All buttons now 48px minimum height (previously 40px)
  - Input fields (name, room code) now 48px tall
  - Proper touch-friendly spacing throughout
  
- **Mobile Component Enhancements**:
  - MobileBoardSwitcher: Added aria-labels and touch-manipulation
  - MobileBattleLayout: Enhanced floating buttons with accessibility
  - All floating buttons enforce 48px minimum with clear labels
  
- **Infrastructure**:
  - Created unified `useMobile` hook for consistent mobile detection
  - Added safe-area-inset-top and safe-area-inset-bottom to App container
  - Updated viewport meta tag with viewport-fit=cover for modern devices

### October 20, 2025 - Daily Challenge Notification System
- **Unified Feedback System**: Daily Challenge now uses same feedback approach as Duel and Battle modes
  - Created **GameNotification** component for transient tooltip-style notifications
  - Notifications appear near top of game grid and auto-dismiss after 1.5 seconds
  - Absolutely positioned to prevent layout shifts
  - Shake animation triggers on invalid submissions (matching Duel/Battle behavior)
  
- **Removed Layout-Affecting Status Text**: 
  - Eliminated static status messages from header that caused layout jumps
  - All feedback now delivered via transient notifications
  - Invalid word errors: "Not in word list", "Need 5 letters", "Already tried that word"
  - Loss notification: "The word was: [WORD]" (auto-dismisses)
  
- **Improved UX Consistency**:
  - Daily Challenge feedback matches multiplayer modes
  - No permanent text affecting board position
  - Clean, predictable layout throughout game

### October 20, 2025 - Render Deployment & User Persistence Fixes
- **Backend Deployment Fix**: Updated `server/package.json` for Render compatibility
  - Added missing dependencies: `@prisma/client`, `cookie-parser`, `luxon`, `prisma`
  - Added `postinstall` script to auto-generate Prisma client on deployment
  - Schema path configured with fallback: `prisma generate --schema=../prisma/schema.prisma || prisma generate`
  - Fixed ERR_MODULE_NOT_FOUND error for cookie-parser on Render
  
- **User Persistence Fix**: Switched from cookie-based to localStorage-based user tracking
  - Cookies don't work in Replit iframe due to sameSite restrictions
  - Frontend generates UUID on first visit → stores in localStorage
  - Backend receives UUID via `X-User-Id` header → creates User record with that UUID
  - Backend now always ensures User exists in database before saving guesses
  - Fixed foreign key constraint violation (DailyResult_userId_fkey)
  - Fixed "each request creates new user" bug - guesses now accumulate correctly
  
- **Frontend Deployment**: Vercel configuration
  - Frontend hosted on Vercel (client folder only)
  - Added `vercel.json` with rewrites to forward `/api/*`, `/socket.io/*`, and `/health` to Render backend
  - Backend remains on Render with DATABASE_URL configured

- **Error Display**: Updated Daily Challenge status messages to show errors in red (matching other modes)

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
