# WordlePlus - Ship It! Implementation Plan

**Goal**: Production-ready WordlePlus app in 4 weeks
**Start Date**: TBD
**Target Launch**: 4 weeks from start

---

## 📋 Pre-Flight Checklist

Before starting, ensure:
- [ ] Git branch created: `production-ready`
- [ ] Backup of current database schema
- [ ] Local dev environment fully working
- [ ] All team members have environment variables documented

---

## WEEK 1: Critical Blockers (Production Deployment Readiness)

### 🎯 Goal: Make app deployable to any environment

---

### **Task 1.1: Environment Configuration Overhaul** (Priority: CRITICAL)
**Time Estimate**: 4 hours
**Files to modify**:
- `server/index.js`
- `server/auth.js`
- `client/src/config.js`
- `.env.example`

**Steps**:

1. **Update `.env.example` with all required variables**
   ```bash
   # Add these new variables:
   CORS_ALLOWED_ORIGINS="http://localhost:5000,http://localhost:5173"
   FRONTEND_URL="http://localhost:5000"
   BACKEND_URL="http://localhost:8080"
   NODE_ENV="development"
   REQUIRE_HTTPS="false"
   ```

2. **Create `server/config/env.js` - centralized config validation**
   ```javascript
   // New file to create
   export const config = {
     port: process.env.PORT || 8080,
     nodeEnv: process.env.NODE_ENV || 'development',
     databaseUrl: process.env.DATABASE_URL,
     sessionSecret: process.env.SESSION_SECRET,
     // ... all config with validation
   };

   export function validateConfig() {
     const required = ['DATABASE_URL', 'SESSION_SECRET'];
     const missing = required.filter(key => !process.env[key]);
     if (missing.length > 0) {
       throw new Error(`Missing required env vars: ${missing.join(', ')}`);
     }
   }
   ```

3. **Update `server/index.js`**
   - Line ~123: Replace hardcoded CORS origins
   ```javascript
   // BEFORE:
   const allowedOrigins = [
     "http://localhost:5000",
     "http://127.0.0.1:5000",
     // ...
   ];

   // AFTER:
   const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
     ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
     : [];
   ```

4. **Update `server/auth.js`**
   - Line ~24: Replace hardcoded frontend URL
   ```javascript
   // BEFORE:
   const frontendUrl = "http://localhost:5000";

   // AFTER:
   const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
   ```

5. **Add startup validation to `server/index.js`**
   - Add at top of file (after imports):
   ```javascript
   import { validateConfig } from './config/env.js';

   // Validate environment before starting server
   try {
     validateConfig();
   } catch (error) {
     console.error('❌ Configuration Error:', error.message);
     process.exit(1);
   }
   ```

6. **Update client config `client/src/config.js`**
   - Make it clearer and add fallbacks
   ```javascript
   const fromEnv = import.meta.env.VITE_SERVER_URL;
   const fromWindow = typeof window !== "undefined"
     ? window.ENV?.SERVER_URL
     : undefined;

   export const SERVER_URL = fromEnv || fromWindow || "http://localhost:8080";

   // Log config in development
   if (import.meta.env.DEV) {
     console.log('🔧 Client Config:', { SERVER_URL });
   }
   ```

**Testing**:
```bash
# Test 1: Missing required env var should fail
unset DATABASE_URL
npm run dev  # Should exit with error message

# Test 2: Custom CORS origins should work
export CORS_ALLOWED_ORIGINS="https://myapp.com,https://staging.myapp.com"
npm run dev  # Should start successfully

# Test 3: Client should connect to custom server URL
export VITE_SERVER_URL="https://api.myapp.com"
npm run build && npm run preview
```

**Success Criteria**:
- ✅ Server exits gracefully with clear error if required env vars missing
- ✅ No hardcoded URLs remain in codebase
- ✅ Can deploy to staging/production by only changing .env file
- ✅ Client can connect to server at any URL via VITE_SERVER_URL

---

### **Task 1.2: Error Tracking Integration (Sentry)** (Priority: CRITICAL)
**Time Estimate**: 3 hours
**Files to modify**:
- `client/src/components/ErrorBoundary.jsx`
- `client/src/main.jsx`
- `server/index.js`

**Steps**:

1. **Install Sentry**
   ```bash
   cd client
   npm install @sentry/react

   cd ../server
   npm install @sentry/node @sentry/profiling-node
   ```

2. **Add Sentry env vars to `.env.example`**
   ```bash
   # Error Tracking (Optional - recommended for production)
   VITE_SENTRY_DSN=""
   SENTRY_DSN=""
   SENTRY_ENVIRONMENT="development"
   SENTRY_RELEASE=""
   ```

3. **Update `client/src/main.jsx`** - Initialize Sentry
   ```javascript
   import * as Sentry from "@sentry/react";

   if (import.meta.env.VITE_SENTRY_DSN) {
     Sentry.init({
       dsn: import.meta.env.VITE_SENTRY_DSN,
       environment: import.meta.env.MODE,
       integrations: [
         Sentry.browserTracingIntegration(),
         Sentry.replayIntegration(),
       ],
       tracesSampleRate: 1.0,
       replaysSessionSampleRate: 0.1,
       replaysOnErrorSampleRate: 1.0,
     });
   }
   ```

4. **Update `client/src/components/ErrorBoundary.jsx`**
   - Line ~29: Replace TODO with actual Sentry call
   ```javascript
   componentDidCatch(error, errorInfo) {
     console.error("ErrorBoundary caught:", error, errorInfo);

     // Send to Sentry if configured
     if (window.Sentry) {
       window.Sentry.captureException(error, {
         contexts: {
           react: {
             componentStack: errorInfo.componentStack
           }
         }
       });
     }
   }
   ```

