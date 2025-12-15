# Critical Fixes Checklist - Immediate Action Items

## 🔴 MUST FIX BEFORE PRODUCTION

### 1. Remove Console Logs (30 minutes) ✅ COMPLETED

**Files to fix:**

- [x] `client/src/screens/HomeScreenV2.jsx` - ✅ Replaced with logger
- [x] `client/src/hooks/useSocketConnection.js` - ✅ Replaced with logger
- [x] `client/src/App.jsx` - ✅ Replaced with logger
- [x] `client/src/hooks/useRoomManagement.js` - ✅ Replaced with logger
- [x] `client/src/screens/SharedDuelGameScreen.jsx` - ✅ Replaced with logger
- [x] `client/src/contexts/AuthContext.jsx` - ✅ Replaced with logger
- [x] `client/src/screens/BattleGameScreen.jsx` - ✅ Replaced with logger
- [x] `client/src/modes/ai-battle/actions.js` - ✅ Replaced with logger
- [x] `client/src/main.jsx` - ✅ Replaced with logger
- [x] `client/src/modes/shared/actions.js` - ✅ Replaced with logger
- [x] `client/src/modes/duel/actions.js` - ✅ Replaced with logger
- [x] `client/src/modes/battle/actions.js` - ✅ Replaced with logger
- [x] `client/src/components/GameResults.jsx` - ✅ No active console logs (only commented code)

**Action:** Create a logging utility:

```javascript
// client/src/utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => isDev && console.log(...args),
  error: (...args) => console.error(...args), // Always log errors
  warn: (...args) => isDev && console.warn(...args),
  debug: (...args) => isDev && console.debug(...args),
};
```

### 2. Add Error Boundaries (1 hour) ✅ COMPLETED

**Files to create/modify:**

- [x] Wrap `<App>` in ErrorBoundary in `main.jsx` - ✅ Already wrapped
- [x] Wrap each screen component in ErrorBoundary:
  - [x] `HomeScreen` - ✅ Wrapped
  - [x] `DuelGameScreen` - ✅ Wrapped
  - [x] `BattleGameScreen` - ✅ Wrapped
  - [x] `DailyGameScreen` - ✅ Wrapped
  - [x] `SharedDuelGameScreen` - ✅ Wrapped
  - [x] `HostSpectateScreen` - ✅ Wrapped

**Action:** Update `ErrorBoundary.jsx`:

```jsx
// Add error reporting
componentDidCatch(error, errorInfo) {
  // Send to error tracking service (Sentry, etc.)
  console.error('Error caught by boundary:', error, errorInfo);
}
```

### 3. Input Sanitization (2 hours) ✅ COMPLETED

**Files to modify:**

- [x] `client/src/App.jsx` - ✅ Sanitize `name` input (initial state and localStorage)
- [x] `client/src/App.jsx` - ✅ Sanitize `roomId` input (initial state)
- [x] `client/src/App.jsx` - ✅ Sanitize inputs in `create()` and `join()` functions
- [x] `server/index.js` - ✅ Validate all socket event inputs
- [x] `server/index.js` - ✅ Sanitize room names in `createRoom` (line 1073)
- [x] `server/index.js` - ✅ Sanitize names in `joinRoom` (line 1127)
- [x] `server/index.js` - ✅ Sanitize secret words in `setSecret`
- [x] `server/index.js` - ✅ Sanitize guesses in `makeGuess`
- [x] `server/index.js` - ✅ Sanitize host words in `setHostWord`

**Action:** Create sanitization utility:

```javascript
// client/src/utils/sanitize.js
export const sanitizeInput = (input) => {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 50); // Limit length
};

export const sanitizeRoomId = (id) => {
  if (typeof id !== "string") return "";
  return id
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
};
```

### 4. Fix Memory Leaks (3 hours) ✅ COMPLETED

**Files to check:**

- [x] `client/src/App.jsx` - Line 82-89: Ensure socket listener cleanup - ✅ Already had cleanup
- [x] `client/src/App.jsx` - Line 385-403: Daily key handler cleanup - ✅ Already had cleanup
- [x] `client/src/App.jsx` - Line 545-586: Game key handler cleanup - ✅ Already had cleanup
- [x] `client/src/App.jsx` - Line 288, 295, 308, 353: Daily error setTimeout cleanup - ✅ Fixed with useRef cleanup
- [x] `client/src/App.jsx` - Line 518: Game error setTimeout cleanup - ✅ Fixed with useRef cleanup
- [x] `client/src/components/Board.jsx` - Line 56-65: ResizeObserver cleanup - ✅ Already had cleanup
- [x] `client/src/hooks/useSocketConnection.js` - All socket listeners - ✅ Already had cleanup
- [x] `server/index.js` - Timer cleanup in battle mode (lines 898-936) - ✅ Already had cleanup
- [x] `server/index.js` - Duel timer cleanup on room deletion (line 1843) - ✅ Added cleanup before room deletion

