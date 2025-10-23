# Building an Authentication System with Anonymous Users & Account Merging

## Tutorial: How to Create a Seamless Auth System for Your Web App

This tutorial teaches you how to build an authentication system that allows users to start playing anonymously and later sign in without losing their progress. This is perfect for games, productivity apps, or any application where you want users to start immediately without registration friction.

---

## 📚 Table of Contents

1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Database Schema Design](#database-schema-design)
4. [Step 1: Anonymous User Tracking](#step-1-anonymous-user-tracking)
5. [Step 2: Session Management](#step-2-session-management)
6. [Step 3: Authentication Setup](#step-3-authentication-setup)
7. [Step 4: Account Merging Logic](#step-4-account-merging-logic)
8. [Step 5: Frontend Integration](#step-5-frontend-integration)
9. [Edge Cases & Testing](#edge-cases--testing)
10. [Common Pitfalls](#common-pitfalls)

---

## System Overview

### What We're Building

An authentication system where:
- Users can start using your app **immediately** without signing up
- Their progress is saved to a **real database** (not just localStorage)
- When they **sign in later**, all their anonymous progress merges into their account
- **No data is lost** during the transition
- Stats like wins, games played, and streaks are **accurately combined**

### Tech Stack Used

- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Prisma ORM
- **Auth Provider**: OpenID Connect (OIDC) with Passport.js
- **Session Storage**: PostgreSQL (via connect-pg-simple)
- **Frontend**: React with Context API

---

## Core Concepts

### 1. Anonymous Users Are Real Users

**Key Insight**: Anonymous users aren't "fake" users stored in localStorage. They're real database records with a unique ID.

```javascript
// When a user first visits your app
const anonymousUser = {
  id: "cuid-generated-xyz123",
  isAnonymous: true,
  deviceId: "uuid-from-browser",
  totalGames: 0,
  totalWins: 0,
  // ... they get a full User record
}
```

### 2. Progressive Enhancement

Users experience a **progression**:
1. **Anonymous** → Play immediately, progress saved
2. **Sign In** → Keep all progress, get authenticated features
3. **Authenticated** → Full account with cloud sync across devices

### 3. Merge, Don't Replace

When a user signs in, you **merge** their data, not replace it:
- Anonymous daily results transfer to authenticated account
- Stats are **combined** (not overwritten)
- Conflicts are resolved intelligently (keep the better progress)

---

## Database Schema Design

### Step 1: Create a Flexible User Model

```prisma
model User {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Anonymous user support
  deviceId      String?  @unique        // Browser fingerprint
  isAnonymous   Boolean  @default(true) // All users start anonymous
  
  // Authentication fields (populated when they sign in)
  email         String?  @unique
  username      String?  @unique
  displayName   String?
  avatarUrl     String?
  authProvider  String?  // 'replit' | 'google' | 'github'
  authExternalId String? @unique        // ID from auth provider
  
  // Account linking support
  mergedIntoUserId String?   // If merged into another account
  mergedAt         DateTime? // When the merge happened

  // Game stats (denormalized for performance)
  totalWins     Int @default(0)
  totalGames    Int @default(0)
  streak        Int @default(0)
  longestStreak Int @default(0)

  // Relations
  results  DailyResult[]
  events   Event[]
  sessions Session[]
}
```

**Why This Works**:
- `isAnonymous` flag lets you distinguish user types
- `mergedIntoUserId` prevents re-merging the same account
- Stats are stored directly on User for quick access
- Optional auth fields allow anonymous users to exist

### Step 2: Session Tracking Model

```prisma
model Session {
  id          String   @id @default(cuid())
  userId      String
  deviceId    String?  // Browser/device identifier
  token       String   @unique
  isAnonymous Boolean  @default(true)
  expiresAt   DateTime
  lastSeenAt  DateTime @default(now())
  
  // Connection metadata
  userAgent   String?
  ipAddress   String?
  
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId, expiresAt])
  @@index([token, expiresAt])
}
```

### Step 3: User Data Models

```prisma
model DailyResult {
  id          String   @id @default(cuid())
  userId      String
  puzzleId    String
  
  guesses     Json     // User's guesses
  patterns    Json     // Color patterns
  attempts    Int      // 1-6 attempts
  won         Boolean
  completed   Boolean  @default(false)
  completedAt DateTime?
  
  user   User        @relation(fields: [userId], references: [id])
  puzzle DailyPuzzle @relation(fields: [puzzleId], references: [id])

  @@unique([userId, puzzleId]) // Prevent duplicate results
}
```

**Key Design Decision**: The `@@unique([userId, puzzleId])` constraint ensures users can't have duplicate results for the same puzzle. This is critical for merge conflict resolution.

---

## Step 1: Anonymous User Tracking

### Frontend: Generate and Store User ID

```javascript
// client/src/hooks/useAnonymousUser.js
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'wp.userId';

export function getOrCreateUserId() {
  // Check if user already has an ID
  let userId = localStorage.getItem(STORAGE_KEY);
  
  if (!userId) {
    // Generate a new UUID for this anonymous user
    userId = uuidv4();
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}
```

### Frontend: Send User ID with Every Request

```javascript
// client/src/api.js
import { getOrCreateUserId } from './hooks/useAnonymousUser';

export async function apiCall(endpoint, options = {}) {
  const userId = getOrCreateUserId();
  
  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // Include cookies
    headers: {
      ...options.headers,
      'X-User-Id': userId, // Custom header with user ID
    },
  });
  
  return response.json();
}
```

**Why This Works**:
- UUID is generated client-side (no server round-trip needed)
- Stored in localStorage (persists across sessions)
- Sent via custom header (works even in iframe environments where cookies might fail)

### Backend: Create or Retrieve Anonymous User

```javascript
// server/daily-db.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getOrCreateAnonymousUser(cookieUserId) {
  if (cookieUserId) {
    // Try to find existing user
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    
    if (existing) return existing;
    
    // Create user with the provided ID (from client)
    const user = await prisma.user.create({
      data: { 
        id: cookieUserId,
        isAnonymous: true,
        deviceId: cookieUserId // Use same ID for device tracking
      }
    });
    return user;
  }

  // Fallback: create with auto-generated ID
  const user = await prisma.user.create({
    data: { isAnonymous: true }
  });
  
  return user;
}
```

### Backend: Extract User ID from Request

```javascript
// server/auth.js
export function getUserIdFromRequest(req) {
  // Priority order for finding user ID:
  
  // 1. Authenticated user (highest priority)
  if (req.user?.dbUserId) {
    return req.user.dbUserId;
  }
  
  // 2. Anonymous session
  if (req.session?.anonymousUserId) {
    return req.session.anonymousUserId;
  }
  
  // 3. Custom header (for iframe environments)
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId) {
    return headerUserId;
  }
  
  // 4. Cookie fallback
  return req.cookies?.dailyUserId || null;
}
```

**The Priority Ladder**:
1. Authenticated user takes precedence (they signed in)
2. Session ID from server-side session storage
3. Header ID from client (works in iframes)
4. Cookie as final fallback

---

## Step 2: Session Management

### Install Dependencies

```bash
npm install express-session connect-pg-simple passport openid-client
```

### Configure PostgreSQL Session Store

```javascript
// server/auth.js
import session from 'express-session';
import connectPg from 'connect-pg-simple';

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
  
  // Create PostgreSQL session store
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,      // Auto-create session table
    ttl: sessionTtl,                  // Session lifetime
    tableName: 'user_sessions',      // Custom table name
  });
  
  return session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    store: sessionStore,              // Use PostgreSQL, not memory
    resave: false,                    // Don't save unchanged sessions
    saveUninitialized: false,         // Don't create session until needed
    cookie: {
      httpOnly: true,                 // Prevent JavaScript access
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      maxAge: sessionTtl,
    },
  });
}
```

**Why PostgreSQL for Sessions?**
- Survives server restarts
- Works across multiple server instances
- Automatic cleanup of expired sessions
- Transaction support for atomic operations

---

## Step 3: Authentication Setup

### Configure OpenID Connect (OIDC)

```javascript
// server/auth.js
import * as client from 'openid-client';
import { Strategy } from 'openid-client/passport';
import passport from 'passport';

// Discover OIDC configuration from provider
const getOidcConfig = async () => {
  return await client.discovery(
    new URL(process.env.ISSUER_URL ?? 'https://replit.com/oidc'),
    process.env.REPL_ID
  );
};

export async function setupAuth(app) {
  // 1. Initialize session middleware
  app.use(getSession());
  
  // 2. Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // 3. Configure OIDC Strategy
  const config = await getOidcConfig();
  
  passport.use(
    'oidc',
    new Strategy(
      {
        client: config,
        params: {
          scope: 'openid profile email',
          redirect_uri: `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/callback`
        }
      },
      async (tokens, verified) => {
        // This callback runs after successful authentication
        const claims = tokens.claims();
        
        // Get anonymous user ID from session (if exists)
        const anonymousUserId = verified.session?.anonymousUserId;
        
        // Create or update authenticated user
        const user = await upsertAuthenticatedUser(claims, anonymousUserId);
        
        return user;
      }
    )
  );
  
  // 4. Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, { dbUserId: user.id });
  });
  
  // 5. Deserialize user from session
  passport.deserializeUser(async (sessionData, done) => {
    done(null, sessionData);
  });
}
```

### Authentication Routes

```javascript
// Login route - initiates auth flow
app.get('/api/login', 
  (req, res, next) => {
    // Store anonymous user ID in session before redirecting
    const userId = getUserIdFromRequest(req);
    if (userId) {
      req.session.anonymousUserId = userId;
    }
    next();
  },
  passport.authenticate('oidc')
);

// Callback route - handles return from auth provider
app.get('/api/callback',
  passport.authenticate('oidc', {
    successRedirect: '/',
    failureRedirect: '/login-failed'
  })
);

// Logout route
app.get('/api/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Get current user profile
app.get('/api/auth/user', async (req, res) => {
  let userId = getUserIdFromRequest(req);
  
  // If no user session exists, create an anonymous one
  if (!userId) {
    const user = await getOrCreateAnonymousUser(null);
    userId = user.id;
    req.session.anonymousUserId = userId;
    await req.session.save();
  }
  
  // Get full user profile with stats
  const profile = await getFullUserProfile(userId);
  res.json(profile);
});
```

---

## Step 4: Account Merging Logic

This is the **most complex part** of the system. Here's how to merge anonymous data into authenticated accounts.

### The Merge Function (Simplified)

```javascript
// server/mergeService.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function mergeAnonymousUserIntoExisting(
  anonymousUserId, 
  existingAuthenticatedUserId
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get the anonymous user with all their data
    const anonUser = await tx.user.findUnique({
      where: { id: anonymousUserId },
      include: {
        results: true,  // Daily puzzle results
        events: true,   // Analytics events
      }
    });

    // Validation
    if (!anonUser) throw new Error('Anonymous user not found');
    if (!anonUser.isAnonymous) throw new Error('User is not anonymous');

    // 2. Get the existing authenticated user
    const existingUser = await tx.user.findUnique({
      where: { id: existingAuthenticatedUserId }
    });

    if (!existingUser) throw new Error('Authenticated user not found');

    // 3. Track what we actually transfer (for accurate stats)
    let transferredGames = 0;
    let transferredWins = 0;

    // 4. Transfer daily results
    if (anonUser.results.length > 0) {
      for (const result of anonUser.results) {
        try {
          // Try to transfer result to authenticated user
          await tx.dailyResult.update({
            where: { id: result.id },
            data: { userId: existingAuthenticatedUserId }
          });
          
          // Successfully transferred - count it
          if (result.completed) {
            transferredGames++;
            if (result.won) transferredWins++;
          }
        } catch (error) {
          // CONFLICT: User already has a result for this puzzle
          await handleConflict(tx, result, existingAuthenticatedUserId, 
            transferredGames, transferredWins);
        }
      }
    }

    // 5. Update authenticated user's stats
    await tx.user.update({
      where: { id: existingAuthenticatedUserId },
      data: {
        totalWins: existingUser.totalWins + transferredWins,
        totalGames: existingUser.totalGames + transferredGames,
        longestStreak: Math.max(existingUser.longestStreak, anonUser.longestStreak),
      }
    });

    // 6. Transfer events
    if (anonUser.events.length > 0) {
      await tx.event.updateMany({
        where: { userId: anonymousUserId },
        data: { userId: existingAuthenticatedUserId }
      });
    }

    // 7. Mark anonymous user as merged (prevents re-merging)
    await tx.user.update({
      where: { id: anonymousUserId },
      data: {
        mergedIntoUserId: existingAuthenticatedUserId,
        mergedAt: new Date(),
      }
    });

    console.log(`Merged ${anonymousUserId} → ${existingAuthenticatedUserId}`);
    console.log(`  Transferred: ${transferredGames} games, ${transferredWins} wins`);
  });
}
```

### Handling Merge Conflicts (The Critical Part)

When both accounts have results for the same puzzle, you need smart conflict resolution:

```javascript
async function handleConflict(
  tx, 
  anonResult, 
  authenticatedUserId, 
  transferredGames, 
  transferredWins
) {
  // Find the existing result
  const existingResult = await tx.dailyResult.findUnique({
    where: {
      userId_puzzleId: {
        userId: authenticatedUserId,
        puzzleId: anonResult.puzzleId
      }
    }
  });

  if (!existingResult) return; // No conflict

  // Keep the result with MORE PROGRESS (more attempts = progressed further)
  if (anonResult.attempts > existingResult.attempts) {
    // Replace existing with anonymous result
    await tx.dailyResult.update({
      where: {
        userId_puzzleId: {
          userId: authenticatedUserId,
          puzzleId: anonResult.puzzleId
        }
      },
      data: {
        guesses: anonResult.guesses,
        patterns: anonResult.patterns,
        attempts: anonResult.attempts,
        won: anonResult.won,
        completed: anonResult.completed,
        completedAt: anonResult.completedAt,
      }
    });

    // ⚠️ CRITICAL: Adjust stats based on what changed
    if (existingResult.completed && anonResult.completed) {
      // Both completed - check if win status changed
      if (anonResult.won && !existingResult.won) {
        transferredWins++;      // Loss → Win
      } else if (!anonResult.won && existingResult.won) {
        transferredWins--;      // Win → Loss
      }
      // If both won or both lost, no change
    } else if (anonResult.completed && !existingResult.completed) {
      // Anonymous completed but existing didn't
      transferredGames++;
      if (anonResult.won) transferredWins++;
    } else if (!anonResult.completed && existingResult.completed) {
      // ⚠️ CRITICAL BUG FIX: Existing was completed but anonymous isn't
      // This happens when user has more attempts but didn't finish
      transferredGames--;  // Remove the completed game from stats
      if (existingResult.won) transferredWins--;
    }
  }
  
  // Delete the anonymous result (we kept the better one)
  await tx.dailyResult.delete({
    where: { id: anonResult.id }
  });
}
```

**Why This Logic is Critical**:
- Without the `else if (!anonResult.completed && existingResult.completed)` case, you get **inflated stats**
- Example: User completes puzzle on authenticated account (wins). Then plays anonymously, gets further but doesn't complete. Merge would replace win with incomplete result but not adjust stats.
- Result: User's stats show a win that doesn't exist in the database.

---

## Step 5: Frontend Integration

### Create Auth Context

```javascript
// client/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function login() {
    window.location.href = '/api/login';
  }

  function logout() {
    window.location.href = '/api/logout';
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: user && !user.isAnonymous,
    isAnonymous: user?.isAnonymous ?? true,
    login,
    logout,
    refreshUser: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

### Use Auth in Components

```javascript
// Example: Profile button
import { useAuth } from '../contexts/AuthContext';

function ProfileButton() {
  const { user, isAuthenticated, isAnonymous, login, logout } = useAuth();

  if (isAnonymous) {
    return (
      <button onClick={login}>
        Sign In to Save Progress
      </button>
    );
  }

  return (
    <div>
      <img src={user.avatarUrl} alt={user.displayName} />
      <span>{user.displayName}</span>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

---

## Edge Cases & Testing

### Test Case 1: Empty Anonymous Account

```javascript
// User signs in without playing anything
const anonUser = {
  id: 'anon123',
  results: [],    // No games played
  events: [],     // No events
  totalGames: 0,
  totalWins: 0
};

// After merge: Authenticated user should be unchanged
```

### Test Case 2: Duplicate Puzzles - Win on Both

```javascript
// Anonymous user: Completed puzzle #42 in 3 attempts (won)
// Authenticated user: Completed puzzle #42 in 4 attempts (won)

// Expected: Keep anonymous result (fewer attempts = better)
// Stats change: None (both are wins)
```

### Test Case 3: Win → Incomplete

```javascript
// Authenticated user: Completed puzzle #42 in 4 attempts (WON)
// Anonymous user: 5 attempts but incomplete (didn't finish)

// Expected: Keep anonymous result (more progress)
// Stats change: -1 game, -1 win (CRITICAL FIX)
```

### Test Case 4: Multiple Conflicts

```javascript
// Both users played puzzles #40, #41, #42, #43, #44
// Each with different progress levels

// Expected: Keep best progress for each puzzle
// Stats change: Net difference after all comparisons
```

---

## Common Pitfalls

### ❌ Pitfall 1: Using localStorage Only

```javascript
// BAD: Data lives only in browser
const stats = JSON.parse(localStorage.getItem('stats'));
// Problem: Lost if user clears browser data, can't sync across devices
```

✅ **Fix**: Store in database, use localStorage only for user ID

### ❌ Pitfall 2: Overwriting Instead of Merging

```javascript
// BAD: Replace authenticated stats with anonymous stats
user.totalGames = anonUser.totalGames;

// GOOD: Add the transferred stats
user.totalGames = user.totalGames + transferredGames;
```

### ❌ Pitfall 3: Ignoring Conflicts

```javascript
// BAD: Just transfer everything, ignore duplicates
await tx.dailyResult.updateMany({
  where: { userId: anonId },
  data: { userId: authId }
});
// Problem: Database constraint violation on duplicate puzzles
```

✅ **Fix**: Handle each result individually with try/catch for conflicts

### ❌ Pitfall 4: Not Using Transactions

```javascript
// BAD: Each operation separate
await transferResults();
await updateStats();  // ← Server crashes here
await markAsMerged(); // ← Never runs, user can merge again
```

✅ **Fix**: Wrap everything in `prisma.$transaction()`

### ❌ Pitfall 5: Forgetting Edge Cases

```javascript
// Missing case: What if old was completed but new isn't?
if (existingResult.completed && result.completed) {
  // handle both completed
} else if (result.completed && !existingResult.completed) {
  // handle new completed
}
// ← Missing: else if old completed but new isn't!
```

---

## Summary: The Authentication Flow

```
User visits app
    ↓
Generate UUID in browser → Store in localStorage
    ↓
Send UUID to server via X-User-Id header
    ↓
Server creates User record (isAnonymous: true)
    ↓
User plays, data saved to database
    ↓
User clicks "Sign In"
    ↓
Store anonymousUserId in session → Redirect to OAuth
    ↓
OAuth returns → Find/Create authenticated user
    ↓
Merge anonymous data into authenticated account
  • Transfer daily results (resolve conflicts)
  • Update stats (only count transferred)
  • Transfer events
  • Mark anonymous user as merged
    ↓
Update session with authenticated user ID
    ↓
User now authenticated with all progress preserved!
```

---

## Key Takeaways

1. **Anonymous users are real database records** - treat them like first-class citizens
2. **Merge conflicts require smart resolution** - keep the better progress, adjust stats accurately
3. **Use transactions** - all-or-nothing approach prevents partial merges
4. **Test edge cases** - especially win→incomplete and multiple conflicts
5. **Priority matters** - authenticated > session > headers > cookies

---

## Next Steps to Practice

1. **Build a simpler version first**: Start with just anonymous tracking, no auth
2. **Add basic auth**: Implement sign-in without merging
3. **Add merge logic**: Start with no-conflict case, then add conflict resolution
4. **Test thoroughly**: Use Prisma Studio to inspect database after merges
5. **Monitor in production**: Log all merges to catch edge cases

Good luck building your authentication system! 🚀
