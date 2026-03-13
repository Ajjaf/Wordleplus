import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Flame, Target, Zap, Users } from "lucide-react";
import GradientBackground from "../components/ui/GradientBackground";
import { useAuth } from "../contexts/AuthContext";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { buildApiUrl } from "../config";
import { logger } from "../utils/logger";

const TABS = [
  { id: "alltime", label: "All-Time" },
  { id: "weekly", label: "Weekly" },
];

const CATEGORIES = [
  { id: "wins", label: "Most Wins", icon: Trophy, color: "text-yellow-400" },
  { id: "winRate", label: "Best Win Rate", icon: Target, color: "text-emerald-400" },
  { id: "streaks", label: "Longest Streak", icon: Flame, color: "text-orange-400" },
  { id: "avgGuesses", label: "Fastest Solve", icon: Zap, color: "text-cyan-400" },
];

function formatStat(category, player) {
  switch (category) {
    case "wins":
      return `${player.totalWins}W / ${player.totalGames}G`;
    case "winRate":
      return `${player.winRate}%`;
    case "streaks":
      return `${player.longestStreak} best · ${player.streak} current`;
    case "avgGuesses":
      return `${player.avgGuesses} avg · ${player.gamesWon} wins`;
    case "weekly":
      return `${player.weeklyWins} wins`;
    default:
      return String(player.statValue ?? "");
  }
}

function getAvatarLetter(player) {
  const name = player.displayName || player.username || "?";
  return name.charAt(0).toUpperCase();
}

const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderboardRow({ player, rank, isMe, category }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
        isMe
          ? "bg-violet-500/20 border border-violet-500/30"
          : "hover:bg-white/5"
      }`}
    >
      <span className="w-8 text-center text-sm font-bold text-white/70 shrink-0">
        {MEDALS[rank - 1] || rank}
      </span>

      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: isMe
            ? "linear-gradient(135deg, #8b5cf6, #6d28d9)"
            : "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
          color: "white",
        }}
      >
        {getAvatarLetter(player)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {player.displayName || player.username || "Anonymous"}
          {isMe && (
            <span className="ml-2 text-xs text-violet-300 font-normal">you</span>
          )}
        </p>
      </div>

      <span className="text-xs text-white/60 font-mono whitespace-nowrap shrink-0">
        {formatStat(category, player)}
      </span>
    </motion.div>
  );
}

export default function LeaderboardScreen() {
  const { navigateHome } = useAppNavigation();
  const { user } = useAuth();

  const [tab, setTab] = useState("alltime");
  const [category, setCategory] = useState("wins");
  const [nearMe, setNearMe] = useState(false);

  const [categories, setCategories] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [nearMeData, setNearMeData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [nearMeLoading, setNearMeLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [catRes, weeklyRes] = await Promise.all([
          fetch(buildApiUrl("/api/leaderboard/categories"), { credentials: "include" }),
          fetch(buildApiUrl("/api/leaderboard/weekly"), { credentials: "include" }),
        ]);
        if (!active) return;
        if (catRes.ok) {
          const data = await catRes.json();
          if (active) setCategories(data);
        }
        if (weeklyRes.ok) {
          const data = await weeklyRes.json();
          if (active) setWeekly(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        logger.error("Failed to load leaderboard:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const activeCategory = tab === "weekly" ? "weekly" : category;

  const fetchNearMe = useCallback(async () => {
    if (!user?.id) return;
    setNearMeLoading(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/leaderboard/near-me?category=${activeCategory}`),
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setNearMeData(data);
      }
    } catch (err) {
      logger.error("Failed to load near-me:", err);
    } finally {
      setNearMeLoading(false);
    }
  }, [activeCategory, user?.id]);

  useEffect(() => {
    if (nearMe) {
      fetchNearMe();
    } else {
      setNearMeData(null);
    }
  }, [nearMe, fetchNearMe]);

  function getDisplayList() {
    if (nearMe && nearMeData?.players) {
      return { list: nearMeData.players, ranked: true };
    }
    if (tab === "weekly") {
      return { list: weekly || [], ranked: false };
    }
    if (!categories) return { list: [], ranked: false };
    return { list: categories[category] || [], ranked: false };
  }

  const { list, ranked } = getDisplayList();

  return (
    <GradientBackground>
      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={navigateHome}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Leaderboard
            </h1>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setNearMe(false); }}
                className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-white/20 text-white border border-white/20"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category pills (all-time only) */}
          {tab === "alltime" && (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setNearMe(false); }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? "bg-white/15 text-white border border-white/20"
                        : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? cat.color : ""}`} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Near Me toggle + rank info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.id && (
                <button
                  onClick={() => setNearMe((v) => !v)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    nearMe
                      ? "bg-violet-500/25 text-violet-200 border border-violet-500/30"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Near Me
                </button>
              )}
              {nearMe && nearMeData?.myRank && (
                <span className="text-xs text-white/50">
                  Your rank: <span className="text-white font-bold">#{nearMeData.myRank}</span>
                </span>
              )}
            </div>

            {!loading && !nearMe && (
              <span className="text-xs text-white/40">
                {list.length} player{list.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Leaderboard list */}
          <motion.div
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-4 space-y-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {loading || nearMeLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white/80" />
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-white/50 text-sm">
                {nearMe
                  ? "You haven't placed in this category yet. Play more to get ranked!"
                  : "No players on the board yet — be the first!"}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {list.map((player, i) => {
                  const rank = ranked ? Number(player.rank) : i + 1;
                  return (
                    <LeaderboardRow
                      key={player.id || player.username || i}
                      player={player}
                      rank={rank}
                      isMe={user?.id === player.id}
                      category={activeCategory}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </motion.div>

          <footer className="text-center py-4 text-white/30 text-xs">
            Updated in real-time from daily challenge results
          </footer>
        </div>
      </div>
    </GradientBackground>
  );
}
