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
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createPortal } from "react-dom";

const TABS = [
  { id: "profile", label: "Overview" },
  { id: "achievements", label: "Achievements" },
];

// Map achievement keywords to icon + color
function getAchievementStyle(title = "") {
  const t = title.toLowerCase();
  if (t.includes("win") || t.includes("champion") || t.includes("victor")) {
    return { Icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-400/20", border: "border-l-amber-400" };
  }
  if (t.includes("streak") || t.includes("flame") || t.includes("fire") || t.includes("hot")) {
    return { Icon: Flame, color: "text-orange-400", bg: "bg-orange-500/15 border-orange-400/20", border: "border-l-orange-400" };
  }
  if (t.includes("daily") || t.includes("puzzle") || t.includes("challenge")) {
    return { Icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/15 border-cyan-400/20", border: "border-l-cyan-400" };
  }
  return { Icon: Zap, color: "text-violet-400", bg: "bg-violet-500/15 border-violet-400/20", border: "border-l-violet-400" };
}

export default function ProfileModal({ open, onOpenChange, view = "profile" }) {
  const { user, isAnonymous, login, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState(view);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (view) setActiveView(view);
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

  const winRate = stats.winRate || 0;

  const statCards = [
    { icon: Target, color: "text-cyan-400", label: "Games", value: stats.totalGames || 0 },
    { icon: Trophy, color: "text-amber-400", label: "Wins", value: stats.totalWins || 0 },
    { icon: TrendingUp, color: "text-emerald-400", label: "Win Rate", value: `${winRate}%` },
    { icon: Flame, color: "text-orange-400", label: "Streak", value: stats.currentStreak || 0 },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Scroll container */}
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            onClick={() => onOpenChange(false)}
          >
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-violet-900/50 border border-white/15 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] pointer-events-auto overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

                {/* Header */}
                <div className="relative px-4 sm:px-6 pt-5 pb-4 border-b border-white/10">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 p-2.5 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
                    aria-label="Close profile"
                  >
                    <X className="w-5 h-5 text-white/70" />
                  </button>

                  <div className="flex items-center gap-4 pr-10">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName || "User"}
                        className="w-14 h-14 rounded-full border-2 border-white/20 shrink-0"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600/50 to-slate-700 border-2 border-white/20 flex items-center justify-center shrink-0">
                        <User className="w-7 h-7 text-white/60" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-white truncate">{playerName}</h2>
                      {isAnonymous && (
                        <span className="inline-block text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full mt-1">
                          Anonymous
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tab bar */}
                  <div className="flex gap-1 mt-4">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id)}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                          activeView === tab.id
                            ? "bg-white/10 text-white"
                            : "text-white/40 hover:text-white/70 hover:bg-white/5"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                  {activeView === "achievements" ? (
                    <motion.div
                      key="achievements"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <AchievementsSection achievements={achievements} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <StatsSection
                        statCards={statCards}
                        winRate={winRate}
                        stats={stats}
                        isAnonymous={isAnonymous}
                        login={login}
                        logout={logout}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function StatsSection({ statCards, winRate, stats, isAnonymous, login, logout }) {
  return (
    <div className="px-4 sm:px-6 py-5 space-y-4">
      {/* 2x2 stat grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(({ icon: Icon, color, label, value }) => (
          <div
            key={label}
            className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[80px] flex flex-col justify-between backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[11px] text-white/50 uppercase tracking-wide font-medium">
                {label}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Win rate</span>
          <span className="text-emerald-400 font-semibold">{winRate}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(winRate, 100)}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Best streak */}
      {stats.longestStreak > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-medium">Best streak</span>
          </div>
          <span className="text-xl font-bold text-amber-400">{stats.longestStreak}</span>
        </div>
      )}

      {/* Sign in / out */}
      {isAnonymous ? (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 rounded-xl p-4">
            <p className="text-sm text-white/70 text-center">
              Sign in to save your progress and compete on the leaderboard!
            </p>
          </div>
          <motion.button
            onClick={login}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-500/20"
          >
            <LogIn className="w-5 h-5" />
            Sign In to Save Progress
          </motion.button>
        </div>
      ) : (
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/8 hover:bg-white/15 active:bg-white/20 text-white/70 hover:text-white font-medium rounded-xl transition-all border border-white/10"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      )}
    </div>
  );
}

function AchievementsSection({ achievements }) {
  if (achievements.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-10 text-center space-y-3">
        <div className="text-5xl select-none">🏆</div>
        <p className="text-base font-semibold text-white/70">No achievements yet</p>
        <p className="text-sm text-white/40">Keep playing to unlock trophies!</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-5 space-y-3">
      {achievements.map((achievement, idx) => {
        const title =
          typeof achievement === "string"
            ? achievement
            : achievement?.title || `Achievement ${idx + 1}`;
        const description =
          typeof achievement === "object" ? achievement?.description || "" : "";
        const earnedAt =
          typeof achievement === "object" && achievement?.earnedAt
            ? new Date(achievement.earnedAt)
            : null;

        const { Icon, color, bg, border } = getAchievementStyle(title);

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`bg-white/5 border border-white/10 border-l-2 ${border} rounded-xl p-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} border`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{title}</p>
                {description && (
                  <p className="text-xs text-white/50 mt-0.5">{description}</p>
                )}
                {earnedAt && !Number.isNaN(earnedAt.valueOf()) && (
                  <p className="text-[11px] text-white/30 mt-1">
                    {earnedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
