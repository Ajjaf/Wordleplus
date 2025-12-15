# WordlePlus - Global Project Rules & Information

## Project Overview

**WordlePlus** (formerly Friendle Clone) is a multiplayer Wordle game featuring multiple competitive modes. Players can compete in real-time duels, battle royales, and daily challenges.

### Tech Stack

- **Frontend**: React 18 + Vite, TailwindCSS, Framer Motion, Socket.IO Client
- **Backend**: Node.js 20+, Express, Socket.IO, Prisma ORM, PostgreSQL
- **Authentication**: OpenID Connect (OAuth)
- **Deployment**: Vercel (client), Railway/Replit (server)

## Project Structure

```
Wordleplus/
├── client/          # React frontend application
├── server/          # Node.js backend with Socket.IO
├── docs/            # Project documentation
└── GEMINI.md        # This file (global rules)
```

## Core Game Modes

1. **Duel Mode**: 1v1 where each player sets a secret word for the opponent
2. **Battle Royale**: Host sets one word, multiple players compete to solve first
3. **Battle AI**: Automated host with timed rounds
4. **Daily Challenge**: Single daily puzzle for all players
5. **Shared Mode**: Collaborative gameplay

## Global Development Rules

### Code Style & Standards

1. **JavaScript/JSX**: Use ES6+ features, prefer functional components
2. **Naming Conventions**:
   - Components: PascalCase (`PlayerCard.jsx`)
   - Hooks: camelCase starting with `use` (`useIsMobile.js`)
   - Utilities: camelCase (`utils.js`)
   - Constants: UPPER_SNAKE_CASE for true constants
3. **File Organization**: Group related files in folders (components, hooks, screens, modes)
4. **Imports**: Use absolute imports with `@/` alias when configured

### Architecture Principles

1. **Mode-Based Architecture**: Each game mode is a self-contained module on both client and server
2. **Separation of Concerns**:
   - Client handles UI/UX and user interactions
   - Server handles game logic, validation, and state management
3. **Real-time Communication**: Use Socket.IO for all game state synchronization
4. **State Management**:
   - Server is the source of truth for game state
   - Client maintains local UI state only
   - Never trust client-side game state for critical decisions

### Security Rules

1. **Never trust client input**: All validation must happen server-side
2. **Secret words**: Never expose secret words to clients until game ends
3. **Authentication**: Use session-based auth, validate on every request
4. **Rate limiting**: Implement rate limits on guess submissions
5. **Input sanitization**: Sanitize all user inputs before processing

### Mobile-First Design

1. **Responsive Design**: All features must work on mobile (320px+) and desktop
2. **Touch Interactions**: Support swipe gestures where appropriate
3. **Virtual Keyboard**: Always provide virtual keyboard on mobile when text input is needed
4. **Performance**: Optimize for mobile performance (lazy loading, code splitting)

### Error Handling

1. **User-Friendly Messages**: Never expose technical error details to users
2. **Graceful Degradation**: Handle network failures, disconnections gracefully
3. **Logging**: Log errors server-side for debugging, but don't expose to client
4. **Error Boundaries**: Use React error boundaries to catch component errors

### Testing & Quality

1. **Test Game Logic**: Server-side game logic must have tests
2. **Manual Testing**: Test all game modes on both mobile and desktop
3. **Edge Cases**: Handle edge cases (disconnections, invalid words, etc.)
4. **Performance**: Monitor bundle size, API response times

## Common Patterns

### Adding a New Game Mode

1. Create server module: `server/modes/<mode>.js`
2. Create client module: `client/src/modes/<mode>/`
3. Create screen component: `client/src/screens/<Mode>GameScreen.jsx`
4. Register in mode registry: `server/modes/index.js` and `client/src/modes/index.js`
5. Wire up in App.jsx and server/index.js

### Component Development

1. Use functional components with hooks
2. Memoize expensive components with `React.memo`
3. Extract reusable logic into custom hooks
4. Keep components focused and single-purpose
5. Use TypeScript-style JSDoc comments for complex props

### State Management

1. Server state: Managed in room objects, synced via Socket.IO
2. Client UI state: Use React useState/useReducer for local UI
3. Shared state: Use React Context for app-wide state (auth, theme)
4. Avoid prop drilling: Use context or composition

## Documentation Standards

1. **Code Comments**: Comment complex logic, not obvious code
2. **JSDoc**: Use JSDoc for function signatures and complex components
3. **README Files**: Keep README files updated with setup instructions
4. **Mode Documentation**: Document mode-specific rules in mode files

## Git & Version Control

1. **Commit Messages**: Use clear, descriptive commit messages
2. **Branching**: Use feature branches for new features
3. **Code Review**: Review all changes before merging
4. **Backup Files**: Don't commit `.backup` files (use `.gitignore`)

## Performance Guidelines

1. **Bundle Size**: Keep client bundle under 500KB (gzipped)
2. **API Responses**: Keep responses small, only send necessary data
3. **Re-renders**: Minimize unnecessary re-renders with memoization
4. **Images**: Optimize images, use appropriate formats
5. **Lazy Loading**: Lazy load routes and heavy components

## Accessibility

1. **ARIA Labels**: Use proper ARIA labels for interactive elements
2. **Keyboard Navigation**: Support keyboard navigation
3. **Color Contrast**: Ensure sufficient color contrast
4. **Screen Readers**: Test with screen readers where possible

## Deployment

1. **Environment Variables**: Never commit secrets, use environment variables
2. **Database Migrations**: Run migrations before deploying
3. **Build Verification**: Test production builds locally before deploying
4. **Rollback Plan**: Have a rollback plan for deployments

## Getting Help

- Check `docs/` folder for detailed guides
- Review existing mode implementations for patterns
- Check `TODO.md` for known issues and planned features
- Review `docs/mode-architecture.md` for mode development guide
