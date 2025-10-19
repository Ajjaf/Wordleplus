# Database Schema Explained: Your WordlePlus Tables

This guide explains **every table** in your WordlePlus database, why it exists, and how it's used.

---

## Table of Contents
1. [Schema Overview](#schema-overview)
2. [User Table](#user-table)
3. [WordLexicon Table](#wordlexicon-table)
4. [DailyPuzzle Table](#dailypuzzle-table)
5. [DailyResult Table](#dailyresult-table)
6. [Event Table](#event-table)
7. [Relationships Diagram](#relationships-diagram)
8. [Design Decisions](#design-decisions)

---

## Schema Overview

Your database has **5 tables**:

| Table | Purpose | Records |
|-------|---------|---------|
| `User` | Players (anonymous + registered) | Grows with users |
| `WordLexicon` | Valid 5-letter words | 12,972 words (fixed) |
| `DailyPuzzle` | One puzzle per day | 365/year |
| `DailyResult` | User progress on puzzles | Grows daily |
| `Event` | Game events for leaderboards | Grows with activity |

---

## User Table

### Purpose
Stores player accounts. Supports **anonymous users** (tracked by cookie) with optional upgrade to **registered accounts**.

### Schema
```prisma
model User {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Identity (all optional for anonymous users)
  email         String?  @unique
  username      String?  @unique
  displayName   String?
  avatarUrl     String?
  
  // External auth (Supabase, Clerk, etc.)
  authProvider  String?
  authExternalId String?  @unique
  
  // Anonymous support
  deviceId      String? @unique

  // Game stats (cached from results)
  totalWins     Int      @default(0)
  totalGames    Int      @default(0)
  streak        Int      @default(0)
  longestStreak Int      @default(0)

  // Relationships
  results       DailyResult[]
  events        Event[]
}
```

### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | String | Unique identifier | `"clx123abc..."` |
| `createdAt` | DateTime | When user was created | `2025-10-19T10:00:00Z` |
| `email` | String? | Email (optional) | `"player@example.com"` |
| `username` | String? | Username (optional) | `"wordmaster99"` |
| `displayName` | String? | Display name | `"Word Master"` |
| `deviceId` | String? | Device fingerprint | `"device_abc123"` |
| `totalWins` | Int | Cached win count | `42` |
| `streak` | Int | Current win streak | `7` |

### Usage Examples

**Create anonymous user:**
```javascript
const user = await prisma.user.create({
  data: {}  // All fields optional!
});
// Returns: { id: "clx...", createdAt: "...", email: null, ... }
```

**Upgrade to registered account:**
```javascript
const upgraded = await prisma.user.update({
  where: { id: "clx123..." },
  data: {
    email: "player@example.com",
    username: "wordmaster",
    displayName: "Word Master"
  }
});
```

### Why This Design?

✅ **Anonymous-first**: Players can start playing without signing up  
✅ **Flexible upgrade**: Easy to convert anonymous → registered  
✅ **External auth ready**: Supports OAuth providers  
✅ **Privacy-friendly**: No required personal info

---

## WordLexicon Table

### Purpose
Stores all valid 5-letter words for word validation and puzzle generation.

### Schema
```prisma
model WordLexicon {
  id      Int     @id @default(autoincrement())
  word    String  @unique
  length  Int
  active  Boolean @default(true)

  @@index([length, active])
}
```

### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | Int | Auto-incrementing ID | `1`, `2`, `3`... |
| `word` | String | The word (uppercase) | `"HOUSE"` |
| `length` | Int | Word length | `5` |
| `active` | Boolean | Is word in use? | `true` |

### Usage Examples

**Check if word is valid:**
```javascript
const word = await prisma.wordLexicon.findUnique({
  where: { word: "HOUSE" }
});

if (word) {
  console.log("Valid word!");
}
```

**Get random word for puzzle:**
```javascript
const allWords = await prisma.wordLexicon.findMany({
  where: { active: true, length: 5 }
});

const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
```

**Count total words:**
```javascript
const total = await prisma.wordLexicon.count({
  where: { active: true }
});
// Returns: 12972
```

### Data Source
Seeded from `server/words.txt` - a curated list of common 5-letter English words.

---

## DailyPuzzle Table

### Purpose
One puzzle per day. Ensures **all players get the same word** each day.

### Schema
```prisma
model DailyPuzzle {
  id          String   @id @default(cuid())
  date        String   @unique // yyyy-mm-dd format
  word        String
  difficulty  String   @default("medium")
  createdAt   DateTime @default(now())
  locked      Boolean  @default(false)
  checksum    String?

  results     DailyResult[]
}
```

### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | String | Unique identifier | `"clx456..."` |
| `date` | String | ISO date (unique!) | `"2025-10-19"` |
| `word` | String | The secret word | `"HOUSE"` |
| `difficulty` | String | Puzzle difficulty | `"medium"` |
| `locked` | Boolean | Prevent changes? | `false` |
| `createdAt` | DateTime | When created | `2025-10-19T00:00:01Z` |

### Usage Examples

**Get today's puzzle (or create it):**
```javascript
export async function getTodaysPuzzle() {
  const dateStr = DateTime.now().toISODate(); // "2025-10-19"
  
  let puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: dateStr }
  });

  if (!puzzle) {
    const word = await getDeterministicWordForDate(dateStr);
    puzzle = await prisma.dailyPuzzle.create({
      data: {
        date: dateStr,
        word: word
      }
    });
  }

  return puzzle;
}
```

### Why Deterministic Word Generation?

```javascript
// This ensures the SAME word for everyone on the same date
function getDeterministicWordForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
  }
  const index = Math.abs(hash) % totalWords;
  return words[index];
}
```

✅ Same input (date) → Same output (word)  
✅ No random selection → Fair for all players  
✅ Can't predict tomorrow's word from today's

---

## DailyResult Table

### Purpose
Tracks each user's progress and final result for each daily puzzle.

### Schema
```prisma
model DailyResult {
  id          String   @id @default(cuid())
  userId      String
  puzzleId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Gameplay data
  guesses      String[]  // ["HOUSE", "MOUSE", ...]
  patterns     Json[]    // [["green", "gray", ...], ...]
  attempts     Int       // 1-6
  won          Boolean   // Did they solve it?
  completed    Boolean   @default(false)
  completedAt  DateTime?
  solved       Boolean   // Same as won
  
  // Optional metadata
  durationMs   Int?
  hardMode     Boolean  @default(false)
  submittedIp  String?
  userAgent    String?

  // Relationships
  user        User        @relation(fields: [userId], references: [id])
  puzzle      DailyPuzzle @relation(fields: [puzzleId], references: [id])

  @@unique([userId, puzzleId])  // One result per user per puzzle
  @@index([puzzleId, attempts, won])
}
```

### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `guesses` | String[] | All guesses made | `["HOUSE", "MOUSE"]` |
| `patterns` | Json[] | Color patterns | `[["green", "gray"...]]` |
| `attempts` | Int | Total guesses | `3` |
| `won` | Boolean | Solved correctly? | `true` |
| `completed` | Boolean | Game finished? | `true` |
| `completedAt` | DateTime? | When finished | `2025-10-19T10:15:00Z` |

### Usage Examples

**Save a guess:**
```javascript
await prisma.dailyResult.upsert({
  where: {
    userId_puzzleId: {
      userId: "clx123...",
      puzzleId: "clx456..."
    }
  },
  update: {
    guesses: ["HOUSE", "MOUSE"],
    patterns: [
      ["green", "green", "gray", "gray", "gray"],
      ["green", "green", "green", "gray", "gray"]
    ],
    attempts: 2,
    won: false,
    completed: false
  },
  create: {
    userId: "clx123...",
    puzzleId: "clx456...",
    guesses: ["HOUSE", "MOUSE"],
    patterns: [
      ["green", "green", "gray", "gray", "gray"],
      ["green", "green", "green", "gray", "gray"]
    ],
    attempts: 2,
    won: false,
    solved: false,
    completed: false
  }
});
```

**Get user's history:**
```javascript
const history = await prisma.dailyResult.findMany({
  where: { userId: "clx123..." },
  include: { puzzle: true },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

### Why Store Every Guess?

- **Replay**: Show user their guess history
- **Analytics**: Analyze common wrong guesses
- **Streaks**: Calculate win streaks accurately
- **Anti-cheat**: Detect suspicious patterns

---

## Event Table

### Purpose
Log all game events for analytics and leaderboards (future use).

### Schema
```prisma
model Event {
  id        String   @id @default(cuid())
  userId    String?
  type      String   // "battle.join", "duel.win", "daily.submit"
  ts        DateTime @default(now())
  roomId    String?
  meta      Json?

  user      User?    @relation(fields: [userId], references: [id])

  @@index([type, ts])
  @@index([roomId, ts])
}
```

### Usage Examples

**Log a daily challenge completion:**
```javascript
await prisma.event.create({
  data: {
    userId: "clx123...",
    type: "daily.complete",
    meta: {
      won: true,
      attempts: 3,
      word: "HOUSE"
    }
  }
});
```

**Get recent battle events:**
```javascript
const battleEvents = await prisma.event.findMany({
  where: {
    type: { startsWith: "battle." },
    ts: { gte: new Date('2025-10-19') }
  },
  orderBy: { ts: 'desc' }
});
```

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                            User                                  │
│  id, email, username, totalWins, streak...                      │
└───────┬─────────────────────────────────────────────┬───────────┘
        │                                             │
        │ 1:Many                                      │ 1:Many
        ▼                                             ▼
┌──────────────────┐                          ┌─────────────────┐
│  DailyResult     │                          │     Event       │
│  userId          │                          │  userId (opt)   │
│  puzzleId        │                          │  type, meta     │
│  guesses         │                          └─────────────────┘
│  patterns        │
│  won, completed  │
└────────┬─────────┘
         │ Many:1
         ▼
┌────────────────────┐
│   DailyPuzzle      │
│   date (unique)    │
│   word             │
└────────────────────┘

┌────────────────────┐
│   WordLexicon      │  (Independent table)
│   word (unique)    │
│   active           │
└────────────────────┘
```

---

## Design Decisions

### Why `cuid()` for IDs?

```prisma
id String @id @default(cuid())
```

**cuid** = Collision-resistant Unique ID
- ✅ URL-safe (no special characters)
- ✅ Sortable by creation time
- ✅ Hard to guess (security)
- ✅ Works in distributed systems

**Alternatives:**
- `uuid()` - More standard, but not sortable
- `autoincrement()` - Simple but predictable (security risk)

---

### Why Store Both `won` and `solved`?

```prisma
won          Boolean
solved       Boolean
```

Currently they're the same, but future-proofs for:
- Hard mode variants
- Time-based challenges
- Custom game modes

---

### Why Composite Unique Key?

```prisma
@@unique([userId, puzzleId])
```

Ensures **one result per user per puzzle**. Prevents:
- ❌ User submitting same puzzle twice
- ❌ Data duplication
- ✅ Fast lookups by both fields

---

### Why Store `patterns` as JSON?

```prisma
patterns Json[]  // [["green", "gray", ...], ...]
```

**Alternatives considered:**
- ❌ String: `"green,gray,..."` - Hard to parse, no validation
- ❌ Separate table - Overkill for simple array
- ✅ JSON array - Flexible, type-safe with Prisma

---

## Schema Evolution (Future Ideas)

### Add User Profiles
```prisma
model User {
  bio          String?
  favoriteWord String?
  badges       Json?
}
```

### Add Puzzle Difficulty
```prisma
model DailyPuzzle {
  difficulty   String  @default("medium")  // "easy", "medium", "hard"
  category     String? // "animals", "food", etc.
}
```

### Add Multiplayer Results
```prisma
model BattleResult {
  id       String @id @default(cuid())
  roomId   String
  winnerId String
  players  Json   // Array of player stats
}
```

---

## Next Steps

1. ✅ You understand the database structure!
2. 📖 Read `API_ENDPOINTS_GUIDE.md` to see how it's used
3. 🔧 Read `TESTING_AND_DEBUGGING.md` for practical tips
4. 🎮 Try exploring your data in Prisma Studio: `npm run db:studio`

---

**Remember**: The schema is just the blueprint. The real magic happens in how you query and manipulate this data! 🎯
