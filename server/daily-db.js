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
    data: {}
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

  const completedResults = results.filter(r => r.completed);
  
  const sortedAsc = [...completedResults].sort((a, b) => 
    new Date(a.puzzle.date) - new Date(b.puzzle.date)
  );

  let tempStreak = 0;
  let prevDate = null;

  for (const result of sortedAsc) {
    const resultDate = DateTime.fromISO(result.puzzle.date);
    
    if (result.won) {
      if (prevDate === null) {
        tempStreak = 1;
      } else {
        const daysDiff = resultDate.diff(prevDate, 'days').days;
        if (Math.abs(daysDiff) <= 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
    
    prevDate = resultDate;
  }

  const mostRecentCompleted = completedResults[0];
  if (mostRecentCompleted && mostRecentCompleted.won) {
    const today = DateTime.now().startOf('day');
    const mostRecentDate = DateTime.fromISO(mostRecentCompleted.puzzle.date);
    const daysSinceLastWin = today.diff(mostRecentDate, 'days').days;
    
    if (daysSinceLastWin <= 1) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }
  } else {
    currentStreak = 0;
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
