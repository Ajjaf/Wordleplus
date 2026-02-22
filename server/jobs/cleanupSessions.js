import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Delete all Prisma Session rows whose `expiresAt` is in the past.
 * @returns {Promise<number>} Number of sessions deleted.
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`[cleanup] Removed ${result.count} expired session(s)`);
    }
    return result.count;
  } catch (error) {
    console.error("[cleanup] Failed to clean up sessions:", error);
    return 0;
  }
}

/**
 * Start the hourly session cleanup interval.
 * Safe to call multiple times — only the returned interval ref matters.
 */
export function startSessionCleanup() {
  cleanupExpiredSessions();

  const interval = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
  if (interval.unref) interval.unref();
  return interval;
}
