import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Trophy, Target, Flame, TrendingUp, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function ProfileModal({ open, onOpenChange }) {
  const { user, isAuthenticated, isAnonymous, login, logout } = useAuth();

  if (!open || !user) return null;

  const stats = user.stats || {};

  return (
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

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-violet-900/50 border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
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
                      {user.displayName || user.email || "Guest Player"}
                    </h2>
                    {user.email && (
                      <p className="text-sm text-white/60 mt-0.5">{user.email}</p>
                    )}
                    {isAnonymous && (
                      <p className="text-xs text-amber-400 mt-1">Anonymous Player</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="px-6 py-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Games */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wide">Games</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalGames || 0}</p>
                  </div>

                  {/* Total Wins */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wide">Wins</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalWins || 0}</p>
                  </div>

                  {/* Win Rate */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wide">Win Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.winRate || 0}%</p>
                  </div>

                  {/* Current Streak */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-white/60 uppercase tracking-wide">Streak</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.currentStreak || 0}</p>
                  </div>
                </div>

                {/* Best Streak */}
                {stats.longestStreak > 0 && (
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">Best Streak</span>
                      <span className="text-xl font-bold text-amber-400">
                        {stats.longestStreak} 🔥
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
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
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
