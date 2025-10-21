import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Users, Shield, Trophy, Star, Calendar } from "lucide-react";
import GradientBackground from "../components/ui/GradientBackground";
import DailyChallengeHero from "../components/ui/DailyChallengeHero";
import AnimatedGameCard from "../components/ui/AnimatedGameCard";
import GlowButton from "../components/ui/GlowButton";

export default function HomeScreenV2({
  name,
  setName,
  roomId,
  setRoomId,
  mode,
  setMode,
  onCreate,
  onJoin,
  onPlayDaily,
  message,
}) {
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isNameSet, setIsNameSet] = useState(!!name);

  const handleNameSubmit = () => {
    if (name.trim()) {
      setIsNameSet(true);
    }
  };

  const handlePlayMode = async (selectedMode) => {
    setMode(selectedMode);
    setCreating(true);
    try {
      if (selectedMode === "daily" && onPlayDaily) {
        await onPlayDaily();
      } else {
        await onCreate();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    setJoining(true);
    try {
      await onJoin();
    } finally {
      setJoining(false);
    }
  };

  const gameModes = [
    {
      icon: <Swords className="w-8 h-8 text-violet-400" />,
      title: "Duel",
      subtitle: "vs. Friend",
      description: "1v1 competitive",
      mode: "duel",
    },
    {
      icon: <Users className="w-8 h-8 text-cyan-400" />,
      title: "Battle Royale",
      subtitle: "Multiplayer",
      description: "Last one standing",
      mode: "battle",
    },
    {
      icon: <Shield className="w-8 h-8 text-purple-400" />,
      title: "Shared Duel",
      subtitle: "Co-op",
      description: "Share the challenge",
      mode: "shared",
    },
  ];

  if (!isNameSet) {
    return (
      <GradientBackground>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-80px)] flex items-center justify-center">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-3xl font-bold text-white mb-2 text-center">
                Welcome to WordlePlus
              </h2>
              <p className="text-white/70 text-center mb-6">
                Enter your name to get started
              </p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                placeholder="Your display name"
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-4 min-h-[56px] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all mb-4"
                autoFocus
              />

              <GlowButton
                onClick={handleNameSubmit}
                size="lg"
                className="w-full"
                disabled={!name.trim()}
              >
                Continue
              </GlowButton>
            </div>
          </motion.div>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="hidden md:block">
            <DailyChallengeHero
              onPlay={() => handlePlayMode("daily")}
              stats={{
                currentStreak: 0,
                maxStreak: 0,
                winRate: 0,
              }}
            />
          </div>

          <section>
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              Game Modes
            </motion.h2>

            <div className="hidden md:grid md:grid-cols-3 gap-4 md:gap-6">
              {gameModes.map((gameMode, index) => (
                <AnimatedGameCard
                  key={gameMode.mode}
                  icon={gameMode.icon}
                  title={gameMode.title}
                  subtitle={gameMode.subtitle}
                  onClick={() => handlePlayMode(gameMode.mode)}
                >
                  <div className="mt-auto">
                    <div className="text-xs text-white/50">
                      {gameMode.description}
                    </div>
                  </div>
                </AnimatedGameCard>
              ))}
            </div>

            <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-4">
              <div
                className="flex gap-4"
                style={{
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {gameModes.map((gameMode, index) => (
                  <div
                    key={gameMode.mode}
                    className="flex-shrink-0 w-[280px]"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <AnimatedGameCard
                      icon={gameMode.icon}
                      title={gameMode.title}
                      subtitle={gameMode.subtitle}
                      onClick={() => handlePlayMode(gameMode.mode)}
                    >
                      <div className="mt-auto">
                        <div className="text-xs text-white/50">
                          {gameMode.description}
                        </div>
                      </div>
                    </AnimatedGameCard>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <motion.div
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 md:p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                Join a Room
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  maxLength={6}
                  className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 min-h-[56px] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all uppercase text-center text-lg tracking-wider font-mono"
                />
                <GlowButton
                  onClick={handleJoinRoom}
                  size="lg"
                  disabled={!roomId || roomId.length !== 6 || joining}
                  className="sm:w-auto"
                >
                  {joining ? "Joining..." : "Join Room"}
                </GlowButton>
              </div>
              {message && (
                <motion.p
                  className="mt-4 text-sm text-red-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {message}
                </motion.p>
              )}
            </motion.div>
          </section>

          <section>
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              Leaderboard
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <LeaderboardCard
                title="Top Players"
                icon={<Trophy className="w-6 h-6 text-yellow-400" />}
              >
                <div className="text-white/50 text-sm text-center py-4">
                  Coming soon...
                </div>
              </LeaderboardCard>

              <LeaderboardCard
                title="Recent Streaks"
                icon={<Star className="w-6 h-6 text-cyan-400" />}
              >
                <div className="text-white/50 text-sm text-center py-4">
                  Coming soon...
                </div>
              </LeaderboardCard>
            </div>
          </section>

          <footer className="text-center py-8 text-white/50 text-sm">
            <p>© 2025 WordlePlus. Built with ❤️ for word game enthusiasts.</p>
          </footer>
        </div>
      </div>

      <motion.button
        onClick={() => handlePlayMode("daily")}
        className="md:hidden fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-2xl flex items-center justify-center z-50"
        style={{
          boxShadow:
            "0 0 32px rgba(124, 58, 237, 0.5), 0 0 48px rgba(34, 211, 238, 0.5)",
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
        aria-label="Play Daily Challenge"
      >
        <Calendar className="w-7 h-7 text-white" />
      </motion.button>
    </GradientBackground>
  );
}

function LeaderboardCard({ title, icon, children }) {
  return (
    <motion.div
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      whileHover={{ borderColor: "rgba(255, 255, 255, 0.3)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}
