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
- **Backend**: Hosted externally at https://wordleplus-1-8f2s.onrender.com

### Running in Replit
The project has ONE workflow configured:
1. **Frontend**: Runs Vite dev server on port 5000 with proxy to hosted backend

### Key Configurations
- Vite is configured to bind to `0.0.0.0:5000` to work with Replit's proxy
- Backend proxies are set up in `vite.config.js` to forward `/api`, `/socket.io`, and `/health` to https://wordleplus-1-8f2s.onrender.com
- The local `server/` directory is NOT used in Replit - backend is hosted externally

## Game Modes

1. **Duel (1v1)**: Each player sets a secret word for the other; 6 guesses; winner by solve/steps
2. **Battle Royale**: Host sets one word; 2+ players guess; first correct wins
3. **Shared Duel**: Players share a common word challenge
4. **Daily Challenge**: Daily word challenge (marked as NEW)

## Recent Changes

### October 19, 2025
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
