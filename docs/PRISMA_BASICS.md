# Prisma Basics: Learn by Example

This guide teaches you Prisma using **real examples from your WordlePlus app**. Every example is actual code from your project!

---

## Table of Contents
1. [What Prisma Does](#what-prisma-does)
2. [The Prisma Client](#the-prisma-client)
3. [CRUD Operations](#crud-operations)
4. [Querying Data](#querying-data)
5. [Relationships](#relationships)
6. [Advanced Patterns](#advanced-patterns)
7. [Common Mistakes](#common-mistakes)

---

## What Prisma Does

Prisma is a **type-safe ORM** that turns this:

```sql
-- Raw SQL (hard to read, easy to mess up)
SELECT u.*, dr.* 
FROM "User" u 
LEFT JOIN "DailyResult" dr ON u.id = dr."userId" 
WHERE dr."completed" = true 
ORDER BY dr."createdAt" DESC 
LIMIT 10;
```

Into this:

```javascript
// Prisma (clean, readable, autocomplete works!)
const results = await prisma.user.findMany({
  where: { 
    results: { 
      some: { completed: true } 
    } 
  },
  include: { results: true },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

---

## The Prisma Client

### Setting Up Prisma Client

In any file where you need database access:

```javascript
import { PrismaClient } from "@prisma/client";

// Create one instance of Prisma Client
const prisma = new PrismaClient();

// Now you can use it!
const users = await prisma.user.findMany();
```

**From your project** (`server/daily-db.js`):
```javascript
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();  // ← Create the client

export async function getOrCreateAnonymousUser(cookieUserId) {
  // Now we can use prisma.user, prisma.dailyPuzzle, etc.
  const existing = await prisma.user.findUnique({
    where: { id: cookieUserId }
  });
  // ...
}
```

---

## CRUD Operations

CRUD = **C**reate, **R**ead, **U**pdate, **D**elete

### Create (Insert New Record)

```javascript
// Create a new user
const user = await prisma.user.create({
  data: {
    email: "player@example.com",
    username: "player123",
    displayName: "Pro Player"
  }
});

console.log(user);
// Output: { id: "abc123", email: "player@example.com", ... }
```

**Real example from your app** (`server/daily-db.js`):
```javascript
export async function getOrCreateAnonymousUser(cookieUserId) {
  if (cookieUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    if (existing) return existing;
  }

  // CREATE: Make a new anonymous user
  const user = await prisma.user.create({
    data: {}  // Empty = use default values from schema
  });

  return user;  // Returns { id: "clx...", createdAt: "2025-10-19...", ... }
}
```

---

### Read (Find Records)

#### Find One by ID

```javascript
// Find user by their ID
const user = await prisma.user.findUnique({
  where: { id: "abc123" }
});

// user = { id: "abc123", email: "...", ... } or null if not found
```

#### Find Many

```javascript
// Get all users
const allUsers = await prisma.user.findMany();

// Get users with filters
const activeUsers = await prisma.user.findMany({
  where: {
    results: {
      some: { completed: true }  // Users who completed at least one puzzle
    }
  }
});
```

**Real example from your app**:
```javascript
// Get today's puzzle (or null if doesn't exist)
export async function getTodaysPuzzle(date = new Date()) {
  const dateStr = DateTime.fromJSDate(date).toISODate(); // "2025-10-19"
  
  // READ: Find puzzle by date
  let puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: dateStr }
  });

  if (!puzzle) {
    // If not found, create it...
  }

  return puzzle;
}
```

---

### Update (Modify Existing Record)

```javascript
// Update a user's display name
const updated = await prisma.user.update({
  where: { id: "abc123" },
  data: { displayName: "New Name" }
});
```

**Real example** - updating a daily result:
```javascript
await prisma.dailyResult.update({
  where: {
    userId_puzzleId: { 
      userId: "abc123", 
      puzzleId: "puzzle456" 
    }
  },
  data: {
    guesses: ["HOUSE", "MOUSE", "LOUSE"],
    attempts: 3,
    completed: true,
    won: true
  }
});
```

---

### Delete (Remove Record)

```javascript
// Delete a user
await prisma.user.delete({
  where: { id: "abc123" }
});

// Delete many records
await prisma.dailyResult.deleteMany({
  where: { completed: false }  // Delete incomplete games
});
```

---

### Upsert (Update or Create)

This is **super useful** when you don't know if a record exists!

```javascript
// If record exists → update it
// If record doesn't exist → create it
const result = await prisma.user.upsert({
  where: { email: "player@example.com" },
  update: { displayName: "Updated Name" },
  create: { email: "player@example.com", displayName: "New Name" }
});
```

**Real example from your app** (`server/daily-db.js`):
```javascript
export async function createOrUpdateDailyResult(userId, puzzleId, data) {
  return await prisma.dailyResult.upsert({
    where: {
      userId_puzzleId: { userId, puzzleId }  // Composite key
    },
    update: {
      guesses: data.guesses,      // Update these fields if exists
      patterns: data.patterns,
      won: data.won,
      completed: data.completed
    },
    create: {
      userId,                      // Create with these fields if doesn't exist
      puzzleId,
      guesses: data.guesses,
      patterns: data.patterns,
      won: data.won,
      completed: data.completed
    }
  });
}
```

**Why upsert is perfect here:**
- First guess? Creates a new DailyResult
- Subsequent guesses? Updates the existing DailyResult
- No need to check if record exists first!

---

## Querying Data

### Filtering with `where`

```javascript
// Find users with a specific email
const users = await prisma.user.findMany({
  where: { email: "player@example.com" }
});

// Find puzzles from October 2025
const puzzles = await prisma.dailyPuzzle.findMany({
  where: {
    date: {
      gte: "2025-10-01",  // gte = greater than or equal
      lt: "2025-11-01"    // lt = less than
    }
  }
});

// Complex filter: Users who won today
const winners = await prisma.user.findMany({
  where: {
    results: {
      some: {  // "some" = at least one result matches
        won: true,
        puzzle: {
          date: "2025-10-19"
        }
      }
    }
  }
});
```

**Filter operators:**
- `equals` - Exact match
- `not` - Not equal
- `in` - Match any in array: `{ id: { in: ["id1", "id2"] } }`
- `contains` - String contains: `{ username: { contains: "pro" } }`
- `gte` / `gt` - Greater than (or equal)
- `lte` / `lt` - Less than (or equal)

---

### Ordering with `orderBy`

```javascript
// Get newest users first
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' }
});

// Order by multiple fields
const results = await prisma.dailyResult.findMany({
  orderBy: [
    { won: 'desc' },      // Winners first
    { attempts: 'asc' }   // Then by fewest attempts
  ]
});
```

**Real example from your app**:
```javascript
export async function getUserDailyStats(userId, limit = 30) {
  const results = await prisma.dailyResult.findMany({
    where: { userId },
    include: { puzzle: true },
    orderBy: {
      puzzle: {
        date: 'desc'  // Newest puzzles first
      }
    },
    take: limit
  });
  // ...
}
```

---

### Limiting Results with `take` and `skip`

```javascript
// Get first 10 users (pagination)
const page1 = await prisma.user.findMany({
  take: 10,
  skip: 0
});

// Get next 10 users
const page2 = await prisma.user.findMany({
  take: 10,
  skip: 10
});
```

---

## Relationships

### One-to-Many: User → DailyResults

In your schema:
```prisma
model User {
  id      String        @id @default(cuid())
  results DailyResult[]  // One user has many results
}

model DailyResult {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

#### Include Related Data

```javascript
// Get user WITH their results
const user = await prisma.user.findUnique({
  where: { id: "abc123" },
  include: {
    results: true  // Include all related DailyResults
  }
});

console.log(user);
// {
//   id: "abc123",
//   email: "...",
//   results: [
//     { id: "result1", guesses: ["HOUSE"], ... },
//     { id: "result2", guesses: ["MOUSE"], ... }
//   ]
// }
```

#### Filter on Related Data

```javascript
// Get user AND filter their results
const user = await prisma.user.findUnique({
  where: { id: "abc123" },
  include: {
    results: {
      where: { won: true },         // Only winning games
      orderBy: { createdAt: 'desc' },
      take: 5                        // Last 5 wins
    }
  }
});
```

**Real example from your app**:
```javascript
// Get user's results with puzzle info included
const results = await prisma.dailyResult.findMany({
  where: { userId },
  include: {
    puzzle: true  // Include the DailyPuzzle for each result
  },
  orderBy: {
    puzzle: { date: 'desc' }
  }
});

// Each result now has: result.puzzle.word, result.puzzle.date, etc.
```

---

### Select Specific Fields

Sometimes you don't need all fields:

```javascript
// Only get email and username
const users = await prisma.user.findMany({
  select: {
    email: true,
    username: true
    // id, createdAt, etc. will NOT be included
  }
});
```

---

## Advanced Patterns

### Counting Records

```javascript
// Count total users
const totalUsers = await prisma.user.count();

// Count users who completed a puzzle
const activeUsers = await prisma.user.count({
  where: {
    results: {
      some: { completed: true }
    }
  }
});
```

---

### Aggregations

```javascript
// Get average attempts
const stats = await prisma.dailyResult.aggregate({
  _avg: { attempts: true },
  _min: { attempts: true },
  _max: { attempts: true }
});

console.log(stats);
// { _avg: { attempts: 3.5 }, _min: { attempts: 1 }, _max: { attempts: 6 } }
```

---

### Transactions

When you need multiple operations to succeed or fail together:

```javascript
// Both operations succeed, or both fail
const [user, result] = await prisma.$transaction([
  prisma.user.create({ data: { email: "new@example.com" } }),
  prisma.dailyResult.create({ data: { userId: "...", puzzleId: "..." } })
]);
```

---

### Raw SQL (When Prisma isn't enough)

```javascript
// Use raw SQL
const results = await prisma.$queryRaw`
  SELECT * FROM "User" 
  WHERE "createdAt" > NOW() - INTERVAL '7 days'
`;
```

---

## Common Mistakes

### ❌ Mistake 1: Not using `await`

```javascript
// WRONG - Returns a Promise, not data
const user = prisma.user.findUnique({ where: { id: "abc" } });

// CORRECT
const user = await prisma.user.findUnique({ where: { id: "abc" } });
```

---

### ❌ Mistake 2: Forgetting to handle null

```javascript
// WRONG - Crashes if user not found
const user = await prisma.user.findUnique({ where: { id: "nonexistent" } });
console.log(user.email);  // ❌ TypeError: Cannot read property 'email' of null

// CORRECT
const user = await prisma.user.findUnique({ where: { id: "nonexistent" } });
if (user) {
  console.log(user.email);  // ✅ Safe
} else {
  console.log("User not found");
}

// Or use optional chaining
console.log(user?.email);  // ✅ Prints undefined if user is null
```

---

### ❌ Mistake 3: Creating multiple Prisma Client instances

```javascript
// WRONG - Creates a new connection pool every time
function getUser() {
  const prisma = new PrismaClient();  // ❌ Don't do this
  return prisma.user.findMany();
}

// CORRECT - Reuse one instance
const prisma = new PrismaClient();  // ✅ Create once at top of file

function getUser() {
  return prisma.user.findMany();
}
```

---

### ❌ Mistake 4: Updating without checking if exists

```javascript
// WRONG - Crashes if user doesn't exist
await prisma.user.update({
  where: { id: "nonexistent" },
  data: { email: "new@example.com" }
});  // ❌ Error: Record not found

// BETTER - Use upsert
await prisma.user.upsert({
  where: { id: "nonexistent" },
  update: { email: "new@example.com" },
  create: { id: "nonexistent", email: "new@example.com" }
});  // ✅ Works whether record exists or not
```

---

## Practice Exercises

Try these with your WordlePlus database!

### Exercise 1: Find All Winners Today
```javascript
// Write a query to find all users who won today's puzzle
const today = DateTime.now().toISODate();
const winners = await prisma.user.findMany({
  where: {
    results: {
      some: {
        won: true,
        puzzle: { date: today }
      }
    }
  },
  include: {
    results: {
      where: {
        puzzle: { date: today }
      }
    }
  }
});
```

### Exercise 2: Get Top Players by Win Rate
```javascript
// Get users with their win rate (requires aggregation)
const users = await prisma.user.findMany({
  include: {
    _count: {
      select: {
        results: {
          where: { completed: true }
        }
      }
    }
  }
});

// Calculate win rate in JavaScript
const rankedUsers = users.map(u => ({
  username: u.username,
  totalGames: u._count.results,
  wins: u.results.filter(r => r.won).length,
  winRate: u.results.filter(r => r.won).length / u._count.results
})).sort((a, b) => b.winRate - a.winRate);
```

---

## Next Steps

1. ✅ You've learned Prisma basics!
2. 📖 Read `DATABASE_SCHEMA_EXPLAINED.md` to understand your specific tables
3. 🔧 Read `API_ENDPOINTS_GUIDE.md` to see how it all connects
4. 🎮 Try modifying queries in `server/daily-db.js`

---

## Helpful Resources

- [Prisma CRUD Reference](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Prisma Filtering Reference](https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting)
- [Prisma Relations Guide](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)

**Pro Tip**: Use Prisma Studio (`npm run db:studio`) to visually browse your data while learning!