5. **Update `server/index.js`** - Server-side Sentry
   ```javascript
   import * as Sentry from "@sentry/node";

   // Initialize Sentry (add near top, after imports)
   if (process.env.SENTRY_DSN) {
     Sentry.init({
       dsn: process.env.SENTRY_DSN,
       environment: process.env.SENTRY_ENVIRONMENT || 'development',
       tracesSampleRate: 1.0,
     });
   }

   // Add error handler middleware (before app.listen)
   if (process.env.SENTRY_DSN) {
     app.use(Sentry.Handlers.errorHandler());
   }
   ```

6. **Create Sentry project** (Optional now, required for production)
   - Go to sentry.io and create account
   - Create two projects: "wordleplus-client" and "wordleplus-server"
   - Copy DSN values to .env file

**Testing**:
```bash
# Test 1: Error should appear in Sentry dashboard
# In client, temporarily add: throw new Error("Test error");
# Check Sentry dashboard for error

# Test 2: Server error tracking
# In server, temporarily add error in a route
# Check Sentry dashboard

# Test 3: Works without Sentry DSN (graceful degradation)
unset VITE_SENTRY_DSN
npm run dev  # Should work fine, just log to console
```

**Success Criteria**:
- ✅ Errors appear in Sentry dashboard when DSN configured
- ✅ App works fine when Sentry DSN not configured (optional dependency)
- ✅ Both client and server errors tracked
- ✅ Error context includes useful debugging info

---

### **Task 1.3: Fix Silent Error Handling** (Priority: CRITICAL)
**Time Estimate**: 1 hour
**Files to modify**:
- `client/src/components/GameRouter.jsx`

**Steps**:

1. **Update `client/src/components/GameRouter.jsx` - Line 136**
   ```javascript
   // BEFORE:
   try {
     await duelActions.playAgain(roomId);
   } catch (e) {}

   // AFTER:
   try {
     await duelActions.playAgain(roomId);
   } catch (error) {
     console.error('Failed to start rematch:', error);

     // Show error to user
     if (setMsg) {
       setMsg('Failed to start rematch. Please try again.');
     }

     // Track in Sentry
     if (window.Sentry) {
       window.Sentry.captureException(error, {
         tags: { action: 'rematch' }
       });
     }
   }
   ```

2. **Search for other empty catch blocks**
   ```bash
   # Run this search:
   grep -r "catch.*{}" client/src server/
   # Fix any other instances found
   ```

**Testing**:
```bash
# Test: Trigger rematch failure
# 1. Start a duel game
# 2. Disconnect server
# 3. Click "Play Again"
# 4. Should see error message to user
```

**Success Criteria**:
- ✅ No empty catch blocks remain
- ✅ Users see error messages when actions fail
- ✅ Errors logged to console and Sentry

---

### **Task 1.4: Leaderboard Decision** (Priority: HIGH)
**Time Estimate**: 2 hours (Option A) or 15 min (Option B)
**Files to modify**:
- `client/src/screens/HomeScreenV2.jsx`
- `server/index.js` (if implementing)

**Decision Required**: Choose ONE approach

**Option A: Implement Basic Leaderboard (Recommended for v1.0)**

Steps:
1. **Add leaderboard API endpoint `server/index.js`**
   ```javascript
   app.get('/api/leaderboard/top-players', async (req, res) => {
     try {
       const topPlayers = await prisma.user.findMany({
         where: { isAnonymous: false },
         orderBy: { totalWins: 'desc' },
         take: 10,
         select: {
           displayName: true,
           username: true,
           totalWins: true,
           totalGames: true,
         }
       });
       res.json(topPlayers);
     } catch (error) {
       console.error('Leaderboard error:', error);
       res.status(500).json({ error: 'Failed to fetch leaderboard' });
     }
   });

   app.get('/api/leaderboard/streaks', async (req, res) => {
     try {
       const topStreaks = await prisma.user.findMany({
         where: { isAnonymous: false },
         orderBy: { longestStreak: 'desc' },
         take: 10,
         select: {
           displayName: true,
           username: true,
           streak: true,
           longestStreak: true,
         }
       });
       res.json(topStreaks);
     } catch (error) {
       console.error('Streaks error:', error);
       res.status(500).json({ error: 'Failed to fetch streaks' });
     }
   });
   ```

2. **Update `HomeScreenV2.jsx`** - Replace "Coming soon..." with API calls
   ```javascript
   const [topPlayers, setTopPlayers] = useState([]);
   const [topStreaks, setTopStreaks] = useState([]);

   useEffect(() => {
     fetch(`${SERVER_URL}/api/leaderboard/top-players`)
       .then(r => r.json())
       .then(setTopPlayers)
       .catch(console.error);

     fetch(`${SERVER_URL}/api/leaderboard/streaks`)
       .then(r => r.json())
       .then(setTopStreaks)
       .catch(console.error);
   }, []);
   ```

**Option B: Remove Leaderboard Sections (Ship v1.0 without it)**

Steps:
1. **Comment out or remove leaderboard sections in `HomeScreenV2.jsx`**
   - Lines ~720-750 (Top Players section)
   - Lines ~752-782 (Recent Streaks section)

2. **Add to backlog for v1.1**
   - Create GitHub issue: "Leaderboard feature"
   - Add to post-launch roadmap

**Recommendation**: Choose Option B for faster shipping, implement Option A post-launch

**Success Criteria**:
- ✅ No "Coming soon..." placeholders visible to users
- ✅ Either working leaderboards OR sections removed