**Action:** Audit all useEffect hooks for proper cleanup - ✅ Completed

### 5. Socket Authentication (4 hours) ✅ COMPLETED

**Files to modify:**

- [x] `server/index.js` - Add socket middleware for auth - ✅ Added `io.use(authenticateSocket)` middleware
- [x] `client/src/socket.js` - Add auth token to connection - ✅ Changed `withCredentials: true` to send session cookies
- [x] `server/auth.js` - Add socket authentication - ✅ Added `authenticateSocket()` function and session store reference

**Action:** Implement JWT-based socket auth - ✅ Implemented session-based socket auth (using existing express-session instead of JWT for consistency)

**Implementation Details:**

- Socket authentication uses the existing express-session cookie system
- Authenticated users are identified via `socket.userId` and `socket.isAuthenticated`
- Anonymous users are still allowed to connect (fail-open approach for better UX)
- Session cookie is automatically sent by client with `withCredentials: true`

### 6. Add Basic Tests (8 hours) ✅ COMPLETED

**Priority tests to add:**

- [x] `server/game.js` - Test `scoreGuess` function - ✅ Created `server/tests/game.test.js` with 10 test cases
- [x] `server/modes/duel.js` - Test duel logic - ✅ Created `server/tests/duel.test.js` with comprehensive duel mode tests
- [x] `server/modes/battle.js` - Test battle logic - ✅ Created `server/tests/battle.test.js` with comprehensive battle mode tests
- [x] `client/src/utils/sanitize.js` - Test sanitization - ✅ Created `server/tests/sanitize.test.js` with tests for all sanitization functions
- [ ] Socket.IO connection handling - ⏸️ Deferred (can be added later)
- [ ] Room creation/joining flow - ⏸️ Deferred (can be added later)

**Test Results:**

- All 81 tests passing ✅
- 5 test suites: game.test.js, duel.test.js, battle.test.js, sanitize.test.js, health.test.js
- Coverage includes: scoreGuess logic, duel mode functions, battle mode functions, input sanitization

---

## 🟠 HIGH PRIORITY (Do After Critical)

### 7. Refactor App.jsx (1-2 days) ✅ COMPLETED

**Break into:**

- [x] `hooks/useDailyGame.js` - Extract daily mode logic - ✅ Created with all daily game state and handlers
- [x] `hooks/useDuelGame.js` - Extract duel mode logic - ✅ Created with duel keyboard handling and guess submission
- [x] `hooks/useBattleGame.js` - Extract battle mode logic - ✅ Created with battle keyboard handling and guess submission
- [x] `components/GameRouter.jsx` - Route to correct screen - ✅ Created component to handle all screen routing
- [x] `contexts/GameContext.jsx` - Centralize game state - ✅ Created context for shared game state (screen, room, user, etc.)

**Results:**

- App.jsx reduced from **1131 lines to ~350 lines** (69% reduction) nice
- All functionality preserved
- Better separation of concerns
- Easier to test and maintain
- Build successful ✅

### 8. Add Loading States (4 hours) ✅ COMPLETED

**Components needing loading states:**

- [x] Room creation - ✅ Enhanced with loading spinner in buttons
- [x] Room joining - ✅ Enhanced with loading spinner in buttons
- [x] Guess submission - ✅ Added loading states to duel/battle/shared modes, keyboard disabled during submission
- [x] Daily challenge loading - ✅ Added loading overlay when loading challenge
- [x] Socket reconnection - ✅ Added reconnecting indicator in NavHeader

**Implementation Details:**

- Created reusable `LoadingSpinner` component with multiple variants (sm, md, lg, xl)
- Enhanced `GlowButton` to support `loading` prop with spinner
- Added `submittingGuess` state to `useDuelGame` and `useBattleGame` hooks
- Keyboard components disabled during guess submission to prevent double submissions
- Daily game screen shows loading overlay when loading challenge
- Socket reconnection shows animated indicator in navigation header
- All loading states provide visual feedback and prevent user actions during async operations

### 9. Optimize Re-renders (1 day) ✅ COMPLETED

**Components to memoize:**

- [x] `Board.jsx` - ✅ Wrapped with React.memo and custom comparison function
- [x] `Keyboard.jsx` - ✅ Wrapped with React.memo and custom comparison function
- [x] `PlayerCard.jsx` - ✅ Wrapped with React.memo
- [x] `VictoryModal.jsx` - ✅ Wrapped with React.memo (including Tiles sub-component)

