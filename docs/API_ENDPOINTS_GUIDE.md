# API Endpoints Guide: How Backend Connects to Database

This guide shows **exactly** how your Daily Challenge API endpoints work, from HTTP request to database and back.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [GET /api/daily - Load Puzzle](#get-apidaily---load-puzzle)
3. [POST /api/daily/guess - Submit Guess](#post-apidailyguess---submit-guess)
4. [GET /api/daily/stats - User Statistics](#get-apidailystats---user-statistics)
5. [Cookie-Based User Tracking](#cookie-based-user-tracking)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Performance Considerations](#performance-considerations)

---

## Architecture Overview

### Request Flow

```
Player Browser
     ↓ HTTP Request
Express Server (server/index.js)
     ↓ Calls helper functions
Database Helpers (server/daily-db.js)
     ↓ Uses Prisma Client
Prisma Client
     ↓ SQL queries
PostgreSQL Database (Neon)
     ↓ Returns data
Back up the chain...
     ↓ JSON Response
Player Browser
```

### File Structure

```
server/
├── index.js           ← API endpoints (Express routes)
├── daily-db.js        ← Database helper functions (Prisma queries)
└── game.js            ← Game logic (scoreGuess function)
```

**Separation of concerns:**
- `index.js` - HTTP handling, validation, cookies
- `daily-db.js` - Database operations
- `game.js` - Pure game logic (no database/HTTP)

---

## GET /api/daily - Load Puzzle

### Purpose
Load today's daily challenge and the user's current progress.

### Full Implementation

**File**: `server/index.js`

```javascript
import {
  getOrCreateAnonymousUser,
  getTodaysPuzzle,
  getUserDailyResult
} from "./daily-db.js";

const MAX_DAILY_GUESSES = 6;
const DAILY_WORD_LENGTH = 5;

// Helper to get user ID from cookie
function getUserIdFromCookie(req) {
  return req.cookies?.dailyUserId || null;
}

// GET /api/daily - Load today's challenge
app.get("/api/daily", async (req, res) => {
  try {
    // Step 1: Get or create user
    const cookieUserId = getUserIdFromCookie(req);
    const user = await getOrCreateAnonymousUser(cookieUserId);
    
    // Step 2: Get today's puzzle
    const puzzle = await getTodaysPuzzle();
    
    // Step 3: Check if user has progress on this puzzle
    const existingResult = await getUserDailyResult(user.id, puzzle.id);
    
    // Step 4: Extract data (or use defaults)
    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;
    const won = existingResult?.won || false;
    
    // Step 5: Set cookie for user tracking
    res.cookie('dailyUserId', user.id, {
      httpOnly: true,                        // Can't be read by JavaScript
      maxAge: 365 * 24 * 60 * 60 * 1000,    // 1 year
      sameSite: 'lax'                        // CSRF protection
    });
    
    // Step 6: Return response (without revealing the secret word!)
    res.json({
      title: "Daily Challenge",
      subtitle: `Challenge for ${puzzle.date}`,
      date: puzzle.date,
      wordLength: DAILY_WORD_LENGTH,
      maxGuesses: MAX_DAILY_GUESSES,
      guesses,       // ["HOUSE", "MOUSE"]
      patterns,      // [["green", "gray", ...], ...]
      gameOver,      // true/false
      won,           // true/false
    });
  } catch (error) {
    console.error("Error in GET /api/daily:", error);
    res.status(500).json({ error: "Failed to load daily challenge" });
  }
});
```

### Step-by-Step Breakdown

#### Step 1: Get or Create User

```javascript
const cookieUserId = getUserIdFromCookie(req);
const user = await getOrCreateAnonymousUser(cookieUserId);
```

**What happens:**
- Check if request has a `dailyUserId` cookie
- If yes → Find that user in database
- If no → Create new anonymous user
- Return user object: `{ id: "clx123...", createdAt: "...", ... }`

**Database query:**
```javascript
// In daily-db.js
export async function getOrCreateAnonymousUser(cookieUserId) {
  if (cookieUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    if (existing) return existing;
  }

  return await prisma.user.create({
    data: {}  // All fields optional for anonymous users
  });
}
```

---

#### Step 2: Get Today's Puzzle

```javascript
const puzzle = await getTodaysPuzzle();
```

**What happens:**
- Get today's date in ISO format: `"2025-10-19"`
- Look for puzzle with that date
- If found → Return it
- If not found → Create new puzzle with deterministic word

**Database query:**
```javascript
// In daily-db.js
export async function getTodaysPuzzle(date = new Date()) {
  const dateStr = DateTime.fromJSDate(date).toISODate();
  
  let puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: dateStr }
  });

  if (!puzzle) {
    const word = await getDeterministicWordForDate(dateStr);
    puzzle = await prisma.dailyPuzzle.create({
      data: {
        date: dateStr,
        word: word,
        difficulty: "medium"
      }
    });
  }

  return puzzle;
}
```

**Return value:**
```javascript
{
  id: "clx456...",
  date: "2025-10-19",
  word: "HOUSE",  // ⚠️ Don't send this to frontend!
  difficulty: "medium",
  createdAt: "2025-10-19T00:00:01Z"
}
```

---

#### Step 3: Check User's Progress

```javascript
const existingResult = await getUserDailyResult(user.id, puzzle.id);
```

**What happens:**
- Look for DailyResult where userId + puzzleId match
- If found → Return their saved progress
- If not found → Return null (first time playing today)

**Database query:**
```javascript
// In daily-db.js
export async function getUserDailyResult(userId, puzzleId) {
  return await prisma.dailyResult.findUnique({
    where: {
      userId_puzzleId: {  // Composite unique key
        userId,
        puzzleId
      }
    }
  });
}
```

**Return value (if exists):**
```javascript
{
  id: "clx789...",
  userId: "clx123...",
  puzzleId: "clx456...",
  guesses: ["HOUSE", "MOUSE"],
  patterns: [
    ["green", "green", "gray", "gray", "gray"],
    ["green", "green", "green", "gray", "gray"]
  ],
  attempts: 2,
  won: false,
  completed: false,
  createdAt: "2025-10-19T10:00:00Z",
  updatedAt: "2025-10-19T10:05:00Z"
}
```

---

#### Step 4: Extract Data

```javascript
const guesses = existingResult?.guesses || [];
const patterns = existingResult?.patterns || [];
const gameOver = existingResult?.completed || false;
const won = existingResult?.won || false;
```

**Why optional chaining (`?.`):**
- If `existingResult` is null (new game) → Use default values
- If `existingResult` exists → Use saved values

---

#### Step 5: Set User Cookie

```javascript
res.cookie('dailyUserId', user.id, {
  httpOnly: true,                        
  maxAge: 365 * 24 * 60 * 60 * 1000,    
  sameSite: 'lax'                        
});
```

**Cookie options explained:**
- `httpOnly: true` - JavaScript can't access it (security against XSS)
- `maxAge: 1 year` - Cookie lasts 1 year (long-term anonymous tracking)
- `sameSite: 'lax'` - Prevents CSRF attacks

**Browser receives:**
```
Set-Cookie: dailyUserId=clx123abc...; HttpOnly; Max-Age=31536000; SameSite=Lax
```

---

#### Step 6: Return JSON Response

```javascript
res.json({
  title: "Daily Challenge",
  date: puzzle.date,
  guesses,
  patterns,
  gameOver,
  won
});
```

**Frontend receives:**
```json
{
  "title": "Daily Challenge",
  "subtitle": "Challenge for 2025-10-19",
  "date": "2025-10-19",
  "wordLength": 5,
  "maxGuesses": 6,
  "guesses": ["HOUSE", "MOUSE"],
  "patterns": [
    ["green", "green", "gray", "gray", "gray"],
    ["green", "green", "green", "gray", "gray"]
  ],
  "gameOver": false,
  "won": false
}
```

**Notice:** The secret word is NOT included! Security by design.

---

## POST /api/daily/guess - Submit Guess

### Purpose
Validate and save a player's guess, return the pattern, check win/lose conditions.

### Full Implementation

```javascript
app.post("/api/daily/guess", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromCookie(req);
    const { guess } = req.body;
    
    // Validation: Check guess exists and is a string
    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: "Invalid guess" });
    }
    
    const guessUpper = guess.toUpperCase();
    
    // Validation: Check word is valid
    if (!isValidWordLocal(guessUpper)) {
      return res.status(400).json({ error: "Not a valid word" });
    }
    
    // Get user, puzzle, and existing progress
    const user = await getOrCreateAnonymousUser(cookieUserId);
    const puzzle = await getTodaysPuzzle();
    const existingResult = await getUserDailyResult(user.id, puzzle.id);
    
    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;
    
    // Validation: Check if game already over
    if (gameOver) {
      return res.json({
        error: "Challenge already completed",
        gameOver: true,
        won: existingResult.won,
      });
    }
    
    // Validation: Check for duplicate guess
    if (guesses.includes(guessUpper)) {
      return res.status(400).json({ error: "Already guessed that word" });
    }
    
    // Validation: Check guess limit
    if (guesses.length >= MAX_DAILY_GUESSES) {
      return res.status(400).json({ error: "No more guesses left" });
    }
    
    // Score the guess (game logic)
    const pattern = scoreGuess(puzzle.word, guessUpper);
    // Returns: ["green", "green", "gray", "yellow", "gray"]
    
    // Update arrays
    const newGuesses = [...guesses, guessUpper];
    const newPatterns = [...patterns, pattern];
    
    // Check win/lose conditions
    const won = pattern.every(state => state === 'green' || state === 'correct');
    const outOfGuesses = newGuesses.length >= MAX_DAILY_GUESSES;
    const completed = won || outOfGuesses;
    
    // Save to database
    await createOrUpdateDailyResult(user.id, puzzle.id, {
      guesses: newGuesses,
      patterns: newPatterns,
      won,
      completed
    });
    
    // Return response
    res.json({
      pattern,
      correct: won,
      gameOver: completed,
      won,
      message: won 
        ? "🎉 Congratulations! You solved today's puzzle!" 
        : outOfGuesses 
        ? `Game over! The word was ${puzzle.word}` 
        : "",
    });
  } catch (error) {
    console.error("Error in POST /api/daily/guess:", error);
    res.status(500).json({ error: "Failed to process guess" });
  }
});
```

### Key Validations

**1. Request validation:**
```javascript
if (!guess || typeof guess !== 'string') {
  return res.status(400).json({ error: "Invalid guess" });
}
```

**2. Word validation:**
```javascript
if (!isValidWordLocal(guessUpper)) {
  return res.status(400).json({ error: "Not a valid word" });
}
```

**3. Game state validation:**
```javascript
if (gameOver) {
  return res.json({ error: "Challenge already completed" });
}
```

**4. Duplicate validation:**
```javascript
if (guesses.includes(guessUpper)) {
  return res.status(400).json({ error: "Already guessed that word" });
}
```

---

### Game Logic: scoreGuess()

**File**: `server/game.js`

```javascript
export function scoreGuess(secret, guess) {
  const result = Array(secret.length).fill('gray');
  const secretChars = secret.split('');
  const guessChars = guess.split('');
  
  // First pass: Mark greens (exact matches)
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === secretChars[i]) {
      result[i] = 'green';
      secretChars[i] = null;  // Mark as used
      guessChars[i] = null;
    }
  }
  
  // Second pass: Mark yellows (wrong position)
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] !== null) {
      const idx = secretChars.indexOf(guessChars[i]);
      if (idx !== -1) {
        result[i] = 'yellow';
        secretChars[idx] = null;  // Mark as used
      }
    }
  }
  
  return result;
}
```

**Example:**
```javascript
scoreGuess("HOUSE", "HORSE")
// Returns: ["green", "green", "gray", "green", "green"]
//           H matches, O matches, U≠R, S matches, E matches
```

---

### Database Save: upsert Pattern

```javascript
await createOrUpdateDailyResult(user.id, puzzle.id, {
  guesses: newGuesses,
  patterns: newPatterns,
  won,
  completed
});
```

**Why upsert?**
- First guess → Creates new DailyResult
- Subsequent guesses → Updates existing DailyResult
- No need to check if record exists!

**Database query:**
```javascript
// In daily-db.js
export async function createOrUpdateDailyResult(userId, puzzleId, data) {
  return await prisma.dailyResult.upsert({
    where: {
      userId_puzzleId: { userId, puzzleId }
    },
    update: {
      guesses: data.guesses,
      patterns: data.patterns,
      won: data.won,
      solved: data.won,
      completed: data.completed,
      completedAt: data.completed ? new Date() : null,
      attempts: data.guesses.length
    },
    create: {
      userId,
      puzzleId,
      guesses: data.guesses,
      patterns: data.patterns,
      won: data.won,
      solved: data.won,
      completed: data.completed,
      completedAt: data.completed ? new Date() : null,
      attempts: data.guesses.length
    }
  });
}
```

---

## GET /api/daily/stats - User Statistics

### Purpose
Return user's performance stats: win rate, streaks, recent history.

### Implementation

```javascript
app.get("/api/daily/stats", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromCookie(req);
    
    // If no user cookie, return empty stats
    if (!cookieUserId) {
      return res.json({
        totalPlayed: 0,
        totalWins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        recentResults: []
      });
    }
    
    // Get stats from database
    const stats = await getUserDailyStats(cookieUserId);
    res.json(stats);
  } catch (error) {
    console.error("Error in GET /api/daily/stats:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});
```

### Database Query

```javascript
// In daily-db.js
export async function getUserDailyStats(userId, limit = 30) {
  // Get user's results with puzzle info
  const results = await prisma.dailyResult.findMany({
    where: { userId },
    include: { puzzle: true },
    orderBy: { puzzle: { date: 'desc' } },
    take: limit
  });

  const totalPlayed = results.filter(r => r.completed).length;
  const totalWins = results.filter(r => r.won).length;
  const winRate = totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : 0;

  // Calculate streaks (see TESTING_AND_DEBUGGING.md for full logic)
  let currentStreak = 0;
  let maxStreak = 0;
  
  // ... streak calculation logic ...

  return {
    totalPlayed,
    totalWins,
    winRate: Math.round(winRate),
    currentStreak,
    maxStreak,
    recentResults: results.slice(0, 10).map(r => ({
      date: r.puzzle.date,
      won: r.won,
      attempts: r.attempts
    }))
  };
}
```

**Example response:**
```json
{
  "totalPlayed": 15,
  "totalWins": 12,
  "winRate": 80,
  "currentStreak": 5,
  "maxStreak": 7,
  "recentResults": [
    { "date": "2025-10-19", "won": true, "attempts": 3 },
    { "date": "2025-10-18", "won": true, "attempts": 4 },
    { "date": "2025-10-17", "won": false, "attempts": 6 }
  ]
}
```

---

## Cookie-Based User Tracking

### Why Cookies?

**Alternatives:**
- ❌ Sessions - Lost on server restart
- ❌ localStorage - Client-side only, no server access
- ✅ Cookies - Sent with every request, server-readable

### Cookie Flow

```
1. First Visit
   Browser → GET /api/daily (no cookie)
   Server creates user → Sets cookie
   Browser ← Response + Set-Cookie: dailyUserId=clx123...

2. Subsequent Requests
   Browser → GET /api/daily
   Headers: Cookie: dailyUserId=clx123...
   Server reads cookie → Finds user
   Browser ← Response (no Set-Cookie needed)
```

### Security Considerations

```javascript
res.cookie('dailyUserId', user.id, {
  httpOnly: true,     // ✅ Prevents XSS attacks
  sameSite: 'lax',    // ✅ Prevents CSRF attacks
  secure: false       // Set to true in production (HTTPS only)
});
```

---

## Error Handling Patterns

### Try-Catch Blocks

```javascript
app.get("/api/daily", async (req, res) => {
  try {
    // ... database operations ...
  } catch (error) {
    console.error("Error in GET /api/daily:", error);
    res.status(500).json({ error: "Failed to load daily challenge" });
  }
});
```

**Why:**
- Prevents server crashes
- Logs errors for debugging
- Returns user-friendly error messages
- Doesn't expose implementation details

---

### Validation Before Database

```javascript
// ✅ GOOD: Validate first, then query database
if (!guess || typeof guess !== 'string') {
  return res.status(400).json({ error: "Invalid guess" });
}

const user = await getOrCreateAnonymousUser(userId);

// ❌ BAD: Query database, then validate
const user = await getOrCreateAnonymousUser(userId);

if (!guess || typeof guess !== 'string') {
  return res.status(400).json({ error: "Invalid guess" });
}
```

**Why:**
- Faster (avoid unnecessary database calls)
- Cheaper (database queries cost money)
- Clearer intent

---

## Performance Considerations

### 1. Database Indexes

Your schema has indexes for fast lookups:

```prisma
model DailyResult {
  @@unique([userId, puzzleId])  // Fast lookup by user + puzzle
  @@index([puzzleId, attempts, won])  // Fast leaderboard queries
}

model DailyPuzzle {
  date String @unique  // Fast lookup by date
}
```

---

### 2. Caching Opportunities

```javascript
// ⚠️ Current: Query database every request
export async function getTodaysPuzzle() {
  return await prisma.dailyPuzzle.findUnique({
    where: { date: dateStr }
  });
}

// ✅ Better: Cache in memory (future optimization)
let cachedPuzzle = null;
let cachedDate = null;

export async function getTodaysPuzzle() {
  const today = DateTime.now().toISODate();
  
  if (cachedDate === today && cachedPuzzle) {
    return cachedPuzzle;
  }
  
  cachedPuzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: today }
  });
  cachedDate = today;
  
  return cachedPuzzle;
}
```

---

### 3. Batch Operations

```javascript
// ❌ BAD: Multiple queries in a loop
for (const userId of userIds) {
  const stats = await getUserDailyStats(userId);
}

// ✅ GOOD: Single query with filter
const allResults = await prisma.dailyResult.findMany({
  where: { userId: { in: userIds } },
  include: { puzzle: true }
});
```

---

## Testing Your Endpoints

### Using cURL

```bash
# Get today's puzzle
curl -c cookies.txt http://localhost:8080/api/daily

# Submit a guess (using saved cookie)
curl -b cookies.txt -X POST http://localhost:8080/api/daily/guess \
  -H "Content-Type: application/json" \
  -d '{"guess":"HOUSE"}'

# Get stats
curl -b cookies.txt http://localhost:8080/api/daily/stats
```

### Using Browser DevTools

```javascript
// In browser console
fetch('/api/daily')
  .then(r => r.json())
  .then(console.log);

fetch('/api/daily/guess', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guess: 'HOUSE' })
}).then(r => r.json()).then(console.log);
```

---

## Next Steps

1. ✅ You understand how API endpoints work!
2. 📖 Read `TESTING_AND_DEBUGGING.md` for debugging tips
3. 🔧 Try modifying an endpoint to add a new feature
4. 🎮 Experiment with Postman or cURL to test endpoints

---

**Remember**: The endpoints are the bridge between your frontend and database. Clean, well-validated endpoints = reliable app! 🚀
