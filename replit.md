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
- **Backend**: Port 8080 (Express + Socket.IO)
- **Production**: Port 5000 (Express serves built frontend)

### Running Locally
The project has two workflows configured:
1. **Backend**: Runs Express server on port 8080
2. **Frontend**: Runs Vite dev server on port 5000 with proxy to backend

### Key Configurations
- Vite is configured to bind to `0.0.0.0:5000` to work with Replit's proxy
- Backend proxies are set up in `vite.config.js` for `/api`, `/socket.io`, and `/health`
- In production, the Express server serves the built frontend from `client/dist`

## Game Modes

1. **Duel (1v1)**: Each player sets a secret word for the other; 6 guesses; winner by solve/steps
2. **Battle Royale**: Host sets one word; 2+ players guess; first correct wins
3. **Shared Duel**: Players share a common word challenge
4. **Daily Challenge**: Daily word challenge (marked as NEW)

## Recent Changes (October 18, 2025)
- Initial import from GitHub
- Removed deprecated npm packages (`badge`, `button`, `card`) that contained security vulnerabilities
- Configured Vite for Replit environment (0.0.0.0:5000, proxy setup)
- Updated backend to serve static frontend files in production
- Set up workflows for both frontend and backend
- Configured deployment for VM target with production build process

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
