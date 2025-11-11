import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function normalizeDate(input) {
  return DateTime.fromISO(input).startOf("day");
}

async function pruneFutureDailyPuzzles(referenceDate = new Date()) {
  const todayIso = DateTime.fromJSDate(referenceDate).toISODate();

  try {
    const { count } = await prisma.dailyPuzzle.deleteMany({
      where: {
        date: {
          gt: todayIso,
        },
      },
    });

    if (count > 0) {
      console.info(
        `[DailyPuzzle] Pruned ${count} future daily puzzles scheduled after ${todayIso}`
      );
    }
  } catch (error) {
    console.error("[DailyPuzzle] Failed to prune future daily puzzles", error);
  }
}

function deriveDailyStats(results) {
  const completedResults = results.filter((r) => r.completed);
  const totalPlayed = completedResults.length;
  const totalWins = completedResults.filter((r) => r.won).length;
  const winRate =
    totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;

  // Calculate streaks using chronological order
  const sortedAsc = [...completedResults].sort(
    (a, b) =>
      normalizeDate(a.puzzle.date).toMillis() -
      normalizeDate(b.puzzle.date).toMillis()
  );

  let rollingStreak = 0;
  let maxStreak = 0;
  let previousDate = null;

  for (const result of sortedAsc) {
    const resultDate = normalizeDate(result.puzzle.date);

    if (result.won) {
      if (previousDate && resultDate.diff(previousDate, "days").days === 1) {
        rollingStreak += 1;
      } else {
        rollingStreak = 1;
      }
      if (rollingStreak > maxStreak) {
        maxStreak = rollingStreak;
      }
    } else {
      rollingStreak = 0;
    }

    previousDate = resultDate;
  }

  // Current streak: walk backward from most recent completed puzzle
  const sortedDesc = [...completedResults].sort(
    (a, b) =>
      normalizeDate(b.puzzle.date).toMillis() -
      normalizeDate(a.puzzle.date).toMillis()
  );

  let currentStreak = 0;
  let expectedDate = null;

  for (const result of sortedDesc) {
    const resultDate = normalizeDate(result.puzzle.date);

    if (!result.won) {
      break; // streak broken by a loss
    }

    if (expectedDate === null) {
      // First win (most recent)
      currentStreak = 1;
      expectedDate = resultDate.minus({ days: 1 });
      continue;
    }

    const diff = expectedDate.diff(resultDate, "days").days;
    if (Math.abs(diff) < 0.5) {
      currentStreak += 1;
      expectedDate = resultDate.minus({ days: 1 });
    } else {
      break;
    }
  }

  return {
    totalPlayed,
    totalWins,
    winRate,
    currentStreak,
    maxStreak,
  };
}

async function updateUserAggregateStats(userId) {
  const allResults = await prisma.dailyResult.findMany({
    where: { userId },
    include: {
      puzzle: true,
    },
    orderBy: {
      puzzle: {
        date: "asc",
      },
    },
  });

  const stats = deriveDailyStats(allResults);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalGames: stats.totalPlayed,
        totalWins: stats.totalWins,
        streak: stats.currentStreak,
        longestStreak: stats.maxStreak,
      },
    });
  } catch (error) {
    console.error(
      "[Daily Stats] Failed to update user aggregates",
      userId,
      error
    );
  }

  return stats;
}

export async function getOrCreateAnonymousUser(cookieUserId) {
  if (cookieUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    if (existing) return existing;
    
    // Create user with the provided cookieUserId
    const user = await prisma.user.create({
      data: { id: cookieUserId }
    });
    return user;
  }

  // No userId provided, create a new one (should rarely happen now)
  const user = await prisma.user.create({
    data: {}
  });

  return user;
}

export async function getTodaysPuzzle(date = new Date()) {
  await pruneFutureDailyPuzzles();

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

async function getDeterministicWordForDate(dateStr) {
  const allWords = await prisma.wordLexicon.findMany({
    where: { active: true, length: 5 }
  });

  if (allWords.length === 0) {
    throw new Error("No words available in WordLexicon");
  }

  // Use a cryptographic hash so consecutive dates do not yield adjacent words.
  const hashHex = createHash("sha256").update(dateStr).digest("hex");
  const hashInt = parseInt(hashHex.slice(0, 12), 16);
  const index = hashInt % allWords.length;
  return allWords[index].word;
}

export async function getUserDailyResult(userId, puzzleId) {
  return await prisma.dailyResult.findUnique({
    where: {
      userId_puzzleId: {
        userId,
        puzzleId
      }
    }
  });
}

export async function createOrUpdateDailyResult(userId, puzzleId, data) {
  const { guesses, patterns, won, completed } = data;

  return await prisma.dailyResult.upsert({
    where: {
      userId_puzzleId: {
        userId,
        puzzleId
      }
    },
    update: {
      guesses,
      patterns,
      won,
      solved: won,
      completed,
      completedAt: completed ? new Date() : null,
      attempts: guesses.length
    },
    create: {
      userId,
      puzzleId,
      guesses,
      patterns,
      won,
      solved: won,
      completed,
      completedAt: completed ? new Date() : null,
      attempts: guesses.length
    }
  }).then(async (result) => {
    if (completed) {
      await updateUserAggregateStats(userId);
    }
    return result;
  });
}

export async function getUserDailyStats(userId, limit = 30) {
  const results = await prisma.dailyResult.findMany({
    where: { userId },
    include: {
      puzzle: true,
    },
    orderBy: {
      puzzle: {
        date: "desc",
      },
    },
  });

  const stats = deriveDailyStats(results);

  return {
    ...stats,
    recentResults: results.slice(0, limit).map((r) => ({
      date: r.puzzle.date,
      won: r.won,
      attempts: r.attempts,
    })),
  };
}

export { prisma };
