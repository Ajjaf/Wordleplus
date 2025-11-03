import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  Users,
  Shield,
  Trophy,
  Star,
  Clock,
  Zap,
} from "lucide-react";
import GradientBackground from "../components/ui/GradientBackground";
import DailyChallengeHero from "../components/ui/DailyChallengeHero";
import AnimatedGameCard from "../components/ui/AnimatedGameCard";
import GlowButton from "../components/ui/GlowButton";
import { useAuth } from "../contexts/AuthContext";
import { buildApiUrl } from "../config";

const DEFAULT_DAILY_STATS = {
  currentStreak: 0,
  maxStreak: 0,
  winRate: 0,
  totalWins: 0,
  totalPlayed: 0,
};

const MODE_META = {
  duel: {
    label: "Duel",
    icon: Swords,
    badgeClass: "bg-violet-500/15 text-violet-100",
    gradient: "from-violet-500/25 via-violet-500/5 to-transparent",
  },
  battle: {
    label: "Battle Royale",
    icon: Users,
    badgeClass: "bg-cyan-500/15 text-cyan-100",
    gradient: "from-cyan-500/25 via-cyan-500/5 to-transparent",
  },
  battle_ai: {
    label: "AI Battle",
    icon: Zap,
    badgeClass: "bg-amber-500/15 text-amber-100",
    gradient: "from-amber-500/25 via-amber-500/5 to-transparent",
  },
  shared: {
    label: "Shared Duel",
    icon: Shield,
    badgeClass: "bg-purple-500/15 text-purple-100",
    gradient: "from-purple-500/25 via-purple-500/5 to-transparent",
  },
};