---

### **Task 1.5: Rate Limiting** (Priority: HIGH)
**Time Estimate**: 2 hours
**Files to modify**:
- `server/index.js`

**Steps**:

1. **Install rate limiting packages**
   ```bash
   cd server
   npm install express-rate-limit rate-limit-redis ioredis
   ```

2. **Create `server/middleware/rateLimiter.js`**
   ```javascript
   import rateLimit from 'express-rate-limit';

   // API endpoints rate limiter
   export const apiLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // Limit each IP to 100 requests per window
     message: 'Too many requests, please try again later.',
     standardHeaders: true,
     legacyHeaders: false,
   });

   // Strict limiter for sensitive endpoints
   export const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5, // Only 5 login attempts per 15 minutes
     message: 'Too many attempts, please try again later.',
   });

   // Socket.IO rate limiting (in-memory)
   const socketRateLimits = new Map();

   export function checkSocketRateLimit(socketId, event, maxPerMinute = 60) {
     const key = `${socketId}:${event}`;
     const now = Date.now();

     if (!socketRateLimits.has(key)) {
       socketRateLimits.set(key, { count: 1, resetAt: now + 60000 });
       return true;
     }

     const limit = socketRateLimits.get(key);
     if (now > limit.resetAt) {
       socketRateLimits.set(key, { count: 1, resetAt: now + 60000 });
       return true;
     }

     if (limit.count >= maxPerMinute) {
       return false;
     }

     limit.count++;
     return true;
   }

   // Cleanup old entries every 5 minutes
   setInterval(() => {
     const now = Date.now();
     for (const [key, value] of socketRateLimits.entries()) {
       if (now > value.resetAt + 60000) {
         socketRateLimits.delete(key);
       }
     }
   }, 5 * 60 * 1000);
   ```

3. **Apply rate limiting in `server/index.js`**
   ```javascript
   import { apiLimiter, authLimiter, checkSocketRateLimit } from './middleware/rateLimiter.js';

   // Apply to all API routes
   app.use('/api/', apiLimiter);

   // Apply stricter limits to auth routes
   app.use('/auth/', authLimiter);
   ```

4. **Add Socket.IO rate limiting** - Wrap critical socket handlers
   ```javascript
   // Example: In makeGuess handler
   socket.on('makeGuess', (data) => {
     if (!checkSocketRateLimit(socket.id, 'makeGuess', 10)) {
       socket.emit('error', { message: 'Too many guesses. Slow down!' });
       return;
     }

     // ... rest of handler
   });

   // Apply to: makeGuess, guessBattle, createRoom, joinRoom
   ```

**Testing**:
```bash
# Test 1: API rate limiting
curl -X POST http://localhost:8080/api/daily/guess \
  -H "Content-Type: application/json" \
  -d '{"guess":"HOUSE"}' \
  # Run 101 times rapidly - should see 429 error

# Test 2: Socket rate limiting
# Open browser console, run:
for (let i = 0; i < 20; i++) {
  socket.emit('makeGuess', { guess: 'HOUSE' });
}
# Should see rate limit error
```

**Success Criteria**:
- ✅ HTTP endpoints return 429 when rate limit exceeded
- ✅ Socket events reject with error message when rate limited
- ✅ Legitimate users not affected by rate limits
- ✅ Memory cleaned up (no memory leak from rate limit map)

---

### **Task 1.6: Health Check Endpoint** (Priority: HIGH)
**Time Estimate**: 1 hour
**Files to modify**:
- `server/index.js`

**Steps**:

1. **Add health check endpoint to `server/index.js`**
   ```javascript
   // Add near other API routes
   app.get('/health', async (req, res) => {
     const health = {
       status: 'ok',
       timestamp: new Date().toISOString(),
       uptime: process.uptime(),
       environment: process.env.NODE_ENV || 'development',
     };

     // Check database connection
     try {
       await prisma.$queryRaw`SELECT 1`;
       health.database = 'connected';
     } catch (error) {
       health.database = 'disconnected';
       health.status = 'degraded';
     }

     // Check word lists loaded
     health.wordLists = {
       words: WORDSET.size,
       guesses: GUESSSET.size,
     };

     // Check active rooms
     health.activeRooms = io.rooms?.size || 0;

     const statusCode = health.status === 'ok' ? 200 : 503;
     res.status(statusCode).json(health);
   });

   // Readiness check (for Kubernetes)
   app.get('/ready', (req, res) => {
     const isReady = WORDSET.size > 0 && GUESSSET.size > 0;
     if (isReady) {
       res.status(200).json({ ready: true });
     } else {
       res.status(503).json({ ready: false, reason: 'Word lists not loaded' });
     }
   });

   // Liveness check (for Kubernetes)
   app.get('/alive', (req, res) => {
     res.status(200).json({ alive: true });
   });
   ```

**Testing**:
```bash
# Test health endpoint
curl http://localhost:8080/health
# Should return 200 with full health info

# Test readiness
curl http://localhost:8080/ready

# Test liveness
curl http://localhost:8080/alive

# Test degraded state (stop database)
docker stop postgres  # or equivalent
curl http://localhost:8080/health
# Should return 503 with database: 'disconnected'
```

**Success Criteria**:
- ✅ `/health` returns 200 when healthy, 503 when degraded
- ✅ Includes database, word lists, and room count
- ✅ `/ready` and `/alive` work for orchestration
- ✅ Load balancers can use health checks

---

## 🎯 Week 1 Deliverables

