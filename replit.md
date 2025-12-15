# WordlePlus - Multiplayer Wordle Game

## Overview
WordlePlus is a multiplayer Wordle clone offering competitive game modes like Duel (1v1), Battle Royale, and Shared Duel, alongside a single-player Daily Challenge. It enables players to create rooms, share codes, and engage in real-time word-guessing competitions with friends. The project aims to provide a modern, engaging, and highly responsive gaming experience with a focus on real-time interaction and persistent user progress.

## User Preferences
I prefer simple language and clear explanations. I want an iterative development process, where I can review changes frequently. Please ask me before making any major architectural changes or significant modifications to existing features. I prefer that you focus on delivering production-ready code, paying close attention to mobile responsiveness and accessibility standards.

## System Architecture
WordlePlus is built with a modern web stack, featuring a React 18 + Vite 5 frontend, an Express + Socket.IO backend, and TailwindCSS with Radix UI components for styling. The application is structured into `client/` (React frontend) and `server/` (Express + Socket.IO backend) directories.

**UI/UX Decisions:**
The application features a modern design system with deep navy gradients and violet-cyan accent gradients. It uses the Manrope font for clean typography. UI components are highly animated using Framer Motion, including animated gradient backgrounds, magnetic glow buttons, bento-style game cards with glassmorphism, and a responsive navigation header. The design prioritizes mobile-first principles, ensuring all touch targets are ≥48px, with proper spacing and responsive grid layouts, including specific optimizations for carousels and floating buttons on mobile.

**Technical Implementations & Feature Specifications:**
- **Real-time Communication:** Utilizes Socket.IO for real-time multiplayer functionality, handling game state, player interactions, and room management.
- **Game Modes:** Implements Duel (1v1), Battle Royale (multiplayer), Shared Duel, and a Daily Challenge.
- **Daily Challenge:** Features deterministic word generation, session-based progress tracking, and persistence of guesses and results in a PostgreSQL database.
- **Error Handling:** A centralized `ErrorNotificationProvider` context manages application-wide error, warning, info, and success notifications with severity-based styling and smooth animations. Socket.IO connection status is integrated with this system.
- **User Persistence:** Anonymous users are issued on the server side and stored in the session/cookie managed by `express-session`, keeping identifiers off the public API surface.
- **Deployment Strategy:** Frontend deployed on Vercel, backend on Render, with Vercel rewrites forwarding API and WebSocket traffic to the Render backend.

**System Design Choices:**
- **Modular Structure:** Code is organized into logical modules for game screens, components, hooks, and game mode logic on the client, and server-side mode handlers, core game logic, and database interactions on the server.
- **Database:** PostgreSQL with Prisma ORM for managing users, word lexicons, daily puzzles, daily results, and game events.
- **Word Validation:** Uses a curated list of 12,972 5-letter words.
- **Reconnection Logic:** Server-side rooms store state and support player reconnection within a 30-minute window.

## External Dependencies
- **React 18 + Vite 5:** Frontend framework and build tool.
- **Express:** Backend web framework.
- **Socket.IO:** WebSocket library for real-time communication (frontend and backend).
- **TailwindCSS:** Utility-first CSS framework.
- **Radix UI:** Unstyled UI components for accessibility and customization.
- **Framer Motion:** Animation library for React.
- **PostgreSQL (Neon):** Primary database for persistent storage.
- **Prisma ORM:** Database toolkit for Node.js and TypeScript.
- **Cookie-parser:** Middleware for parsing cookies (used before switching to localStorage for user tracking due to Replit iframe limitations).
- **Luxon:** Date and time library.
- **Vercel:** Frontend hosting platform.
- **Render:** Backend hosting platform.

## Recent Changes

### October 22, 2025 - Authentication System Validation & Critical Bug Fix
- **Validated Complete Authentication Flow**:
  - Anonymous user tracking via localStorage with UUID generation
  - Session-based authentication using Passport.js with OpenID Connect (OIDC)
  - PostgreSQL session storage with `express-session` and `connect-pg-simple`
  - Seamless merge of anonymous progress into authenticated accounts
  - User stats properly displayed in ProfileModal after authentication
  
