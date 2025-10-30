import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Trophy,
  Target,
  Flame,
  TrendingUp,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createPortal } from "react-dom";

const VIEW_LABELS = {
  profile: "Profile Overview",
  achievements: "Achievements",
  settings: "Player Settings",
};

export default function ProfileModal({ open, onOpenChange, view = "profile" }) {
  const { user, isAnonymous, login, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState(view);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (view) {
      setActiveView(view);
    }
  }, [view]);

  const stats = user?.stats || {};
  const achievements = useMemo(() => {
    if (Array.isArray(user?.achievements)) return user.achievements;
    if (Array.isArray(stats?.achievements)) return stats.achievements;
    return [];
  }, [stats?.achievements, user?.achievements]);

  if (!mounted || !user) return null;

  const storedName =
    typeof window !== "undefined"
      ? window.localStorage?.getItem("wp.lastName")?.trim()
      : "";

  const playerName =
    (user.displayName && user.displayName.trim()) ||
    storedName ||
    (isAnonymous ? "Guest Player" : "Player");

  const renderStatsSection = () => (
    <>
      <div className="px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/60 uppercase tracking-wide">
                Games
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalGames || 0}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/60 uppercase tracking-wide">
                Wins
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalWins || 0}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/60 uppercase tracking-wide">
                Win Rate
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.winRate || 0}%
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-white/60 uppercase tracking-wide">
                Streak
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.currentStreak || 0}
            </p>
          </div>
        </div>

        {stats.longestStreak > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Best Streak</span>
              <span className="text-xl font-bold text-amber-400">
                {stats.longestStreak}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-6">
        {isAnonymous ? (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 rounded-lg p-4">
              <p className="text-sm text-white/80 text-center">
                Sign in to save your progress and compete on the leaderboard!
              </p>
            </div>
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              <LogIn className="w-5 h-5" />
              Sign In to Save Progress
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-medium rounded-lg transition-all border border-white/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        )}
      </div>
    </>
  );

  const renderAchievementsSection = () => (
    <div className="px-6 py-6 space-y-4">
      {achievements.length > 0 ? (
        <div className="space-y-3">
          {achievements.map((achievement, idx) => {
            const title =
              typeof achievement === "string"
                ? achievement
                : achievement?.title || `Achievement ${idx + 1}`;
            const description =
              typeof achievement === "object"
                ? achievement?.description || ""
                : "";
            const earnedAt =
              typeof achievement === "object" && achievement?.earnedAt
                ? new Date(achievement.earnedAt)
                : null;

            return (
              <div
                key={idx}
                className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/20">
                    <Trophy className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    {description && (
                      <p className="text-xs text-white/60 mt-1">
                        {description}
                      </p>
                    )}
                    {earnedAt && !Number.isNaN(earnedAt.valueOf()) && (
                      <p className="text-[11px] text-white/40 mt-1">
                        Earned on {earnedAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center text-sm text-white/70">
          <p>No achievements yet. Keep playing to unlock trophies!</p>
        </div>
      )}
    </div>
  );

  const content =
    activeView === "achievements"
      ? renderAchievementsSection()
      : renderStatsSection();

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            onClick={() => onOpenChange(false)}
          >
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-violet-900/50 border border-white/20 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] pointer-events-auto overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-white/80" />
                  </button>

                  <div className="flex items-center gap-4">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName || "User"}
                        className="w-16 h-16 rounded-full border-2 border-white/20"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                        <User className="w-8 h-8 text-white/60" />
                      </div>
                    )}

                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white">
                        {playerName}
                      </h2>
                      {isAnonymous && (
                        <p className="text-xs text-amber-400 mt-1">
                          Anonymous Player
                        </p>
                      )}
                      <p className="text-xs text-white/50 mt-1 uppercase tracking-[0.2em]">
                        {VIEW_LABELS[activeView] || VIEW_LABELS.profile}
                      </p>
                    </div>
                  </div>
                </div>

                {content}
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