By end of Week 1, you should have:
- ✅ App deployable to any environment via .env only
- ✅ Error tracking configured (Sentry)
- ✅ No silent error handling
- ✅ Leaderboard either working or removed
- ✅ Rate limiting on all critical endpoints
- ✅ Health check endpoints for monitoring

**Testing Checkpoint**:
```bash
# Deploy to staging environment
# Change only .env file
# App should work perfectly
```

---

## WEEK 2: Security & Stability

### 🎯 Goal: Harden app for production traffic

---

### **Task 2.1: Accessibility Audit & Fixes** (Priority: HIGH)
**Time Estimate**: 6 hours
**Files to modify**: Multiple component files

**Steps**:

1. **Install accessibility testing tools**
   ```bash
   cd client
   npm install --save-dev @axe-core/react eslint-plugin-jsx-a11y
   ```

2. **Add accessibility linting to `client/.eslintrc.cjs`**
   ```javascript
   {
     extends: [
       // ... existing
       'plugin:jsx-a11y/recommended'
     ],
     plugins: ['jsx-a11y']
   }
   ```

3. **Add axe DevTools in development** - Update `client/src/main.jsx`
   ```javascript
   if (import.meta.env.DEV) {
     import('@axe-core/react').then(axe => {
       axe.default(React, ReactDOM, 1000);
     });
   }
   ```

4. **Run accessibility audit**
   ```bash
   npm run dev
   # Open browser console, check axe violations
   # Use Lighthouse accessibility audit
   # Use WAVE browser extension
   ```

5. **Fix critical issues** (Priority order)

   **A. Keyboard Navigation**
   - All interactive elements focusable
   - Focus indicators visible
   - Logical tab order
   - Escape key closes modals

   **B. Screen Reader Support**
   - Add ARIA labels to buttons without text
   - Add ARIA live regions for game state updates
   - Add alt text to all images
   - Add proper heading hierarchy

   **C. Color Contrast**
   - Ensure 4.5:1 contrast ratio for text
   - Don't rely on color alone (add patterns/icons)

   **D. Focus Management**
   - Trap focus in modals
   - Return focus after modal closes
   - Auto-focus first input in forms

6. **Key components to fix**:

   **`components/Board.jsx`** - Add ARIA for game board
   ```javascript
   <div
     className="board"
     role="grid"
     aria-label="Wordle game board"
   >
     {rows.map((row, i) => (
       <div
         key={i}
         role="row"
         aria-label={`Row ${i + 1}`}
       >
         {/* cells */}
       </div>
     ))}
   </div>
   ```

   **`components/Keyboard.jsx`** - Add ARIA labels
   ```javascript
   <button
     onClick={() => onKey(key)}
     aria-label={`Letter ${key}`}
     className={getKeyClass(key)}
   >
     {key}
   </button>
   ```

   **`components/VictoryModal.jsx`** - Focus trap and announcements
   ```javascript
   useEffect(() => {
     if (isOpen) {
       // Announce to screen readers
       const announcement = won
         ? `You won! The word was ${secretWord}`
         : `Game over. The word was ${secretWord}`;

       // Create live region announcement
       const liveRegion = document.createElement('div');
       liveRegion.setAttribute('role', 'status');
       liveRegion.setAttribute('aria-live', 'polite');
       liveRegion.textContent = announcement;
       document.body.appendChild(liveRegion);

       return () => liveRegion.remove();
     }
   }, [isOpen, won, secretWord]);
   ```

**Testing**:
```bash
# Test 1: Keyboard only navigation
# Tab through entire app without mouse
# Should be able to play game with keyboard only

# Test 2: Screen reader (NVDA/JAWS/VoiceOver)
# Navigate app with screen reader
# All content should be announced

# Test 3: Lighthouse accessibility score
# Should be 90+ score
```

**Success Criteria**:
- ✅ Lighthouse accessibility score > 90
- ✅ Can play entire game with keyboard only
- ✅ Screen reader announces all game states
- ✅ No axe DevTools violations in console

---

### **Task 2.2: Session Management Cleanup** (Priority: MEDIUM)
**Time Estimate**: 3 hours
**Files to modify**:
- `server/index.js`
- `server/auth.js`
- Documentation

**Steps**:

1. **Document the two session systems** - Add to `CLAUDE.md`
   ```markdown
   ## Session Architecture

   WordlePlus uses two session tables:

   1. **express-session** (`user_sessions` table via connect-pg-simple)
      - Used for: HTTP cookie-based authentication
      - Stores: Express session data, user ID
      - Cleanup: Automatic via connect-pg-simple

   2. **Prisma Session** (`Session` table)
      - Used for: Device tracking, anonymous users
      - Stores: Device ID, session tokens, metadata
      - Cleanup: Manual via cron or scheduled job

   This is intentional - express-session handles auth,
   Prisma Session handles device/analytics tracking.
   ```

2. **Add session cleanup job** - Create `server/jobs/cleanupSessions.js`
   ```javascript
   import { prisma } from '../daily-db.js';

   export async function cleanupExpiredSessions() {
     const now = new Date();

     const result = await prisma.session.deleteMany({
       where: {
         expiresAt: {
           lt: now
         }
       }
     });

     console.log(`🧹 Cleaned up ${result.count} expired sessions`);
     return result.count;
   }

   // Run cleanup every hour
   export function startSessionCleanup() {
     cleanupExpiredSessions(); // Run immediately

     setInterval(() => {
       cleanupExpiredSessions();
     }, 60 * 60 * 1000); // Every hour
   }
   ```

3. **Start cleanup job in `server/index.js`**
   ```javascript
   import { startSessionCleanup } from './jobs/cleanupSessions.js';

   // After server starts
   httpServer.listen(PORT, () => {
     console.log(`✅ Server running on port ${PORT}`);

     // Start background jobs
     startSessionCleanup();
   });
   ```