- **Critical Bug Fix in mergeAnonymousUserIntoExisting**:
  - **Issue**: When merging accounts with duplicate daily results, incomplete anonymous results could replace completed authenticated results without adjusting stats, causing inflated totalGames/totalWins counts
  - **Fix**: Added proper stat adjustment logic (lines 100-105 in `server/mergeService.js`) to decrement transferredGames and transferredWins when a completed result is replaced with an incomplete one
  - **Impact**: Stats now remain accurate in all merge scenarios including win→incomplete and loss→incomplete transitions
  
- **Edge Case Coverage Validated**:
  - Empty anonymous account merges
  - Multiple conflicting daily results (same puzzles on both accounts)
  - All win status transitions (win→win, win→loss, loss→win, win→incomplete, etc.)
  - Transaction atomicity for rollback protection
  - Proper streak consolidation using Math.max
  - Event migration via updateMany
  - mergedAt and mergedIntoUserId fields prevent re-merging
  
- **Session Management Verified**:
- getUserIdFromRequest properly prioritizes: authenticated user → session
  - AuthContext exposes isAnonymous and isAuthenticated flags correctly
  - Session model with token, deviceId, lastSeenAt, and expiration tracking

### October 20, 2025 - Complete Game Screens UI Redesign
- **All 5 Game Screens Modernized**: Applied comprehensive design system to DuelGameScreen, BattleGameScreen, HostSpectateScreen, SharedDuelGameScreen, and DailyGameScreen
- **Design System Implementation**:
  - GradientBackground applied to all game screens for consistent deep navy aesthetic
  - White text with proper opacity levels (white, white/60, white/70, white/80)
  - Glassmorphism badges and cards (bg-white/10 backdrop-blur-sm border-white/20)
  - GlowButton components for all primary actions (Start, Rematch, Play Again)
  - Framer Motion animations with 200-300ms transitions
  
- **DuelGameScreen Enhancements**:
  - Modern room code display with glassmorphism, Copy icon, and check animation
  - Gradient timer bar (emerald→cyan normal, amber warning, red critical)
  - Modern status badges with glassmorphism
  - GlowButton for rematch action
  - Modern generate button with glassmorphism and hover effects
  - All particle effects and confetti preserved
  
- **BattleGameScreen Enhancements**:
  - Animated header with modern title
  - Glassmorphism status badges (emerald active, blue winner, white waiting)
  - Animated player progress cards in sidebar with staggered entrance
  - All particle effects and victory animations preserved
  - Mobile MobileBattleLayout component maintained
  
- **HostSpectateScreen Enhancements**:
  - Modern host badge with Crown icon and glassmorphism
  - GlowButton for leaderboard access
  - Modern room code display with Copy icon and online player count
  - Beautiful leaderboard modal with glassmorphism, Trophy icon, AnimatePresence transitions
  - Animated spectate cards grid with staggered entrance
  - Winner announcement badge with glassmorphism
  
- **SharedDuelGameScreen Enhancements**:
  - Animated player cards with turn highlight indicators
  - GlowButton for "Start Shared Round" and "Play Again"
  - Modern turn status display with color coding (emerald active, white/70 waiting)
  - Smooth transitions between game states
  
- **DailyGameScreen Enhancements**:
  - Modernized header with animated title, subtitle, and instructions
  - Sequential fade-in animations for header elements
  - White text with proper opacity for excellent readability
  - GameNotification component preserved for feedback
  
- **Technical Improvements**:
  - Robust getWinnerName function handles both array and object player data
  - Removed unused imports for cleaner code
  - All game logic and functionality preserved
  - Mobile responsiveness maintained across all screens
  - Touch targets ≥48px for all interactive elements
  - Framer Motion AnimatePresence for smooth modal transitions