import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function mergeAnonymousUserIntoExisting(anonymousUserId, existingAuthenticatedUserId) {
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

    // Get the existing authenticated user
    const existingUser = await tx.user.findUnique({
      where: { id: existingAuthenticatedUserId }
    });

    if (!existingUser) {
      throw new Error("Authenticated user not found");
    }

    // Track transferred results to calculate accurate stats
    let transferredGames = 0;
    let transferredWins = 0;

    // Transfer daily results to authenticated user
    if (anonUser.results.length > 0) {
      for (const result of anonUser.results) {
        try {
          await tx.dailyResult.update({
            where: { id: result.id },
            data: { userId: existingAuthenticatedUserId }
          });
          // Successfully transferred - count it
          if (result.completed) {
            transferredGames++;
            if (result.won) {
              transferredWins++;
            }
          }
        } catch (error) {
          // If there's a conflict (authenticated user already has result for this puzzle)
          // Keep the better one (more attempts = progressed further)
          const existingResult = await tx.dailyResult.findUnique({
            where: {
              userId_puzzleId: {
                userId: existingAuthenticatedUserId,
                puzzleId: result.puzzleId
              }
            }
          });

          if (existingResult && result.attempts > existingResult.attempts) {
            // Anonymous user progressed further, replace existing result
            await tx.dailyResult.update({
              where: {
                userId_puzzleId: {
                  userId: existingAuthenticatedUserId,
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
            // We replaced existing with anonymous, so net change is:
            // Subtract old result stats, add new result stats
            if (existingResult.completed && result.completed) {
              // Both completed - check if we're changing the win status
              if (result.won && !existingResult.won) {
                transferredWins++;
              } else if (!result.won && existingResult.won) {
                transferredWins--;
              }
            } else if (result.completed && !existingResult.completed) {
              // New result is completed, old wasn't
              transferredGames++;
              if (result.won) transferredWins++;
            }
            // Note: if old was completed but new isn't, we don't subtract
            // because that would mean going backwards
          }
          // Delete the anonymous user's result
          await tx.dailyResult.delete({
            where: { id: result.id }
          });
        }
      }
    }

    // Merge stats (only add the actually transferred stats)
    await tx.user.update({
      where: { id: existingAuthenticatedUserId },
      data: {
        totalWins: existingUser.totalWins + transferredWins,
        totalGames: existingUser.totalGames + transferredGames,
        // Keep the higher streak
        longestStreak: Math.max(existingUser.longestStreak, anonUser.longestStreak),
      }
    });

    // Transfer events to authenticated user
    if (anonUser.events.length > 0) {
      await tx.event.updateMany({
        where: { userId: anonymousUserId },
        data: { userId: existingAuthenticatedUserId }
      });
    }

    // Mark the anonymous user as merged
    await tx.user.update({
      where: { id: anonymousUserId },
      data: {
        mergedIntoUserId: existingAuthenticatedUserId,
        mergedAt: new Date(),
      }
    });

    console.log(`[MERGE] Successfully merged anonymous user ${anonymousUserId} into existing account ${existingAuthenticatedUserId}`);
    console.log(`  - Transferred ${anonUser.results.length} daily results`);
    console.log(`  - Transferred ${anonUser.events.length} events`);
    console.log(`  - Added ${transferredWins} wins, ${transferredGames} games to existing account (after deduplication)`);
  });
}

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