**Testing**:
```bash
# Test: Create expired session, verify cleanup
# 1. Manually insert expired session in DB
# 2. Wait for cleanup job to run (or trigger manually)
# 3. Verify session deleted
```

**Success Criteria**:
- ✅ Session cleanup runs automatically
- ✅ Expired sessions removed from database
- ✅ Documentation explains dual session approach

---

### **Task 2.3: Database Migration Strategy** (Priority: MEDIUM)
**Time Estimate**: 2 hours
**Deliverable**: Documentation + scripts

**Steps**:

1. **Create `server/prisma/MIGRATIONS.md`**
   ```markdown
   # Database Migration Guide

   ## Creating Migrations

   ```bash
   # 1. Edit schema.prisma
   # 2. Create migration
   npm run prisma:migrate:dev --name describe_your_change

   # 3. Test migration on fresh DB
   npm run prisma:migrate:reset
   npm run prisma:migrate:dev
   ```

   ## Deploying Migrations

   ```bash
   # Production (do NOT use migrate:dev)
   npm run prisma:migrate:deploy
   ```

   ## Rollback Procedure

   If migration fails in production:

   1. **Don't panic** - DB is in transaction
   2. Fix the migration file
   3. Run migrate:deploy again

   If data corruption occurred:
   1. Restore from backup
   2. Review migration
   3. Test on staging first
   4. Re-deploy

   ## Backup Before Migration

   ```bash
   # PostgreSQL backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # Restore if needed
   psql $DATABASE_URL < backup_20240101_120000.sql
   ```
   ```

2. **Create pre-deploy script** - `server/scripts/pre-deploy.sh`
   ```bash
   #!/bin/bash
   set -e

   echo "🔍 Pre-Deployment Checks"

   # Check required env vars
   if [ -z "$DATABASE_URL" ]; then
     echo "❌ DATABASE_URL not set"
     exit 1
   fi

   # Test database connection
   npx prisma db execute --stdin <<< "SELECT 1" || {
     echo "❌ Cannot connect to database"
     exit 1
   }

   # Generate Prisma Client
   echo "📦 Generating Prisma Client..."
   npx prisma generate

   # Show pending migrations
   echo "📋 Pending migrations:"
   npx prisma migrate status

   echo "✅ Pre-deployment checks passed"
   ```

3. **Update `package.json`** with deployment script
   ```json
   {
     "scripts": {
       "deploy": "bash scripts/pre-deploy.sh && npx prisma migrate deploy && node index.js"
     }
   }
   ```

**Success Criteria**:
- ✅ Migration process documented
- ✅ Rollback procedure defined
- ✅ Pre-deploy script validates environment

---

### **Task 2.4: CORS Security Hardening** (Priority: HIGH)
**Time Estimate**: 2 hours
**Files to modify**:
- `server/index.js`

**Steps**:

1. **Simplify CORS configuration in `server/index.js`**
   ```javascript
   // BEFORE: Complex suffix matching logic (~50 lines)

   // AFTER: Simpler, more secure
   function getCorsOptions() {
     const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
       ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
       : ['http://localhost:5000', 'http://localhost:5173'];

     const allowedSuffixes = process.env.CORS_ALLOWED_ORIGIN_SUFFIXES
       ? process.env.CORS_ALLOWED_ORIGIN_SUFFIXES.split(',').map(s => s.trim())
       : [];

     return {
       origin: function (origin, callback) {
         // Allow requests with no origin (mobile apps, curl, etc.)
         if (!origin) return callback(null, true);

         // Check exact match
         if (allowedOrigins.includes(origin)) {
           return callback(null, true);
         }

         // Check suffix match (for preview deploys)
         if (allowedSuffixes.some(suffix => origin.endsWith(suffix))) {
           return callback(null, true);
         }

         // Reject
         callback(new Error(`CORS: Origin ${origin} not allowed`));
       },
       credentials: true,
     };
   }

   const corsOptions = getCorsOptions();
   app.use(cors(corsOptions));
   io.engine.use(cors(corsOptions));
   ```

2. **Add CORS security headers**
   ```javascript
   // Add helmet for security headers
   import helmet from 'helmet';

   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         connectSrc: ["'self'", ...allowedOrigins],
         scriptSrc: ["'self'", "'unsafe-inline'"], // For Vite HMR in dev
       }
     },
     crossOriginEmbedderPolicy: false, // For Socket.IO
   }));
   ```

3. **Log CORS rejections**
   ```javascript
   app.use((err, req, res, next) => {
     if (err.message.startsWith('CORS:')) {
       console.warn(`🚫 CORS rejected: ${req.headers.origin}`);

       if (window.Sentry) {
         Sentry.captureMessage(err.message, {
           level: 'warning',
           extra: { origin: req.headers.origin }
         });
       }
     }
     next(err);
   });
   ```

**Testing**:
```bash
# Test 1: Allowed origin works
curl -H "Origin: http://localhost:5000" http://localhost:8080/health
# Should include Access-Control-Allow-Origin header

# Test 2: Disallowed origin blocked
curl -H "Origin: http://evil.com" http://localhost:8080/health
# Should NOT include CORS headers

# Test 3: Suffix matching works
export CORS_ALLOWED_ORIGIN_SUFFIXES=".vercel.app"
curl -H "Origin: https://myapp-preview.vercel.app" http://localhost:8080/health
# Should allow
```

**Success Criteria**:
- ✅ Only configured origins allowed
- ✅ CORS rejections logged
- ✅ Security headers present
- ✅ Simpler, more maintainable code

