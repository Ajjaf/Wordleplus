import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Target } from 'lucide-react';
import GlowButton from './GlowButton';
import { BORDER_RADIUS, SHADOWS } from '../../design-system';

export default function DailyChallengeHero({ onPlay, stats = {} }) {
  const { currentStreak = 0, maxStreak = 0, winRate = 0 } = stats;

  return (
    <motion.div
      className="relative overflow-hidden bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/20 p-6 md:p-8"
      style={{
        borderRadius: BORDER_RADIUS.xl,
        boxShadow: SHADOWS.lg,
      }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ boxShadow: SHADOWS.glow.accent }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-full blur-3xl -z-10" />
      
      <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Daily Challenge
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Today's Word
          </h1>
          
          <p className="text-white/70 text-base md:text-lg">
            Challenge yourself with today's puzzle. One word, six guesses, unlimited glory.
          </p>
          
          <GlowButton 
            onClick={onPlay}
            size="lg"
            className="mt-4"
          >
            Play Today's Word
          </GlowButton>
        </div>

        <div className="grid grid-cols-3 gap-4">
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
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center"
      whileHover={{ scale: 1.05, borderColor: 'rgba(255, 255, 255, 0.3)' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex justify-center text-violet-400 mb-2">
        {icon}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </motion.div>
  );
}
