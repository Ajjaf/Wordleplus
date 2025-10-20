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
- **Daily Challenge:** Features deterministic word generation, session-based (now localStorage-based) progress tracking, and persistence of guesses and results in a PostgreSQL database.
- **Error Handling:** A centralized `ErrorNotificationProvider` context manages application-wide error, warning, info, and success notifications with severity-based styling and smooth animations. Socket.IO connection status is integrated with this system.
- **User Persistence:** Anonymous users are tracked via a UUID stored in localStorage on the frontend, sent to the backend via an `X-User-Id` header, and linked to a `User` record in the database.
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