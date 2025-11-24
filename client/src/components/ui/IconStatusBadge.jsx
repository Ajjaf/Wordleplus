import React from "react";
import { motion } from "framer-motion";
import { Clock, Users, Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * IconStatusBadge - Icon-based status indicator
 * Replaces text status messages with visual icons
 */
const STATUS_ICONS = {
  waiting: Clock,
  waitingForPlayer: Users,
  ready: Zap,
  success: CheckCircle,
  error: AlertCircle,
  loading: Loader2,
};

const STATUS_COLORS = {
  waiting: "text-amber-400",
  waitingForPlayer: "text-blue-400",
  ready: "text-emerald-400",
  success: "text-green-400",
  error: "text-red-400",
  loading: "text-white/60",
};

export function IconStatusBadge({
  type = "waiting", // "waiting" | "waitingForPlayer" | "ready" | "success" | "error" | "loading"
  animated = true,
  size = "md", // "sm" | "md" | "lg"
  className = "",
  tooltip = null, // Optional tooltip text on hover
}) {
  const Icon = STATUS_ICONS[type] || STATUS_ICONS.waiting;
  const colorClass = STATUS_COLORS[type] || STATUS_COLORS.waiting;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const animationProps = animated
    ? {
        animate: {
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7],
        },
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }
    : {};

  return (
    <motion.div
      {...animationProps}
      className={cn("inline-flex items-center justify-center", className)}
      title={tooltip || undefined}
    >
      <Icon className={cn(sizeClasses[size], colorClass)} />
    </motion.div>
  );
}

export default IconStatusBadge;

