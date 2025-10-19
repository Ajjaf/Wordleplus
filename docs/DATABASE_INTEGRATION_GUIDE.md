# Database Integration Guide: From Zero to Production

This guide walks you through **exactly** what we did to connect your WordlePlus Daily Challenge to a PostgreSQL database. By the end, you'll understand how web applications store and retrieve data.

---

## Table of Contents
1. [What is a Database? (The Basics)](#what-is-a-database)
2. [Why We Needed a Database](#why-we-needed-a-database)
3. [PostgreSQL + Neon in Replit](#postgresql--neon-in-replit)
4. [What is an ORM? (Prisma)](#what-is-an-orm-prisma)
5. [Step-by-Step: What We Built](#step-by-step-what-we-built)
6. [How Data Flows Through Your App](#how-data-flows-through-your-app)
7. [Next Steps for Learning](#next-steps-for-learning)

---

## What is a Database?

Think of a database like a **super-organized filing cabinet** for your app:

- **Without a database**: Your app "forgets" everything when you close it (like writing on a whiteboard)
- **With a database**: Your app remembers everything permanently (like writing in a notebook)

### Real Example from Your App:

**Before database** (session cookies only):
- You play Daily Challenge, make 3 guesses
- Close your browser → All progress lost 😢
- Play tomorrow → No history, no streak tracking

**After database** (what we just built):
- You play Daily Challenge, make 3 guesses
- Close your browser → Progress saved in database ✅
- Come back later → Your guesses are still there!
- Play tomorrow → Streak tracking works, stats are accurate

---

## Why We Needed a Database

Your WordlePlus game has these requirements:

1. **Persistence**: Players should keep their progress even after closing the browser
2. **Statistics**: Track win streaks, completion rates, history
3. **Consistency**: Everyone gets the same daily puzzle
4. **Scalability**: Support multiple players without data conflicts

**Session cookies alone can't do this!** They only store small amounts of data in the browser.

---

## PostgreSQL + Neon in Replit

### What is PostgreSQL?

PostgreSQL (or "Postgres") is a **database management system**. It's like Microsoft Excel, but:
- Built for storing millions of rows
- Handles multiple users at once
- Optimized for speed and reliability
- Uses SQL (Structured Query Language) to interact with data

### What is Neon?

Neon is a **serverless PostgreSQL provider**. Replit uses Neon to give you:
- A real PostgreSQL database instantly
- Automatic backups and scaling
- Only pay when you're using it (it goes to sleep when idle)

### How Replit Handles Database Setup

When you create a database in Replit:

1. **Replit creates a Neon database** for you automatically
2. **Sets environment variables** so your app can connect:
   - `DATABASE_URL` - The connection string (like a URL to your database)
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Individual connection details

3. **You access it via code** without worrying about server setup

```javascript
// Replit automatically provides this environment variable:
const DATABASE_URL = process.env.DATABASE_URL;
// Example value: "postgresql://user:password@host.neon.tech/database"
```

---

## What is an ORM? (Prisma)

### The Problem: Raw SQL is Hard

Without an ORM, you'd write SQL queries manually:

```javascript
// Yikes! Hard to read, easy to make mistakes, vulnerable to SQL injection
const result = await db.query(
  'INSERT INTO users (email, username) VALUES ($1, $2) RETURNING *',
  ['user@example.com', 'player123']
);
```

### The Solution: Prisma (Our ORM)

An **ORM** (Object-Relational Mapping) is a translator between:
- **Your JavaScript code** ↔️ **Database SQL**

With Prisma, that same operation becomes:

```javascript
// Much cleaner! Type-safe, readable, secure
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    username: 'player123'
  }
});
```

### Why We Chose Prisma

1. **Type Safety**: Autocomplete and error checking in your editor
2. **Easy to Learn**: Reads like English
3. **Prisma Studio**: Visual database browser (like phpMyAdmin)
4. **Auto-Generated Client**: Write schema → Get JavaScript functions automatically

---

## Step-by-Step: What We Built

### Phase 1: Install Dependencies

```bash
# Installed Prisma ORM and its client
npm install prisma @prisma/client

# Installed Luxon for date/time handling
npm install luxon @types/luxon

# Installed tsx to run TypeScript files
npm install tsx
```

**Why these packages?**
- `prisma` - The command-line tool for managing your database
- `@prisma/client` - The JavaScript library for querying data
- `luxon` - Better date handling than JavaScript's built-in Date
- `tsx` - Runs TypeScript files (our seed script)

---

### Phase 2: Create Prisma Schema

We created `prisma/schema.prisma` - this is the **blueprint** for your database:

```prisma
// Tell Prisma to generate a JavaScript client
generator client {
  provider = "prisma-client-js"
}

// Connect to PostgreSQL database using Replit's environment variable
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Define a "User" table
model User {
  id            String   @id @default(cuid())  // Unique ID for each user
  createdAt     DateTime @default(now())       // When they were created
  email         String?  @unique               // Optional email (can be null)
  username      String?  @unique               // Optional username
  
  // Relationships: A user can have many daily results
  results       DailyResult[]
}
```

**Key Concepts:**
- `model` = A table in your database
- `@id` = This field is the primary key (unique identifier)
- `@default(cuid())` = Automatically generate a unique ID
- `@unique` = No two users can have the same email
- `?` = This field is optional (can be null)
- `DailyResult[]` = One-to-many relationship (one user has many results)

---

### Phase 3: Push Schema to Database

```bash
# This creates the actual tables in your database
npm run db:push
```

**What happens here:**
1. Prisma reads your `schema.prisma` file
2. Connects to your database using `DATABASE_URL`
3. Creates SQL tables that match your models
4. Generates `@prisma/client` with TypeScript types

**Behind the scenes**, Prisma ran SQL like this:

```sql
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email" TEXT UNIQUE,
  "username" TEXT UNIQUE
);

CREATE TABLE "DailyResult" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "puzzleId" TEXT NOT NULL,
  "guesses" TEXT[],
  "patterns" JSONB[],
  -- ... more fields
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);
```

But you didn't have to write any SQL! That's the power of Prisma.

---

### Phase 4: Seed the Database

We created `prisma/seed.ts` to populate the `WordLexicon` table with 12,972 valid 5-letter words:

```typescript
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();

async function main() {
  // Read words from file
  const raw = fs.readFileSync("server/words.txt", "utf8");
  const words = raw.split('\n')
    .map(w => w.trim().toUpperCase())
    .filter(w => /^[A-Z]{5}$/.test(w)); // Only 5-letter words
  
  // Insert in chunks of 1000 to avoid database limits
  for (let i = 0; i < words.length; i += 1000) {
    const chunk = words.slice(i, i + 1000);
    await prisma.wordLexicon.createMany({
      data: chunk.map(w => ({ word: w, length: 5, active: true })),
      skipDuplicates: true
    });
    console.log(`Seeded ${i + chunk.length}/${words.length}`);
  }
}

main();
```

**Run the seed:**
```bash
npm run db:seed
# Output: Seeded 12972/12972 words ✅
```

---

### Phase 5: Create Database Helper Functions

We created `server/daily-db.js` to handle all database operations:

```javascript
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

// Get or create an anonymous user
export async function getOrCreateAnonymousUser(cookieUserId) {
  // If they already have a user ID in their cookie, find that user
  if (cookieUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    if (existing) return existing;
  }

  // Otherwise, create a new anonymous user
  const user = await prisma.user.create({
    data: {} // Empty data creates user with default values
  });

  return user;
}

// Get today's puzzle (or create it if it doesn't exist)
export async function getTodaysPuzzle(date = new Date()) {
  const dateStr = DateTime.fromJSDate(date).toISODate(); // "2025-10-19"
  
  // Try to find existing puzzle for this date
  let puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: dateStr }
  });

  // If no puzzle exists, create one with a deterministic word
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

// Save or update a user's daily result
export async function createOrUpdateDailyResult(userId, puzzleId, data) {
  return await prisma.dailyResult.upsert({
    where: {
      userId_puzzleId: { userId, puzzleId } // Composite key
    },
    update: {
      guesses: data.guesses,
      patterns: data.patterns,
      won: data.won,
      completed: data.completed
    },
    create: {
      userId,
      puzzleId,
      guesses: data.guesses,
      patterns: data.patterns,
      won: data.won,
      completed: data.completed
    }
  });
}
```

**Key Patterns:**
- `findUnique()` - Find one record by unique field
- `create()` - Insert a new record
- `upsert()` - Update if exists, create if doesn't (super useful!)

---

### Phase 6: Update API Endpoints

We updated `server/index.js` to use the database instead of in-memory storage:

#### Before (In-Memory):
```javascript
// ❌ Data lost when server restarts
const dailySessions = new Map();

app.get("/api/daily", (req, res) => {
  const sessionData = dailySessions.get(sessionId);
  // ...
});
```

#### After (Database):
```javascript
// ✅ Data persists forever
import { getOrCreateAnonymousUser, getTodaysPuzzle } from "./daily-db.js";

app.get("/api/daily", async (req, res) => {
  const user = await getOrCreateAnonymousUser(cookieUserId);
  const puzzle = await getTodaysPuzzle();
  const result = await getUserDailyResult(user.id, puzzle.id);
  
  res.json({
    guesses: result?.guesses || [],
    patterns: result?.patterns || [],
    gameOver: result?.completed || false
  });
});
```

---

## How Data Flows Through Your App

Here's what happens when a player submits a guess:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Player clicks Submit                                      │
│    Frontend: POST /api/daily/guess { guess: "HOUSE" }       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Express Server (server/index.js)                         │
│    - Validates the guess word                                │
│    - Gets user ID from cookie                                │
│    - Calls database helper functions                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Database Helper (server/daily-db.js)                     │
│    - getOrCreateAnonymousUser(userId)                        │
│    - getTodaysPuzzle()                                       │
│    - createOrUpdateDailyResult(...)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Prisma Client                                             │
│    - Translates JavaScript to SQL                            │
│    - Sends query to PostgreSQL                               │
│    - Returns results as JavaScript objects                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PostgreSQL Database (Neon)                                │
│    - Executes SQL query                                      │
│    - Stores data permanently on disk                         │
│    - Returns result rows                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Response Back to Player                                   │
│    { pattern: ["green", "green", ...], correct: false }      │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps for Learning

### Beginner Level:
1. Read `PRISMA_BASICS.md` - Learn Prisma query syntax
2. Read `DATABASE_SCHEMA_EXPLAINED.md` - Understand your tables
3. Open Prisma Studio: `npm run db:studio` and explore your data

### Intermediate Level:
4. Read `API_ENDPOINTS_GUIDE.md` - Deep dive into the backend code
5. Read `TESTING_AND_DEBUGGING.md` - Learn to troubleshoot
6. Try modifying the schema to add a new field

### Advanced Level:
7. Build a new feature (e.g., user profiles)
8. Add relationships between tables
9. Optimize queries for performance

---

## Common Questions

**Q: What happens if I change my schema?**  
A: Run `npm run db:push` to sync changes to the database.

**Q: How do I view my data?**  
A: Run `npm run db:studio` to open Prisma Studio (visual database browser).

**Q: Can I use raw SQL?**  
A: Yes! `await prisma.$queryRaw`SELECT * FROM "User"`` but Prisma is usually better.

**Q: What if I want to reset everything?**  
A: Delete all data, then re-run the seed: `npm run db:seed`

**Q: Is this production-ready?**  
A: Yes! Neon scales automatically. Add indexes for better performance.

---

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [Replit Database Docs](https://docs.replit.com/category/databases)
- [Neon Documentation](https://neon.tech/docs)

---

**Next Guide**: Read `PRISMA_BASICS.md` to learn Prisma query syntax with examples from your app!
