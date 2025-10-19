import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

export async function getOrCreateAnonymousUser(cookieUserId) {
  if (cookieUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: cookieUserId }
    });
    if (existing) return existing;
  }

  const user = await prisma.user.create({
    data: {
      isAnonymous: true,
    }
  });

  return user;
}

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

async function getDeterministicWordForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }

  const allWords = await prisma.wordLexicon.findMany({
    where: { active: true, length: 5 }
  });

  if (allWords.length === 0) {
    throw new Error("No words available in WordLexicon");
  }

  const index = Math.abs(hash) % allWords.length;
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
      completed,
      completedAt: completed ? new Date() : null,
      attempts: guesses.length
    }
  });
}

export async function getUserDailyStats(userId, limit = 30) {
  const results = await prisma.dailyResult.findMany({
    where: { userId },
    include: {
      puzzle: true
    },
    orderBy: {
      puzzle: {
        date: 'desc'
      }
    },
    take: limit
  });

  const totalPlayed = results.filter(r => r.completed).length;
  const totalWins = results.filter(r => r.won).length;
  const winRate = totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : 0;

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  const sortedResults = results
    .filter(r => r.completed)
    .sort((a, b) => new Date(b.puzzle.date) - new Date(a.puzzle.date));

  for (let i = 0; i < sortedResults.length; i++) {
    const result = sortedResults[i];
    const resultDate = DateTime.fromISO(result.puzzle.date);
    
    if (result.won) {
      tempStreak++;
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
      
      if (i === 0) {
        currentStreak = tempStreak;
      } else {
        const prevDate = DateTime.fromISO(sortedResults[i - 1].puzzle.date);
        const daysDiff = resultDate.diff(prevDate, 'days').days;
        if (Math.abs(daysDiff) > 1) {
          if (i > 0) currentStreak = 0;
          tempStreak = 1;
        } else if (i === 0) {
          currentStreak = tempStreak;
        }
      }
    } else {
      tempStreak = 0;
      if (i === 0) currentStreak = 0;
    }
  }

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

export { prisma };