---

### **Task 2.5: Word List Error Handling** (Priority: MEDIUM)
**Time Estimate**: 1 hour
**Files to modify**:
- `server/index.js`

**Steps**:

1. **Make word list loading async with better errors**
   ```javascript
   // BEFORE: Synchronous loading
   const WORDSET = new Set(
     fs.readFileSync(wordsPath, "utf-8")
       .split("\n")
       .map((w) => w.trim().toUpperCase())
       .filter((w) => w.length === 5)
   );

   // AFTER: Async with validation
   async function loadWordLists() {
     const wordsPath = process.env.WORDLIST_PATH || "./words.txt";
     const guessesPath = process.env.GUESSES_PATH || "./allowed_guesses.txt";

     // Check files exist
     if (!fs.existsSync(wordsPath)) {
       throw new Error(`Word list not found: ${wordsPath}`);
     }
     if (!fs.existsSync(guessesPath)) {
       throw new Error(`Guess list not found: ${guessesPath}`);
     }

     // Load words
     const wordsContent = await fs.promises.readFile(wordsPath, 'utf-8');
     const guessesContent = await fs.promises.readFile(guessesPath, 'utf-8');

     const words = wordsContent
       .split('\n')
       .map(w => w.trim().toUpperCase())
       .filter(w => w.length === 5);

     const guesses = guessesContent
       .split('\n')
       .map(w => w.trim().toUpperCase())
       .filter(w => w.length === 5);

     // Validate
     if (words.length === 0) {
       throw new Error('Word list is empty!');
     }
     if (guesses.length === 0) {
       throw new Error('Guess list is empty!');
     }

     console.log(`✅ Loaded ${words.length} words, ${guesses.length} allowed guesses`);

     return {
       WORDSET: new Set(words),
       GUESSSET: new Set([...words, ...guesses])
     };
   }
   ```

2. **Update server startup**
   ```javascript
   // At top level
   let WORDSET, GUESSSET;

   async function startServer() {
     try {
       // Validate config first
       validateConfig();

       // Load word lists
       const wordLists = await loadWordLists();
       WORDSET = wordLists.WORDSET;
       GUESSSET = wordLists.GUESSSET;

       // Start server
       const PORT = process.env.PORT || 8080;
       httpServer.listen(PORT, () => {
         console.log(`✅ Server running on port ${PORT}`);
         console.log(`📚 Word lists loaded: ${WORDSET.size} words`);
       });

     } catch (error) {
       console.error('❌ Server startup failed:', error.message);
       process.exit(1);
     }
   }

   startServer();
   ```

**Testing**:
```bash
# Test 1: Missing word file
mv words.txt words.txt.bak
npm run dev
# Should exit with clear error

# Test 2: Empty word file
echo "" > words.txt
npm run dev
# Should exit with "Word list is empty!"

# Test 3: Corrupted file
echo "invalid@#$%" > words.txt
npm run dev
# Should handle gracefully
```

**Success Criteria**:
- ✅ Server exits gracefully if word lists missing/invalid
- ✅ Clear error messages explain what's wrong
- ✅ Async loading doesn't block other initialization

---

## 🎯 Week 2 Deliverables

By end of Week 2:
- ✅ Accessibility score > 90 (Lighthouse)
- ✅ Session cleanup automated
- ✅ Migration strategy documented
- ✅ CORS hardened and simplified
- ✅ Word list loading robust

---

## WEEK 3: Testing & Quality

### 🎯 Goal: Comprehensive test coverage for critical paths

---

### **Task 3.1: Integration Tests - Socket.IO Flows** (Priority: CRITICAL)
**Time Estimate**: 8 hours
**Files to create**:
- `server/tests/integration/duel-flow.test.js`
- `server/tests/integration/battle-flow.test.js`
- `server/tests/integration/room-management.test.js`

**Steps**:

1. **Install testing dependencies**
   ```bash
   cd server
   npm install --save-dev socket.io-client @testing-library/jest-dom
   ```