**Hooks to optimize:**

- [x] `useGameState.js` - ✅ Optimized with useMemo instead of useState+useEffect, reduced dependencies
- [x] `App.jsx` - ✅ Split large useEffects into smaller, focused effects with reduced dependencies

**Implementation Details:**

- **Board.jsx**: Custom comparison function checks all props to prevent unnecessary re-renders
- **Keyboard.jsx**: Custom comparison function for onKeyPress, letterStates, disabled, sticky props
- **PlayerCard.jsx**: Simple memoization (shallow comparison is sufficient)
- **VictoryModal.jsx**: Memoized main component and Tiles sub-component
- **useGameState.js**:
  - Replaced useState+useEffect pattern with useMemo for computed player data
  - Memoized mode state selectors
  - Memoized all derived values (canGuess\*, letterStates, shouldShowVictory, duelSecrets)
  - Reduced dependencies by extracting socketId
- **App.jsx**:
  - Split victory modal effect into 3 separate effects (duel, shared, battle)
  - Split navigation effect into 2 separate effects (duel, battle)
  - Each effect now has minimal, focused dependencies

### 10. Code Splitting (4 hours) ✅ COMPLETED

**Routes to split:**

- [x] Home screen - ✅ Lazy loaded with React.lazy()
- [x] Duel game screen - ✅ Lazy loaded with React.lazy()
- [x] Battle game screen - ✅ Lazy loaded with React.lazy() (includes HostSpectateScreen)
- [x] Daily game screen - ✅ Lazy loaded with React.lazy()
- [x] Shared Duel game screen - ✅ Lazy loaded with React.lazy()

**Action:** Use React.lazy() and Suspense

**Implementation Details:**

- All screen components converted to lazy-loaded imports using `React.lazy()`
- Each lazy-loaded component wrapped in `<Suspense>` with a custom `ScreenLoadingFallback` component
- Loading fallback uses the existing `LoadingSpinner` component for consistent UI
- Error boundaries maintained around each screen for error handling
- Code splitting reduces initial bundle size and improves load times
- Screens are only loaded when needed (on-demand loading)

---

## 📝 QUICK WINS (Do These First for Momentum)

1. **Remove commented code** (30 min)

   - Search for `//` comments that are dead code
   - Remove all commented-out blocks

2. **Fix obvious bugs** (1 hour)

   - `App.jsx` line 8: Remove unclear comment
   - `useSocketConnection.js` line 8: Remove "reset my works" comment
   - Fix any obvious typos

3. **Add .env.example** (15 min)

   - Document all required environment variables
   - Add to repository

4. **Add .gitignore entries** (15 min)

   - Ensure .env files are ignored
   - Add build artifacts
   - Add test coverage reports

5. **Add ESLint** (1 hour)
   - Set up ESLint with React rules
   - Fix auto-fixable issues
   - Add to pre-commit hook

---

## 🎯 RECOMMENDED AI MODEL USAGE

### For This Analysis:

**Claude Sonnet 4.5** - Already used for this comprehensive analysis

### For Implementation:

1. **Cursor AI** (built-in) - Use for:

   - Real-time code suggestions
   - Refactoring assistance
   - Quick fixes

2. **Claude Sonnet 4.5** - Use for:

   - Architecture decisions
   - Complex refactoring planning
   - Security review
   - Test strategy

3. **GPT-4 Turbo** - Use for:
   - Code generation
   - Documentation
   - Quick implementations

### Prompt Templates:

**For Refactoring:**

```
Analyze [FILE] and suggest how to break it into smaller,
more maintainable components. Focus on:
1. Single responsibility principle
2. Reusability
3. Testability
```

**For Security:**

```
Review [FILE] for security vulnerabilities, focusing on:
1. Input validation
2. XSS prevention
3. Authentication/authorization
4. Data exposure
```

**For Performance:**

```
Profile [COMPONENT] and identify:
1. Unnecessary re-renders
2. Memory leaks
3. Performance bottlenecks
4. Optimization opportunities
```

---

## ✅ PROGRESS TRACKING

**Week 1 Goals:**

- [ ] All critical fixes completed
- [ ] At least 3 high-priority items done
- [ ] Basic test suite in place

**Week 2 Goals:**

- [ ] App.jsx refactored
- [ ] Loading states added
- [ ] Re-render optimizations complete

**Week 3 Goals:**

- [ ] Code splitting implemented
- [ ] Accessibility improvements
- [ ] CI/CD pipeline set up

---

_Use this checklist to track progress. Check off items as you complete them._
