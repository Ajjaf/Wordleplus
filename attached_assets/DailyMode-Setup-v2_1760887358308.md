
# Project W — Daily Mode + Accounts + Leaderboards (Playbook)

This playbook extends the Daily Mode setup with **accounts**, **leaderboards**, and **events/analytics**. It’s designed for:
- **PostgreSQL on Neon**
- **Prisma** as ORM
- Node/Express (same server that powers your Socket.IO)
- Mobile (Expo) + Web clients

> TL;DR checklists are at the top of each section so you can move fast.

---

## 0) High-level checklist

**You do:**
1. Create a Neon Postgres database & copy connection URL.
2. Add env vars locally and on the server.
3. Install Prisma & run migrations.
4. Seed the 5-letter word list.
5. Boot the server and hit test endpoints.
6. Wire the mobile/web clients to new endpoints (daily, submit, leaderboard, auth).

**I do (included below):**
- Prisma schema (users, daily puzzles, results, leaderboards computed, events)
- Seed scripts & sample routes
- Deterministic word-of-the-day service (timezone-aware)
- Minimal “account” strategy + auth stubs
- Leaderboard endpoints
- Event logging pattern

---

## 1) Environment

Create `.env` in your server root:

```bash
# Postgres (Neon)
DATABASE_URL="postgresql://<user>:<pass>@<host>/<db>?sslmode=require"

# Daily mode
DAILY_TZ="America/New_York"         # canonical timezone for daily roll
DAILY_ROLL_HOUR=0                   # midnight in DAILY_TZ

# Optional auth secrets (fill later when choosing real auth)
JWT_SECRET="dev_jwt_for_testing_only"
```

Commit a **.env.example** without secrets.

---

## 2) Prisma Schema (accounts, daily, results, events)

`prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Basic identity
  email         String?  @unique
  username      String?  @unique
  displayName   String?
  avatarUrl     String?
  // Optional external identities (fill later)
  authProvider  String?   // 'supabase' | 'clerk' | 'authjs' | 'dev'
  authExternalId String?  @unique

  // Anonymous support (mobile first-run)
  deviceId      String? @unique

  // Game stats (denorm hints; keep truth in result tables)
  totalWins     Int      @default(0)
  totalGames    Int      @default(0)
  streak        Int      @default(0)
  longestStreak Int      @default(0)

  results       DailyResult[]
  events        Event[]
}

model WordLexicon {
  id      Int     @id @default(autoincrement())
  word    String  @unique
  length  Int
  active  Boolean @default(true)

  @@index([length, active])
}

/// One "daily" row per date. `seed` is the method to derive the word deterministically.
model DailyPuzzle {
  id          String   @id // yyyy-mm-dd (in DAILY_TZ)
  date        DateTime // stored in UTC
  word        String
  createdAt   DateTime @default(now())
  locked      Boolean  @default(false) // optional: prevent edits after roll
  checksum    String?  // optional: for integrity

  results     DailyResult[]

  @@unique([word, date])
}

/// One row per user per daily.
model DailyResult {
  id          String   @id @default(cuid())
  userId      String
  puzzleId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  /// gameplay data
  attempts     Int      // 1..6 ; NULL => DNF
  solved       Boolean  // true if solved
  durationMs   Int?     // optional
  hardMode     Boolean  @default(false)

  /// anti-cheat hints (optional)
  submittedIp  String? 
  userAgent    String?
  clientBuild  String?  // app version

  user        User        @relation(fields: [userId], references: [id])
  puzzle      DailyPuzzle @relation(fields: [puzzleId], references: [id])

  @@unique([userId, puzzleId])
  @@index([puzzleId, attempts, solved])
}

/// Simple append-only analytics stream.
model Event {
  id        String   @id @default(cuid())
  userId    String?
  type      String   // "battle.join", "duel.win", "daily.submit", etc.
  ts        DateTime @default(now())
  roomId    String?
  meta      Json?

  user      User?    @relation(fields: [userId], references: [id])

  @@index([type, ts])
  @@index([roomId, ts])
}
```

Install & migrate:
```bash
npm i -D prisma
npm i @prisma/client
npx prisma init
npx prisma migrate dev -n init_daily_mode
```

---

## 3) Seed the 5-letter lexicon

`prisma/seed.ts`
```ts
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();
async function main() {
  const raw = fs.readFileSync("./words.txt", "utf8");
  const words = Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(Boolean)
        .filter(w => /^[A-Z]{5}$/.test(w))
    )
  );

  console.log("Seeding", words.length, "words");
  // Upsert in chunks
  const chunk = 1000;
  for (let i = 0; i < words.length; i += chunk) {
    const part = words.slice(i, i + chunk);
    await prisma.wordLexicon.createMany({
      data: part.map(w => ({ word: w, length: 5, active: true })),
      skipDuplicates: true
    });
    console.log("...seeded", i + part.length);
  }
}
main().finally(() => prisma.$disconnect());
```