2. **Create test helper** - `server/tests/helpers/socketTestHelper.js`
   ```javascript
   import { io as ioClient } from 'socket.io-client';
   import { createServer } from 'http';
   import { Server } from 'socket.io';

   export function createTestServer() {
     const httpServer = createServer();
     const io = new Server(httpServer);

     return new Promise((resolve) => {
       httpServer.listen(() => {
         const port = httpServer.address().port;
         resolve({ httpServer, io, port });
       });
     });
   }

   export function createTestClient(port) {
     return ioClient(`http://localhost:${port}`, {
       reconnectionDelay: 0,
       forceNew: true,
       transports: ['websocket']
     });
   }

   export function waitForEvent(socket, event) {
     return new Promise((resolve) => {
       socket.once(event, resolve);
     });
   }
   ```

3. **Create `server/tests/integration/duel-flow.test.js`**
   ```javascript
   import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
   import { createTestServer, createTestClient, waitForEvent } from '../helpers/socketTestHelper.js';

   describe('Duel Game Flow Integration', () => {
     let server, io, port;
     let player1Socket, player2Socket;

     beforeEach(async () => {
       ({ httpServer: server, io, port } = await createTestServer());

       // Register duel mode handlers
       // (import and register your actual handlers)

       player1Socket = createTestClient(port);
       player2Socket = createTestClient(port);

       await Promise.all([
         waitForEvent(player1Socket, 'connect'),
         waitForEvent(player2Socket, 'connect')
       ]);
     });

     afterEach(() => {
       player1Socket.disconnect();
       player2Socket.disconnect();
       server.close();
     });

     it('should complete full duel game flow', async () => {
       // 1. Player 1 creates room
       player1Socket.emit('createRoom', {
         name: 'Alice',
         mode: 'duel',
         roomId: 'TEST123'
       });

       const roomState1 = await waitForEvent(player1Socket, 'roomState');
       expect(roomState1.players).toHaveLength(1);
       expect(roomState1.status).toBe('lobby');

       // 2. Player 2 joins room
       player2Socket.emit('joinRoom', {
         name: 'Bob',
         roomId: 'TEST123'
       });

       const roomState2 = await waitForEvent(player2Socket, 'roomState');
       expect(roomState2.players).toHaveLength(2);

       // 3. Both players set secret words
       player1Socket.emit('setSecret', { word: 'HOUSE' });
       player2Socket.emit('setSecret', { word: 'MOUSE' });

       const gameStart = await waitForEvent(player1Socket, 'roomState');
       expect(gameStart.status).toBe('playing');

       // 4. Players make guesses
       player1Socket.emit('makeGuess', { guess: 'MEOWS' });
       const guess1 = await waitForEvent(player1Socket, 'roomState');
       expect(guess1.players[0].guesses).toHaveLength(1);

       // 5. Test win condition
       player2Socket.emit('makeGuess', { guess: 'HOUSE' });
       const winState = await waitForEvent(player2Socket, 'roomState');
       expect(winState.players[1].solved).toBe(true);
     });

     it('should handle player disconnection', async () => {
       // Create game
       player1Socket.emit('createRoom', {
         name: 'Alice',
         mode: 'duel',
         roomId: 'TEST456'
       });

       await waitForEvent(player1Socket, 'roomState');

       player2Socket.emit('joinRoom', {
         name: 'Bob',
         roomId: 'TEST456'
       });

       await waitForEvent(player2Socket, 'roomState');

       // Player 2 disconnects
       player2Socket.disconnect();

       // Player 1 should be notified
       const stateAfterDisconnect = await waitForEvent(player1Socket, 'roomState');
       expect(stateAfterDisconnect.players).toHaveLength(1);
     });
   });
   ```

4. **Create similar tests for**:
   - Battle Royale flow
   - Room management (create, join, leave)
   - Daily challenge flow
   - Rematch flow

**Testing**:
```bash
cd server
npm test -- integration
# All integration tests should pass
```

**Success Criteria**:
- ✅ Full game flows tested end-to-end
- ✅ Edge cases covered (disconnects, invalid moves)
- ✅ Tests run reliably (no flakiness)
- ✅ Coverage > 80% for socket handlers

---

### **Task 3.2: Client E2E Tests (Playwright)** (Priority: HIGH)
**Time Estimate**: 6 hours
**Files to create**: `client/tests/e2e/*.spec.js`

**Steps**:

1. **Install Playwright**
   ```bash
   cd client
   npm install --save-dev @playwright/test
   npx playwright install
   ```

2. **Create `playwright.config.js`**
   ```javascript
   export default {
     testDir: './tests/e2e',
     use: {
       baseURL: 'http://localhost:5173',
       screenshot: 'only-on-failure',
       video: 'retain-on-failure',
     },
     webServer: {
       command: 'npm run dev',
       port: 5173,
       reuseExistingServer: true,
     },
   };
   ```

3. **Create `client/tests/e2e/daily-challenge.spec.js`**
   ```javascript
   import { test, expect } from '@playwright/test';

   test('can play daily challenge', async ({ page }) => {
     // Navigate to app
     await page.goto('/');

     // Click Daily Challenge
     await page.click('text=Daily Challenge');

     // Wait for game board
     await expect(page.locator('.board')).toBeVisible();

     // Make a guess using keyboard
     await page.keyboard.type('HOUSE');
     await page.keyboard.press('Enter');

     // Verify guess appears on board
     await expect(page.locator('.board-row').first()).toContainText('HOUSE');

     // Verify keyboard updates
     const hKey = page.locator('button:has-text("H")');
     await expect(hKey).toHaveClass(/present|absent|correct/);
   });

   test('shows error for invalid word', async ({ page }) => {
     await page.goto('/');
     await page.click('text=Daily Challenge');

     // Try invalid word
     await page.keyboard.type('ZZZZZ');
     await page.keyboard.press('Enter');

     // Should see error message
     await expect(page.locator('text=/not in word list/i')).toBeVisible();
   });
   ```

4. **Create tests for**:
   - Duel mode (create, join, play)
   - Battle mode
   - Room creation/joining
   - Victory modal
   - Rematch flow

5. **Add to package.json**
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui"
     }
   }
   ```

**Testing**:
```bash
cd client
npm run test:e2e
# All E2E tests pass
```

**Success Criteria**:
- ✅ Critical user flows tested
- ✅ Tests run in CI/CD
- ✅ Screenshots/videos on failure
- ✅ Reliable (no flakiness)

---

### **Task 3.3: Bundle Analysis & Optimization** (Priority: MEDIUM)
**Time Estimate**: 3 hours
**Files to modify**:
- `client/vite.config.js`
- `client/package.json`

**Steps**:

1. **Install bundle analyzer**
   ```bash
   cd client
   npm install --save-dev rollup-plugin-visualizer
   ```

2. **Update `vite.config.js`**
   ```javascript
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     plugins: [
       react(),
       visualizer({
         filename: './dist/stats.html',
         open: true,
         gzipSize: true,
       })
     ],
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'react-vendor': ['react', 'react-dom'],
             'socket': ['socket.io-client'],
             'utils': ['framer-motion', 'lucide-react'],
           }
         }
       }
     }
   });
   ```

3. **Run analysis**
   ```bash
   npm run build
   # Opens stats.html with bundle visualization
   ```

4. **Optimize based on findings**:
   - Lazy load screens: `const DuelScreen = lazy(() => import('./screens/DuelGameScreen'))`
   - Remove unused dependencies
   - Optimize images (use WebP)
   - Enable compression

5. **Add bundle size check to CI**
   ```json
   {
     "scripts": {
       "check-bundle-size": "npm run build && bundlesize"
     }
   }
   ```

**Success Criteria**:
- ✅ Main bundle < 200KB gzipped
- ✅ Vendor chunks separated
- ✅ Lazy loading for screens
- ✅ Bundle size tracked in CI

---

## 🎯 Week 3 Deliverables

By end of Week 3:
- ✅ Integration tests for all socket flows
- ✅ E2E tests for critical user paths
- ✅ Bundle optimized and analyzed
- ✅ Test coverage > 80%

---

## WEEK 4: Polish & Deploy

### 🎯 Goal: Production deployment

---

### **Task 4.1: Production Deployment Checklist**
**Time Estimate**: Variable

**Infrastructure Setup**:
- [ ] Choose hosting (Vercel, Railway, Render, etc.)
- [ ] PostgreSQL database (Neon, Supabase, etc.)
- [ ] Domain name configured
- [ ] SSL certificates (usually auto via host)
- [ ] CDN for static assets (optional)

**Environment Variables**:
- [ ] All `.env.example` vars set in production
- [ ] `NODE_ENV=production`
- [ ] Sentry DSN configured
- [ ] OAuth credentials for production domain
- [ ] Database URL (production)
- [ ] Session secret (strong random string)

**Pre-Deploy Tests**:
```bash
# 1. Build both apps
cd client && npm run build
cd ../server && npm run build # if applicable

# 2. Run all tests
cd server && npm test
cd ../client && npm run test:e2e

# 3. Check for console.logs
grep -r "console.log" client/src server/ --exclude-dir=node_modules
# Remove any remaining

# 4. Security audit
npm audit
npm audit fix

# 5. Performance check
npm run build
lighthouse http://localhost:4173 --view
```

**Deployment Steps**:
1. Deploy database (run migrations)
2. Deploy backend (with health checks)
3. Deploy frontend (pointing to backend)
4. Verify health endpoints
5. Test critical flows manually
6. Enable monitoring
7. Set up alerts

**Post-Deploy Monitoring**:
- [ ] Error tracking active (Sentry)
- [ ] Uptime monitoring (UptimeRobot, etc.)
- [ ] Performance monitoring
- [ ] Database query performance

---

### **Task 4.2: Documentation**
**Time Estimate**: 2 hours

**Update Files**:
1. **README.md** - User-facing
   - What is WordlePlus
   - How to play
   - Features
   - Tech stack

2. **CONTRIBUTING.md** - Developer onboarding
   - Setup instructions
   - Development workflow
   - Testing
   - Pull request process

3. **DEPLOYMENT.md** - Ops guide
   - Deployment process
   - Environment variables
   - Monitoring
   - Troubleshooting

4. **CHANGELOG.md** - Version history
   - v1.0.0 - Initial release

---

### **Task 4.3: Final QA**
**Manual Testing Checklist**:

**Duel Mode**:
- [ ] Create room
- [ ] Second player joins
- [ ] Both set secret words
- [ ] Make guesses
- [ ] Win/lose conditions
- [ ] Rematch works
- [ ] Disconnect/reconnect

**Battle Mode**:
- [ ] Host creates room
- [ ] Multiple players join
- [ ] Host starts game
- [ ] First to solve wins
- [ ] Play again works

**Daily Challenge**:
- [ ] Can play daily puzzle
- [ ] Progress saves
- [ ] Streak tracking
- [ ] Stats display

**General**:
- [ ] Mobile responsive
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Error messages clear
- [ ] No console errors
- [ ] Performance acceptable

---

## 🎯 Week 4 Deliverables

By end of Week 4:
- ✅ App deployed to production
- ✅ Monitoring active
- ✅ Documentation complete
- ✅ Final QA passed

---

## 🚀 LAUNCH!

**Post-Launch Tasks**:
1. Monitor error rates (first 24h)
2. Track performance metrics
3. Gather user feedback
4. Triage issues into backlog
5. Plan v1.1 features

**v1.1 Roadmap** (Nice-to-Have items):
- Leaderboard implementation
- Audio feedback system
- Player color indicators
- TypeScript migration
- Advanced analytics
- PWA support

---

## 📊 Progress Tracking

Use this checklist to track overall progress:

**Week 1 (Critical)**: ☐
- [ ] Environment configuration
- [ ] Error tracking (Sentry)
- [ ] Silent error fixes
- [ ] Leaderboard decision
- [ ] Rate limiting
- [ ] Health checks

**Week 2 (Security)**: ☐
- [ ] Accessibility fixes
- [ ] Session cleanup
- [ ] Migration docs
- [ ] CORS hardening
- [ ] Word list error handling

**Week 3 (Testing)**: ☐
- [ ] Integration tests
- [ ] E2E tests
- [ ] Bundle optimization

**Week 4 (Deploy)**: ☐
- [ ] Production deployment
- [ ] Documentation
- [ ] Final QA
- [ ] Launch!

---

**Estimated Total Time**: 80-100 hours (2-3 weeks full-time, 4-6 weeks part-time)

**When in doubt**:
1. Test more
2. Document better
3. Ship smaller
4. Iterate quickly

Good luck! 🚀
