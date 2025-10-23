import { motion } from "framer-motion";
import { Calendar, TrendingUp, Target, Trophy, BarChart3 } from "lucide-react";
import GlowButton from "./GlowButton";
import { BORDER_RADIUS, SHADOWS } from "../../design-system";

export default function DailyChallengeHero({ onPlay, stats = {} }) {
  const {
    currentStreak = 0,
    maxStreak = 0,
    winRate = 0,
    totalWins = 0,
    totalPlayed = 0,
  } = stats;

  return (
    <motion.div
      className="relative overflow-hidden bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 p-5 sm:p-6 md:p-8"
      style={{
        borderRadius: BORDER_RADIUS.xl,
        boxShadow: SHADOWS.lg,
      }}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ boxShadow: SHADOWS.glow.accent }}
    >
      <div className="absolute top-0 right-0 w-56 sm:w-64 h-56 sm:h-64 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-full blur-3xl -z-10" />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-cyan-400">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Daily Challenge
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
            Today's Word
          </h1>

          <p className="text-white/70 text-sm sm:text-base md:text-lg max-w-xl mx-auto md:mx-0">
            Challenge yourself with today's puzzle. One word, six guesses. Keep
            the streak alive.
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2">
            <MiniMetric label="Wins" value={totalWins} icon={<Trophy className="w-4 h-4" />} />
            <MiniMetric
              label="Played"
              value={totalPlayed}
              icon={<BarChart3 className="w-4 h-4" />}
            />
          </div>

          <GlowButton onClick={onPlay} size="lg" className="mt-2 md:mt-4 mx-auto md:mx-0">
            Play Today's Word
          </GlowButton>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            value={currentStreak}
            label="Current Streak"
          />
          <StatCard
            icon={<Target className="w-5 h-5" />}
            value={maxStreak}
            label="Max Streak"
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            value={`${winRate}%`}
            label="Win Rate"
          />
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center flex flex-col items-center"
      whileHover={{ scale: 1.05, borderColor: "rgba(255, 255, 255, 0.3)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex justify-center text-violet-400 mb-1.5">{icon}</div>
      <div className="text-lg sm:text-2xl font-bold text-white mb-0.5">
        {value}
      </div>
      <div className="text-[11px] sm:text-xs text-white/60 uppercase tracking-wide">
        {label}
      </div>
    </motion.div>
  );
}

function MiniMetric({ label, value, icon }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-white/80 text-xs font-medium backdrop-blur">
      <span className="text-violet-300">{icon}</span>
      <span>{label}:</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
