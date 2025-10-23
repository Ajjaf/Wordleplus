import { motion, AnimatePresence } from "framer-motion";
import { User, Copy, Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ProfileModal from "../ProfileModal";
import { useAuth } from "../../contexts/AuthContext";

export default function NavHeaderV2({
  onHomeClick,
  right = null,
  modeLabel = null,
  roomId = null,
}) {
  const [copied, setCopied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const copyResetTimeout = useRef(null);
  const menuRef = useRef(null);
  const { user, isAuthenticated, isAnonymous, login, signup } = useAuth();

  useEffect(() => {
    // Force dark mode on mount
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("dark");
    localStorage.setItem("pw.theme", "dark");
  }, []);

  const handleCopyRoomId = async () => {
    if (!roomId) return;

    try {
      await navigator.clipboard?.writeText?.(roomId);
      setCopied(true);
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current);
      }
      copyResetTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Swallow clipboard errors silently to avoid noisy UX
    }
  };

  useEffect(() => {
    setCopied(false);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [menuOpen]);

  const storedName =
    typeof window !== "undefined"
      ? window.localStorage?.getItem("wp.lastName")?.trim()
      : "";
  const displayName =
    (user?.displayName && user.displayName.trim()) ||
    storedName ||
    (!isAnonymous ? "Player" : "Guest");

  return (
    <motion.nav
      className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10"
      style={{
        background: "rgba(11, 11, 16, 0.8)",
        boxShadow: "0 1px 0 0 rgba(124, 58, 237, 0.3)",
      }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20 relative">
          <motion.button
            type="button"
            onClick={onHomeClick}
            className="flex items-center gap-3 hover:opacity-90 active:scale-[0.98] transition"
            whileHover={{ scale: 1.02 }}
            aria-label="Go to Home"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg md:text-xl">W</span>
            </div>
            <span className="sr-only">WordlePlus Home</span>
          </motion.button>

          {modeLabel && (
            <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 hidden sm:flex items-center">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase text-white/70 text-center">
                {modeLabel}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4">
            {roomId && (
              <div className="flex items-center gap-2 text-xs font-medium text-white/80 border border-white/15 rounded-full pl-3 pr-1 h-9 bg-white/5 backdrop-blur">
                <span className="font-mono tracking-wider uppercase">{roomId}</span>
                <button
                  type="button"
                  onClick={handleCopyRoomId}
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition flex items-center justify-center"
                  aria-label={copied ? "Room id copied" : "Copy room id"}
                  title={copied ? "Copied!" : "Copy room id"}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span className="sr-only">
                    {copied ? "Room id copied" : "Copy room id"}
                  </span>
                </button>
              </div>
            )}
            {right}

            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <motion.button
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 md:px-4 md:py-2 transition hover:bg-white/10"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/20 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center border border-white/20">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="hidden sm:block text-sm md:text-base font-medium text-white">
                    {displayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white/70" />
                </motion.button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-lg overflow-hidden z-50"
                    >
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setShowProfile(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={login}
                  className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition"
                >
                  Log In
                </button>
                <button
                  onClick={signup}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-sm font-semibold text-white shadow-lg hover:from-violet-400 hover:to-cyan-400 transition"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal open={showProfile} onOpenChange={setShowProfile} />
    </motion.nav>
  );
}