const DEFAULT_MODE_META = {
  label: "Multiplayer",
  icon: Users,
  badgeClass: "bg-white/10 text-white/80",
  gradient: "from-white/10 via-transparent to-transparent",
};

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
  const { user, isAuthenticated, refreshUser } = useAuth();
  const isAnonymous = !isAuthenticated || user?.isAnonymous;
  const [dailyStats, setDailyStats] = useState(DEFAULT_DAILY_STATS);
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [eventStatus, setEventStatus] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || isAnonymous) return;

    const normalizedDisplay =
      typeof user?.displayName === "string" ? user.displayName.trim() : "";
    const savedName =
      typeof window !== "undefined"
        ? window.localStorage?.getItem("wp.lastName")?.trim()
        : "";
    const emailName =
      !normalizedDisplay &&
      !savedName &&
      typeof user?.email === "string" &&
      user.email.includes("@")
        ? user.email.split("@")[0] || ""
        : "";

    const derivedName = normalizedDisplay || savedName || emailName;

    if (!derivedName) return;

    if (derivedName !== name) {
      setName(derivedName);
    }
    if (!isNameSet) {
      setIsNameSet(true);
    }
  }, [isAuthenticated, isAnonymous, user, name, setName, isNameSet]);

  useEffect(() => {
    if (!isNameSet) {
      setDailyStats(DEFAULT_DAILY_STATS);
      return;
    }

    let isActive = true;

    async function loadDailyStats() {
      try {
        const response = await fetch(buildApiUrl("/api/daily/stats"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to load stats (${response.status})`);
        }

        const data = await response.json();
        if (!isActive) return;

        const normalized = {
          currentStreak: Number(data.currentStreak) || 0,
          maxStreak: Number(data.maxStreak) || 0,
          winRate: Number(data.winRate) || 0,
          totalWins: Number(data.totalWins) || 0,
          totalPlayed: Number(data.totalPlayed) || 0,
        };

        setDailyStats(normalized);

        const userStats = user?.stats;
        const needsRefresh =
          userStats &&
          (Number(userStats.totalWins ?? 0) !== normalized.totalWins ||
            Number(userStats.totalGames ?? 0) !== normalized.totalPlayed ||
            Number(userStats.currentStreak ?? userStats.streak ?? 0) !==
              normalized.currentStreak ||
            Number.parseFloat(userStats.winRate ?? 0) !== normalized.winRate);

        if (needsRefresh && typeof refreshUser === "function") {
          refreshUser();
        }
      } catch (error) {
        if (isActive) {
          setDailyStats(DEFAULT_DAILY_STATS);
          console.error("Failed to load daily stats:", error);
        }
      }
    }

    loadDailyStats();

    return () => {
      isActive = false;
    };
  }, [isNameSet, isAuthenticated, isAnonymous, refreshUser, user?.stats]);

  useEffect(() => {
    if (!isNameSet) {
      setOpenRooms([]);
      setRoomsLoading(false);
      return;
    }

    let isActive = true;

    const fetchRooms = async (showLoader = false) => {
      if (!isActive) return;
      if (showLoader) setRoomsLoading(true);
      try {
        const response = await fetch(buildApiUrl("/api/rooms/open"), {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to load open rooms (${response.status})`);
        }
        const data = await response.json();
        if (!isActive) return;
        setOpenRooms(Array.isArray(data?.rooms) ? data.rooms : []);
        setRoomsError("");
      } catch (error) {
        if (!isActive) return;
        console.error("Failed to load open rooms:", error);
        setRoomsError("Unable to load open rooms right now.");
      } finally {
        if (isActive) setRoomsLoading(false);
      }
    };

    fetchRooms(true);
    const intervalId = setInterval(() => fetchRooms(false), 15000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [isNameSet]);

  useEffect(() => {
    let isActive = true;
    const fetchStatus = async () => {
      if (!isActive) return;
      try {
        const response = await fetch(buildApiUrl("/api/events/status"), {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to load event status (${response.status})`);
        }
        const data = await response.json();
        if (!isActive) return;
        setEventStatus(data);
        setEventError("");
      } catch (error) {
        if (!isActive) return;
        console.error("Failed to load event status:", error);
        setEventError("Unable to load event status.");
        setEventStatus(null);
      } finally {
        if (isActive) setEventLoading(false);
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 15000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, []);

  const eventRoom = useMemo(() => {
    if (!eventStatus?.roomId) return null;
    return openRooms.find((room) => room.id === eventStatus.roomId) || null;
  }, [eventStatus?.roomId, openRooms]);

  const eventSlotLabel = useMemo(() => {
    if (!eventStatus?.slot) return null;
    return `${eventStatus.slot} GMT`;
  }, [eventStatus?.slot]);

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
        await onCreate(selectedMode);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId || roomId.length !== 6) return;
    setJoining(true);
    try {
      await onJoin(roomId);
    } finally {
      setJoining(false);
    }
  };

  const handleQuickJoin = async (targetRoomId, targetMode) => {
    if (!targetRoomId || joining || joiningRoomId) return;
    const normalizedId = String(targetRoomId).toUpperCase();
    if (normalizedId.length !== 6) return;
    setJoiningRoomId(normalizedId);
    setRoomId(normalizedId);
    if (targetMode) {
      setMode(targetMode);
    }
    try {
      await onJoin(normalizedId, targetMode);
    } finally {
      setJoiningRoomId(null);
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
      icon: <Zap className="w-8 h-8 text-amber-400" />,
      title: "AI Battle",
      subtitle: "Server Host",
      description: "AI-hosted rounds",
      mode: "battle_ai",
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
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 md:py-12 pb-24 md:pb-12">
        <div className="w-full space-y-8">
          <DailyChallengeHero
            onPlay={() => handlePlayMode("daily")}
            stats={dailyStats}
          />

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
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              Open Game Rooms
            </motion.h2>

            <div className="space-y-4">
              {roomsError && !roomsLoading && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                  {roomsError}
                </div>
              )}

              {roomsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-full min-h-[180px] rounded-3xl border border-white/10 bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : openRooms.length === 0 ? (
                <motion.div
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 text-white/60 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-base">
                    No open rooms right now. Create one or check back soon!
                  </p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {openRooms.map((room, index) => {
                    const meta = MODE_META[room.mode] || DEFAULT_MODE_META;
                    const ModeIcon = meta.icon || Users;
                    const playerLabel = room.capacity
                      ? `${room.playerCount}/${room.capacity}`
                      : `${room.playerCount} player${
                          room.playerCount === 1 ? "" : "s"
                        }`;
                    const statusLabel = room.isInProgress ? "In Match" : "Waiting";
                    const statusClass = room.isInProgress
                      ? "text-amber-300"
                      : "text-emerald-300";
                    const hostName =
                      typeof room.hostName === "string" && room.hostName.trim()
                        ? room.hostName.trim()
                        : "Mystery Host";
                    return (
                      <motion.div
                        key={room.id}
                        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 flex flex-col"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        whileHover={{ borderColor: "rgba(255,255,255,0.3)", y: -4 }}
                      >
                        <div
                          className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${meta.gradient}`}
                        />
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                            >
                              <ModeIcon className="w-4 h-4" />
                              {meta.label}
                            </span>
                            <span className="text-xs font-mono text-white/60 tracking-[0.35em]">
                              {room.id}
                            </span>
                          </div>

                          <div className="mt-6">
                            <p className="text-xs uppercase tracking-wide text-white/50">
                              Host
                            </p>
                            <p className="text-lg font-semibold text-white mt-1">
                              {hostName}
                            </p>
                          </div>

                          <div className="mt-auto pt-6 flex items-end justify-between gap-4">
                            <div>
                              <p className="text-2xl font-bold text-white leading-none">
                                {playerLabel}
                              </p>
                              <p
                                className={`text-xs uppercase tracking-wide mt-2 ${statusClass}`}
                              >
                                {statusLabel}
                              </p>
                            </div>
                            <GlowButton
                              size="md"
                              onClick={() => handleQuickJoin(room.id, room.mode)}
                              disabled={Boolean(joiningRoomId) || joining}
                            >
                              {joiningRoomId === room.id ? "Joining..." : "Join Room"}
                            </GlowButton>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section>
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              Active Events
            </motion.h2>

            <div className="space-y-4">
              {eventError && !eventLoading && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                  {eventError}
                </div>
              )}

              {eventLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="h-full min-h-[200px] rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
                </div>
              ) : eventStatus?.active && eventStatus?.roomId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <motion.div
                    className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 flex flex-col"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    whileHover={{ borderColor: "rgba(255,255,255,0.3)", y: -4 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-200">
                        <Zap className="w-4 h-4" />
                        Live Now
                      </span>
                      <span className="text-sm font-semibold text-cyan-200">
                        {eventSlotLabel || "Today"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wide text-white/50">
                        AI Battle
                      </p>
                      <h3 className="text-xl font-bold text-white mt-1">
                        AI Battle Hour
                      </h3>
                      <p className="text-sm text-white/60 mt-2">
                        Jump into our featured AI-hosted lobby. Rounds auto-cycle
                        every few seconds—perfect for quick matches.
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-sm text-white/70">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                          <Users className="w-4 h-4 text-white/60" />
                          <span>
                            {eventRoom?.playerCount ?? 0}
                            {eventRoom?.capacity
                              ? ` / ${eventRoom.capacity}`
                              : " players"}
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                          <Clock className="w-4 h-4 text-white/60" />
                          <span>Ends {eventSlotLabel || "soon"}</span>
                        </div>
                      </div>
                      <GlowButton
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          handleQuickJoin(eventStatus.roomId, "battle_ai")
                        }
                        disabled={
                          !eventStatus.roomId ||
                          Boolean(joiningRoomId) ||
                          joining
                        }
                      >
                        {joiningRoomId === eventStatus.roomId
                          ? "Joining..."
                          : "Join Now"}
                      </GlowButton>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 text-white/60 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-base">
                    No live events right now. Check back during the next AI
                    Battle Hour{eventSlotLabel ? ` (${eventSlotLabel})` : ""}.
                  </p>
                </motion.div>
              )}
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
            <p>
              © 2025 WordlePlus. Login for the Daily Word, Stay for the
              Multiplayer.
            </p>
          </footer>
        </div>
      </div>

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
