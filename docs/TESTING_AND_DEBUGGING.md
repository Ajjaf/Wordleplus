# Testing and Debugging Guide

This guide teaches you **practical techniques** for testing and debugging your database integration.

---

## Table of Contents
1. [Testing Tools](#testing-tools)
2. [Prisma Studio (Visual Database Browser)](#prisma-studio-visual-database-browser)
3. [Testing with cURL](#testing-with-curl)
4. [Debugging Database Queries](#debugging-database-queries)
5. [Common Errors and Fixes](#common-errors-and-fixes)
6. [SQL Debugging Queries](#sql-debugging-queries)
7. [Logging Best Practices](#logging-best-practices)

---

## Testing Tools

### Tools You Have

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Prisma Studio** | Visual database browser | Explore/edit data visually |
| **cURL** | Test API endpoints | Quick manual testing |
| **Browser DevTools** | Inspect network requests | Debug frontend ↔ backend |
| **Console Logs** | Debug code flow | Understand execution path |
| **Prisma SQL Logs** | See actual SQL queries | Optimize performance |

---

## Prisma Studio (Visual Database Browser)

### Launch Prisma Studio

```bash
npm run db:studio
```

**What happens:**
- Opens browser at `http://localhost:5555`
- Shows all your tables visually
- Can browse, edit, filter, delete data
- Real-time updates

### Features

#### 1. Browse Data

Click any table to see records:
- User → See all players
- DailyPuzzle → See all daily words
- DailyResult → See all game results

#### 2. Filter Records

```
In DailyResult table:
Click filter icon → won: equals: true
Shows only winning games
```

#### 3. Edit Records

Click any cell → Edit value → Save

**Example:** Change a user's display name

#### 4. Delete Records

Select record → Delete button → Confirm

**⚠️ Warning:** This permanently deletes from database!

#### 5. Add Records Manually

Click "Add record" → Fill fields → Save

**Use case:** Create test data quickly

---

### Practical Examples

#### Check Today's Puzzle

1. Open Prisma Studio: `npm run db:studio`
2. Click `DailyPuzzle` table
3. Filter by `date: equals: 2025-10-19`
4. See the secret word (don't cheat!)

#### View User's Progress

1. Click `DailyResult` table
2. Filter by `userId: equals: clx123...`
3. See all their guesses and patterns

#### Debug Streak Calculation

1. Click `User` table
2. See `streak` and `longestStreak` fields
3. Compare with DailyResult records to verify accuracy

---

## Testing with cURL

### Basic cURL Commands

#### GET /api/daily

```bash
# First request (creates user, gets puzzle)
curl -c /tmp/cookies.txt http://localhost:8080/api/daily

# Output:
# {
#   "title": "Daily Challenge",
#   "date": "2025-10-19",
#   "guesses": [],
#   "patterns": [],
#   "gameOver": false,
#   "won": false
# }
```

**What `-c` does:**
- Saves cookies to `/tmp/cookies.txt`
- Use `-c` on first request to save user cookie

---

#### POST /api/daily/guess

```bash
# Submit first guess (use saved cookie)
curl -b /tmp/cookies.txt \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"guess":"HOUSE"}' \
  http://localhost:8080/api/daily/guess

# Output:
# {
#   "pattern": ["green", "green", "gray", "gray", "gray"],
#   "correct": false,
#   "gameOver": false,
#   "won": false,
#   "message": ""
# }
```

**What `-b` does:**
- Sends cookies from `/tmp/cookies.txt`
- Server identifies you as the same user

---

#### GET /api/daily/stats

```bash
# Get statistics
curl -b /tmp/cookies.txt http://localhost:8080/api/daily/stats

# Output:
# {
#   "totalPlayed": 1,
#   "totalWins": 0,
#   "winRate": 0,
#   "currentStreak": 0,
#   "maxStreak": 0,
#   "recentResults": [
#     { "date": "2025-10-19", "won": false, "attempts": 1 }
#   ]
# }
```

---

### Testing a Full Game

**Script:** `test-daily.sh`

```bash
#!/bin/bash

# Create cookie file
COOKIE_FILE="/tmp/daily-test-cookies.txt"

echo "1. Load puzzle..."
curl -s -c $COOKIE_FILE http://localhost:8080/api/daily | jq .

echo "\n2. Guess 1: HOUSE"
curl -s -b $COOKIE_FILE -X POST \
  -H "Content-Type: application/json" \
  -d '{"guess":"HOUSE"}' \
  http://localhost:8080/api/daily/guess | jq .

echo "\n3. Guess 2: MOUSE"
curl -s -b $COOKIE_FILE -X POST \
  -H "Content-Type: application/json" \
  -d '{"guess":"MOUSE"}' \
  http://localhost:8080/api/daily/guess | jq .

echo "\n4. Check stats..."
curl -s -b $COOKIE_FILE http://localhost:8080/api/daily/stats | jq .

echo "\n5. Reload puzzle (should show progress)"
curl -s -b $COOKIE_FILE http://localhost:8080/api/daily | jq .
```

**Run:**
```bash
chmod +x test-daily.sh
./test-daily.sh
```

---

## Debugging Database Queries

### Enable Prisma Query Logging

**File:** `server/daily-db.js`

```javascript
// Add log option to see SQL queries
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

**Output when running:**
```
prisma:query SELECT "User"."id", "User"."email" FROM "User" WHERE "User"."id" = $1
prisma:query INSERT INTO "DailyResult" (...) VALUES (...)
```

**Use this to:**
- See exactly what SQL is being run
- Identify slow queries
- Debug why queries aren't returning expected data

---

### Measure Query Performance

```javascript
// Wrap queries with timing
export async function getUserDailyStats(userId) {
  console.time('getUserDailyStats');
  
  const results = await prisma.dailyResult.findMany({
    where: { userId },
    include: { puzzle: true }
  });
  
  console.timeEnd('getUserDailyStats');
  // Output: getUserDailyStats: 45.123ms
  
  return calculateStats(results);
}
```

---

### Debug Specific Queries

```javascript
// Test query in isolation
async function testQuery() {
  const results = await prisma.dailyResult.findMany({
    where: { userId: "clx123..." },
    include: { puzzle: true },
    orderBy: { puzzle: { date: 'desc' } }
  });
  
  console.log('Results:', JSON.stringify(results, null, 2));
  console.log('Count:', results.length);
}

testQuery();
```

---

## Common Errors and Fixes

### Error 1: "Invalid `prisma.user.create()` invocation"

**Error message:**
```
Invalid `prisma.user.create()` invocation:
Unknown argument `isAnonymous`. Available options are marked with ?.
```

**Cause:** Field doesn't exist in schema

**Fix:**
1. Check `prisma/schema.prisma` for available fields
2. Update code to only use existing fields
3. If you need the field, add it to schema and run `npm run db:push`

---

### Error 2: "Argument `X` is missing"

**Error message:**
```
Argument `solved` is missing.
```

**Cause:** Required field not provided in `create()` or `upsert()`

**Fix:**
```javascript
// ❌ WRONG
await prisma.dailyResult.create({
  data: {
    userId,
    puzzleId,
    guesses: []
    // Missing: solved, attempts, won, completed
  }
});

// ✅ CORRECT
await prisma.dailyResult.create({
  data: {
    userId,
    puzzleId,
    guesses: [],
    solved: false,      // Add all required fields
    attempts: 0,
    won: false,
    completed: false
  }
});
```

---

### Error 3: "Unique constraint failed"

**Error message:**
```
Unique constraint failed on the fields: (`userId`,`puzzleId`)
```

**Cause:** Trying to create a record that already exists

**Fix:** Use `upsert()` instead of `create()`

```javascript
// ❌ WRONG: Fails if record exists
await prisma.dailyResult.create({ ... });

// ✅ CORRECT: Updates if exists, creates if doesn't
await prisma.dailyResult.upsert({
  where: { userId_puzzleId: { userId, puzzleId } },
  update: { ... },
  create: { ... }
});
```

---

### Error 4: "Cannot read property 'X' of null"

**Error message:**
```
TypeError: Cannot read property 'guesses' of null
```

**Cause:** Query returned null, tried to access property

**Fix:**
```javascript
// ❌ WRONG: Crashes if user not found
const user = await prisma.user.findUnique({ where: { id: "..." } });
console.log(user.email);

// ✅ CORRECT: Check for null
const user = await prisma.user.findUnique({ where: { id: "..." } });
if (user) {
  console.log(user.email);
} else {
  console.log("User not found");
}

// ✅ ALSO CORRECT: Optional chaining
console.log(user?.email);
```

---

### Error 5: "Connection timeout"

**Error message:**
```
Error: Can't reach database server at `ep-...neon.tech`
```

**Cause:** Database connection string wrong or database unavailable

**Fix:**
1. Check `DATABASE_URL` is set: `echo $DATABASE_URL`
2. Verify format: `postgresql://user:pass@host.neon.tech/db?sslmode=require`
3. Test connection: `npx prisma db pull`

---

## SQL Debugging Queries

Use these to verify your data manually:

### Count Records

```sql
-- How many users?
SELECT COUNT(*) FROM "User";

-- How many puzzles?
SELECT COUNT(*) FROM "DailyPuzzle";

-- How many completed games?
SELECT COUNT(*) FROM "DailyResult" WHERE completed = true;
```

**Run in Replit shell:**
```bash
npm run db:studio
# Or directly:
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "User";'
```

---

### Find Duplicate Data

```sql
-- Find users with duplicate emails
SELECT email, COUNT(*) 
FROM "User" 
WHERE email IS NOT NULL 
GROUP BY email 
HAVING COUNT(*) > 1;

-- Find puzzles on same date
SELECT date, COUNT(*) 
FROM "DailyPuzzle" 
GROUP BY date 
HAVING COUNT(*) > 1;
```

---

### Inspect Specific User

```sql
-- Get user details
SELECT * FROM "User" WHERE id = 'clx123...';

-- Get their results
SELECT dr.*, dp.date, dp.word 
FROM "DailyResult" dr
JOIN "DailyPuzzle" dp ON dr."puzzleId" = dp.id
WHERE dr."userId" = 'clx123...'
ORDER BY dr."createdAt" DESC;
```

---

### Debug Streak Calculation

```sql
-- Get user's completed games in chronological order
SELECT 
  dp.date,
  dr.won,
  dr.attempts,
  dr."createdAt"
FROM "DailyResult" dr
JOIN "DailyPuzzle" dp ON dr."puzzleId" = dp.id
WHERE dr."userId" = 'clx123...' 
  AND dr.completed = true
ORDER BY dp.date ASC;
```

**Manually verify:**
- Win on 2025-10-17? ✅
- Win on 2025-10-18? ✅
- Win on 2025-10-19? ✅
- **Streak should be 3!**

---

### Find Performance Bottlenecks

```sql
-- Which users have most results?
SELECT 
  u.id,
  u.username,
  COUNT(dr.id) as total_games
FROM "User" u
LEFT JOIN "DailyResult" dr ON u.id = dr."userId"
GROUP BY u.id
ORDER BY total_games DESC
LIMIT 10;

-- Which puzzles have most attempts?
SELECT 
  dp.date,
  dp.word,
  COUNT(dr.id) as attempts
FROM "DailyPuzzle" dp
LEFT JOIN "DailyResult" dr ON dp.id = dr."puzzleId"
GROUP BY dp.id
ORDER BY attempts DESC
LIMIT 10;
```

---

## Logging Best Practices

### Console Logging Strategy

```javascript
// ✅ GOOD: Structured, informative logs
export async function getUserDailyStats(userId) {
  console.log('[getUserDailyStats] Starting for userId:', userId);
  
  const results = await prisma.dailyResult.findMany({ ... });
  console.log('[getUserDailyStats] Found', results.length, 'results');
  
  const stats = calculateStats(results);
  console.log('[getUserDailyStats] Calculated stats:', stats);
  
  return stats;
}

// ❌ BAD: Vague, unhelpful logs
export async function getUserDailyStats(userId) {
  console.log('getting stats');  // What stats? For whom?
  const results = await prisma.dailyResult.findMany({ ... });
  console.log(results);  // Too much data dumped
  return calculateStats(results);
}
```

---

### Error Logging

```javascript
app.post("/api/daily/guess", async (req, res) => {
  try {
    // ... your code ...
  } catch (error) {
    // ✅ GOOD: Log full error object
    console.error('Error in POST /api/daily/guess:', {
      message: error.message,
      stack: error.stack,
      userId: req.cookies?.dailyUserId,
      guess: req.body?.guess
    });
    
    // ❌ BAD: Log only message
    console.error('Error:', error.message);
    
    res.status(500).json({ error: "Failed to process guess" });
  }
});
```

---

### Production Logging

For production, use a logging library:

```bash
npm install winston
```

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Use in code
logger.info('User loaded daily puzzle', { userId, puzzleId });
logger.error('Database query failed', { error, query });
```

---

## Debugging Workflow

### When Something Breaks

1. **Read the error message**
   - What's the exact error?
   - Which file/line?
   - What was the input?

2. **Check recent changes**
   - What did you change recently?
   - Revert changes and test

3. **Add console.logs**
   - Log inputs: `console.log('Input:', userId, puzzleId)`
   - Log outputs: `console.log('Result:', result)`
   - Log conditions: `console.log('Is valid?', isValid)`

4. **Test in isolation**
   - Extract failing code to separate file
   - Test with known good data

5. **Check database**
   - Open Prisma Studio
   - Verify data is as expected

6. **Read Prisma/Postgres logs**
   - Enable query logging
   - See actual SQL being run

---

## Testing Checklist

Before deploying, test these scenarios:

- [ ] New user loads puzzle (creates user + puzzle)
- [ ] Existing user loads puzzle (finds existing data)
- [ ] Submit valid guess (saves correctly)
- [ ] Submit invalid word (rejects with error)
- [ ] Submit duplicate guess (rejects with error)
- [ ] Submit after game over (rejects with error)
- [ ] Win condition (6th guess correct)
- [ ] Lose condition (6 wrong guesses)
- [ ] Stats calculation (accurate win rate/streaks)
- [ ] Cookie persistence (same user across requests)
- [ ] New day rollover (new puzzle, reset progress)

---

## Useful Commands Reference

```bash
# Database
npm run db:push              # Sync schema to database
npm run db:seed              # Populate word list
npm run db:studio            # Open visual browser

# Testing
curl -c /tmp/cookies.txt http://localhost:8080/api/daily
curl -b /tmp/cookies.txt http://localhost:8080/api/daily/stats

# Logs
tail -f server.log           # Watch server logs
grep "Error" server.log      # Find errors in logs

# Database direct access
psql $DATABASE_URL           # Connect to database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
```

---

## Next Steps

1. ✅ You know how to test and debug!
2. 🔧 Practice: Break something on purpose, then fix it
3. 📖 Explore Prisma Studio with your data
4. 🎮 Write a test script for a full daily challenge flow

---

**Remember**: Debugging is a skill you build over time. Be patient, read error messages carefully, and use the tools available! 🔍