Add to package.json:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```
Then:
```bash
npm i -D tsx
npm run prisma:seed
```

Place your `words.txt` beside `prisma/seed.ts`.

---

## 4) Deterministic word-of-the-day

`src/services/dailyWord.ts`
```ts
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DAILY_TZ = process.env.DAILY_TZ || "America/New_York";
const ROLL_HOUR = Number(process.env.DAILY_ROLL_HOUR || 0);

/**
 * Get (or create) today’s DailyPuzzle in UTC, using DAILY_TZ roll.
 * Strategy: pick nth active 5-letter word based on days since epoch (seeded).
 */
export async function getTodayPuzzleUTC() {
  // compute id like 'YYYY-MM-DD' in DAILY_TZ
  const nowTZ = DateTime.now().setZone(DAILY_TZ);
  const roll = nowTZ.set({ hour: ROLL_HOUR, minute: 0, second: 0, millisecond: 0 });
  const effective = nowTZ < roll ? roll.minus({ day: 1 }) : roll;
  const id = effective.toFormat("yyyy-LL-dd");

  let puzzle = await prisma.dailyPuzzle.findUnique({ where: { id } });
  if (puzzle) return puzzle;

  // deterministically choose a word
  const days = Math.floor(effective.toSeconds() / 86400);
  const count = await prisma.wordLexicon.count({ where: { length: 5, active: true } });
  if (count === 0) throw new Error("No words in lexicon");

  const idx = ((days % count) + count) % count;
  const wordRow = await prisma.wordLexicon.findFirst({
    where: { length: 5, active: true },
    skip: idx,
    take: 1,
    orderBy: { id: "asc" },
  });
  if (!wordRow) throw new Error("Failed to pick daily word");

  puzzle = await prisma.dailyPuzzle.create({
    data: { id, date: effective.toUTC().toJSDate(), word: wordRow.word, locked: true },
  });
  return puzzle;
}
```

Install Luxon:
```bash
npm i luxon
```

---

## 5) Minimal Accounts Strategy (dev-friendly)

You have two practical paths:

### A) **Anonymous + upgrade later** (recommended to start)
- On first run (mobile/web), generate a **deviceId** and create a User row.
- Store `deviceId` in SecureStore/AsyncStorage (mobile) and localStorage (web).
- Later, let users “upgrade” by linking email/passwordless or OAuth (fill `email`, `username`, and possibly `authProvider` + `authExternalId`).

Endpoints:
```ts
// POST /api/auth/anon { deviceId? } -> { user }
```
- If deviceId exists, fetch that user; else create one and return it.

### B) **Hosted Auth** (later)
- Clerk, Supabase Auth, or Auth.js. Store `authProvider` + `authExternalId` on User.
- Keep the **User table** identical, just fill the auth fields.

> The schema above supports both strategies. You can start anonymous and migrate users to hosted auth later without breaking data.

---

## 6) REST Endpoints

### 6.1 Auth (anonymous)

`src/routes/auth.ts`
```ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const r = Router();

r.post("/anon", async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || "");
    if (deviceId) {
      const existing = await prisma.user.findUnique({ where: { deviceId } });
      if (existing) return res.json({ user: existing });
    }
    const newDeviceId = deviceId || randomUUID();
    const user = await prisma.user.create({
      data: { deviceId: newDeviceId, displayName: "Player" },
    });
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "auth_failed" });
  }
});

export default r;
```

### 6.2 Daily puzzle fetch

`src/routes/daily.ts`
```ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getTodayPuzzleUTC } from "../services/dailyWord";

const prisma = new PrismaClient();
const r = Router();

// GET /api/daily -> { id, date, maskedWord }
r.get("/", async (_req, res) => {
  const p = await getTodayPuzzleUTC();
  res.json({ id: p.id, date: p.date, maskedWord: "*****" });
});

// POST /api/daily/submit { userId, puzzleId, attempts, solved, durationMs, hardMode }
r.post("/submit", async (req, res) => {
  try {
    const { userId, puzzleId, attempts, solved, durationMs, hardMode, meta } = req.body || {};
    if (!userId || !puzzleId) return res.status(400).json({ error: "bad_request" });

    const result = await prisma.dailyResult.upsert({
      where: { userId_puzzleId: { userId, puzzleId } },
      create: { userId, puzzleId, attempts, solved, durationMs, hardMode, clientBuild: meta?.clientBuild },
      update: { attempts, solved, durationMs, hardMode, clientBuild: meta?.clientBuild },
    });

    // cheap denorm stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalGames: { increment: 1 },
        totalWins: solved ? { increment: 1 } : undefined,
        streak: solved ? { increment: 1 } : 0,
        longestStreak: solved ? undefined : undefined, // compute later with a job if needed
      },
    });

    // event
    await prisma.event.create({
      data: { userId, type: "daily.submit", meta: { attempts, solved, durationMs, puzzleId } },
    });

    res.json({ ok: true, resultId: result.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "submit_failed" });
  }
});

