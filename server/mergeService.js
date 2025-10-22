import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function mergeAnonymousUser(anonymousUserId, authenticatedUserData) {
  return await prisma.$transaction(async (tx) => {
    // Get the anonymous user
    const anonUser = await tx.user.findUnique({
      where: { id: anonymousUserId },
      include: {
        results: true,
        events: true,
      }
    });

    if (!anonUser) {
      throw new Error("Anonymous user not found");
    }

    if (!anonUser.isAnonymous) {
      throw new Error("User is not anonymous");
    }

    // Create the new authenticated user with data from anonymous user
    const newUser = await tx.user.create({
      data: {
        ...authenticatedUserData,
        // Preserve stats from anonymous account
        totalWins: anonUser.totalWins,
        totalGames: anonUser.totalGames,
        streak: anonUser.streak,
        longestStreak: anonUser.longestStreak,
      }
    });

    // Transfer daily results to new user
    if (anonUser.results.length > 0) {
      // Update all daily results to point to new user
      // Handle potential conflicts (if authenticated user already has results for same puzzle)
      for (const result of anonUser.results) {
        try {
          await tx.dailyResult.update({
            where: { id: result.id },
            data: { userId: newUser.id }
          });
        } catch (error) {
          // If there's a conflict (authenticated user already has result for this puzzle)
          // Keep the better one (more attempts = progressed further)
          const existingResult = await tx.dailyResult.findUnique({
            where: {
              userId_puzzleId: {
                userId: newUser.id,
                puzzleId: result.puzzleId
              }
            }
          });

          if (existingResult && result.attempts > existingResult.attempts) {
            // Anonymous user progressed further, replace existing result
            await tx.dailyResult.update({
              where: {
                userId_puzzleId: {
                  userId: newUser.id,
                  puzzleId: result.puzzleId
                }
              },
              data: {
                guesses: result.guesses,
                patterns: result.patterns,
                attempts: result.attempts,
                won: result.won,
                solved: result.solved,
                completed: result.completed,
                completedAt: result.completedAt,
              }
            });
          }
          // Delete the anonymous user's result
          await tx.dailyResult.delete({
            where: { id: result.id }
          });
        }
      }
    }

    // Transfer events to new user
    if (anonUser.events.length > 0) {
      await tx.event.updateMany({
        where: { userId: anonymousUserId },
        data: { userId: newUser.id }
      });
    }

    // Mark the anonymous user as merged
    await tx.user.update({
      where: { id: anonymousUserId },
      data: {
        mergedIntoUserId: newUser.id,
        mergedAt: new Date(),
      }
    });

    console.log(`[MERGE] Successfully merged anonymous user ${anonymousUserId} into ${newUser.id}`);
    console.log(`  - Transferred ${anonUser.results.length} daily results`);
    console.log(`  - Transferred ${anonUser.events.length} events`);
    console.log(`  - Stats: ${anonUser.totalWins} wins, ${anonUser.totalGames} games, ${anonUser.streak} streak`);

    return newUser;
  });
}

export async function getFullUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      results: {
        include: {
          puzzle: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 30
      }
    }
  });

  if (!user) {
    return null;
  }

  // Calculate stats
  const completedGames = user.results.filter(r => r.completed);
  const wins = user.results.filter(r => r.won);
  
  // Calculate current streak
  let currentStreak = 0;
  const sortedResults = [...user.results].sort((a, b) => 
    new Date(b.puzzle.date) - new Date(a.puzzle.date)
  );
  
  for (const result of sortedResults) {
    if (result.won) {
      currentStreak++;
    } else if (result.completed) {
      break; // Streak broken
    }
  }

  return {
    ...user,
    stats: {
      totalGames: user.totalGames,
      totalWins: user.totalWins,
      winRate: user.totalGames > 0 ? (user.totalWins / user.totalGames * 100).toFixed(1) : 0,
      currentStreak,
      longestStreak: user.longestStreak,
      recentGames: completedGames.length,
    }
  };
}
