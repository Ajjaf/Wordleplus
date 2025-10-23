export const COLORS = {
  background: {
    dark: '#0B0B10',
    light: '#181826',
  },
  accent: {
    violet: '#7C3AED',
    cyan: '#22D3EE',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    muted: '#71717A',
  },
  glow: {
    violet: 'rgba(124, 58, 237, 0.5)',
    cyan: 'rgba(34, 211, 238, 0.5)',
  },
};

export const GRADIENTS = {
  background: `linear-gradient(135deg, ${COLORS.background.dark} 0%, ${COLORS.background.light} 100%)`,
  accent: `linear-gradient(135deg, ${COLORS.accent.violet} 0%, ${COLORS.accent.cyan} 100%)`,
  accentHover: `linear-gradient(135deg, ${COLORS.accent.violet} 0%, ${COLORS.accent.cyan} 50%, ${COLORS.accent.violet} 100%)`,
};

export const SPACING = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

export const BORDER_RADIUS = {
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  full: '9999px',  // pill shape
};

export const SHADOWS = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.2)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.3)',
  glow: {
    violet: `0 0 32px ${COLORS.glow.violet}`,
    cyan: `0 0 32px ${COLORS.glow.cyan}`,
    accent: `0 0 24px ${COLORS.glow.violet}, 0 0 48px ${COLORS.glow.cyan}`,
  },
};

export const ANIMATIONS = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
  },
  easing: {
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
    easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
  },
};

export const TRANSITIONS = {
  default: `all ${ANIMATIONS.duration.normal} ${ANIMATIONS.easing.easeOut}`,
  fast: `all ${ANIMATIONS.duration.fast} ${ANIMATIONS.easing.easeOut}`,
  slow: `all ${ANIMATIONS.duration.slow} ${ANIMATIONS.easing.easeOut}`,
};

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
};
