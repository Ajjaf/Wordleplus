/**
 * Mode Theme Configuration
 * Defines visual styling and feature flags for each game mode
 */

export const MODE_THEMES = {
  duel: {
    name: "Duel",
    colors: {
      primary: "#7C3AED", // violet
      secondary: "#A78BFA",
      accent: "#C4B5FD",
      gradient: "from-violet-500/25 via-violet-500/5 to-transparent",
      badge: "bg-violet-500/15 text-violet-100",
      border: "border-violet-500/30",
    },
    icon: "⚔️",
    features: {
      secretWord: true,
      rematch: true,
      particles: true,
      confetti: true,
      timer: true,
    },
    layout: {
      playerCards: "grid-cols-2",
      showProgress: false,
      showSpectate: false,
    },
  },
  shared: {
    name: "Shared Duel",
    colors: {
      primary: "#9333EA", // purple
      secondary: "#C084FC",
      accent: "#DDD6FE",
      gradient: "from-purple-500/25 via-purple-500/5 to-transparent",
      badge: "bg-purple-500/15 text-purple-100",
      border: "border-purple-500/30",
    },
    icon: "🛡️",
    features: {
      secretWord: false,
      rematch: true,
      particles: false,
      confetti: false,
      timer: false,
      turnBased: true,
    },
    layout: {
      playerCards: "grid-cols-2",
      showProgress: false,
      showSpectate: false,
    },
  },
  battle: {
    name: "Battle Royale",
    colors: {
      primary: "#06B6D4", // cyan
      secondary: "#22D3EE",
      accent: "#67E8F9",
      gradient: "from-cyan-500/25 via-cyan-500/5 to-transparent",
      badge: "bg-cyan-500/15 text-cyan-100",
      border: "border-cyan-500/30",
    },
    icon: "👥",
    features: {
      secretWord: false,
      rematch: false,
      particles: true,
      confetti: false,
      timer: false,
      hostControls: true,
      spectate: true,
    },
    layout: {
      playerCards: "flex-col",
      showProgress: true,
      showSpectate: true,
    },
  },
  battle_ai: {
    name: "AI Battle",
    colors: {
      primary: "#F59E0B", // amber
      secondary: "#FBBF24",
      accent: "#FDE047",
      gradient: "from-amber-500/25 via-amber-500/5 to-transparent",
      badge: "bg-amber-500/15 text-amber-100",
      border: "border-amber-500/30",
    },
    icon: "⚡",
    features: {
      secretWord: false,
      rematch: false,
      particles: true,
      confetti: false,
      timer: true,
      hostControls: true,
      spectate: true,
      aiHost: true,
    },
    layout: {
      playerCards: "flex-col",
      showProgress: true,
      showSpectate: true,
    },
  },
  daily: {
    name: "Daily Challenge",
    colors: {
      primary: "#10B981", // emerald
      secondary: "#34D399",
      accent: "#6EE7B7",
      gradient: "from-emerald-500/25 via-emerald-500/5 to-transparent",
      badge: "bg-emerald-500/15 text-emerald-100",
      border: "border-emerald-500/30",
    },
    icon: "📅",
    features: {
      secretWord: false,
      rematch: false,
      particles: false,
      confetti: true,
      timer: false,
      solo: true,
    },
    layout: {
      playerCards: "hidden",
      showProgress: false,
      showSpectate: false,
    },
  },
};

/**
 * Get theme configuration for a mode
 */
export function getModeTheme(mode) {
  return MODE_THEMES[mode] || MODE_THEMES.duel;
}

/**
 * Check if a feature is enabled for a mode
 */
export function hasFeature(mode, feature) {
  const theme = getModeTheme(mode);
  return theme.features[feature] === true;
}