export default r;
```

### 6.3 Leaderboards

You don’t need a separate table—compute leaderboards from **DailyResult** with good indexes.

`src/routes/leaderboard.ts`
```ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const r = Router();

// GET /api/leaderboard/daily/:puzzleId?limit=50
// Sort: solved first, attempts asc, durationMs asc, createdAt asc
r.get("/daily/:puzzleId", async (req, res) => {
  const puzzleId = String(req.params.puzzleId);
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const results = await prisma.dailyResult.findMany({
    where: { puzzleId },
    include: { user: true },
    orderBy: [
      { solved: "desc" },
      { attempts: "asc" },
      { durationMs: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  res.json({
    puzzleId,
    entries: results.map(r => ({
      userId: r.userId,
      name: r.user.displayName || r.user.username || "Player",
      attempts: r.attempts,
      solved: r.solved,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    })),
  });
});

// GET /api/leaderboard/global?limit=50
// Simple global—order by totalWins desc, streak desc
r.get("/global", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const users = await prisma.user.findMany({
    orderBy: [{ totalWins: "desc" }, { streak: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
  res.json({
    entries: users.map(u => ({
      userId: u.id,
      name: u.displayName || u.username || "Player",
      totalWins: u.totalWins,
      streak: u.streak,
    })),
  });
});

export default r;
```

---

## 7) Server wiring

`src/server.ts`
```ts
import express from "express";
import cors from "cors";
import dailyRoutes from "./routes/daily";
import leaderboardRoutes from "./routes/leaderboard";
import authRoutes from "./routes/auth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/daily", dailyRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/auth", authRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("HTTP listening on", port));
```

If you already have a combined **HTTP + Socket.IO** server, mount the routes on that same `express` app before creating the HTTP server.

---

## 8) Client wiring (quick)

### Mobile (Expo)
- On launch: hit `POST /api/auth/anon` to get/create a `user.id`. Store safely.
- Daily screen: `GET /api/daily` → get `{ id }`
- After finish: `POST /api/daily/submit` with `{ userId, puzzleId, attempts, solved, durationMs }`
- Leaderboard tab: `GET /api/leaderboard/daily/:puzzleId` and `GET /api/leaderboard/global`

### Web
Same calls. If you already have user names, set `displayName` with a small profile form later.

---

## 9) Events & analytics

Use the `Event` table to instrument gameplay:

- `type` examples: `"duel.start"`, `"duel.win"`, `"battle.join"`, `"daily.submit"`, `"socket.resume"`
- `meta` JSON can include roomId, attempts, durations, client build, etc.
- Add indexes by `type`, `ts` for dashboards.

Later: stream to an external analytics store via job/ETL if desired.

---

## 10) Security, anti-abuse, performance

- **Rate-limit** public endpoints (`/api/daily/submit`) per IP and user (e.g., express-rate-limit).
- Log client build, user-agent, and IP (store hashed IP if needed).
- Validate `attempts` ∈ [1..6], `durationMs` ∈ [0..n].
- Add a Redis cache for **leaderboards** (top N for current daily) with TTL (e.g., 60s).
- Use **read replicas** (Neon features) as traffic grows.
- Create **materialized views** for historical toplists later.

---

## 11) Mini-runbook

1. **Neon:** create DB, copy `DATABASE_URL`  
2. **Prisma:** `npx prisma migrate dev -n init_daily_mode`  
3. **Seed:** `npm run prisma:seed`  
4. **Dev:** `npm run dev` (nodemon/tsx)  
5. **Smoke Tests:**  
   - `GET /health`  
   - `POST /api/auth/anon` → receive user  
   - `GET /api/daily` → `{ id, maskedWord }`  
   - `POST /api/daily/submit` → `{ ok: true }`  
   - `GET /api/leaderboard/daily/<todayId>`  
   - `GET /api/leaderboard/global`  
6. **Clients:** wire the 4 endpoints
7. **Later:** choose hosted auth, add Redis cache, add streak logic job

---

## 12) FAQ

**Q: Do I need a dedicated Leaderboard table?**  
A: No. For daily mode, query `DailyResult` with indexes. For global, either denormalize counters on `User` (as shown) or recompute with jobs. Cache hot leaderboards in Redis.

**Q: Can I start anonymous and later add real auth?**  
A: Yes. Keep `deviceId` users now; add email/username/OAuth later. Provide an “upgrade account” flow to link identities.

**Q: Timezone & fairness?**  
A: Use a single canonical TZ (`DAILY_TZ`) for the daily roll and keep puzzles locked once created. Clients can show their local time until next roll for UX.

---

## 13) What’s next

- Add `/api/profile` to set `displayName`, avatar
- Add `/api/user/:id/history` for daily history
- Add **Weekly Challenge** table reusing the same pattern
- Add Redis and rate-limits
- Hook events to dashboards (tinybar, metabase, or a spreadsheet export job)
