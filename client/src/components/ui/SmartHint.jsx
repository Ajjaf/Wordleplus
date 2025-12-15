import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * SmartHint - Context-aware hint system that shows hints only when needed
 * 
 * Features:
 * - Shows only on first use (localStorage-based)
 * - Auto-dismisses after action or timeout
 * - Dismissible by user
 * - Respects user preferences
 */
export function SmartHint({
  show = false,
  message = "",
  icon = null,
  position = "below", // "below" | "above" | "left" | "right"
  autoHide = 3000, // milliseconds, 0 = no auto-hide
  dismissible = true,
  storageKey = null, // localStorage key to track if hint was seen
  onDismiss = () => {},
  className = "",
  children, // Custom content instead of message
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenHint, setHasSeenHint] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (storageKey) {
      const seen = localStorage.getItem(storageKey);
      if (seen === "true") {
        setHasSeenHint(true);
      }
    }
  }, [storageKey]);

  // Show/hide based on props and localStorage
  useEffect(() => {
    if (show && !hasSeenHint) {
      setIsVisible(true);
      
      // Auto-hide after timeout
      if (autoHide > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoHide);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [show, hasSeenHint, autoHide]);

  const handleDismiss = () => {
    setIsVisible(false);
    
    // Mark as seen in localStorage
    if (storageKey) {
      localStorage.setItem(storageKey, "true");
      setHasSeenHint(true);
    }
    
    onDismiss();
  };

  if (!isVisible || hasSeenHint) return null;

  const positionClasses = {
    below: "top-full mt-2 left-1/2 -translate-x-1/2",
    above: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: position === "below" ? -10 : position === "above" ? 10 : 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={`
            absolute ${positionClasses[position] || positionClasses.below}
            z-50 pointer-events-auto
            ${className}
          `}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-xl flex items-center gap-2 min-w-[120px]">
            {icon && <span className="text-white/90">{icon}</span>}
            <span className="text-xs text-white/90 font-medium flex-1">
              {children || message}
            </span>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="text-white/60 hover:text-white transition-colors p-0.5"
                aria-label="Dismiss hint"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Arrow pointer */}
          <div
            className={`
              absolute w-2 h-2 bg-slate-900/95 border-r border-b border-white/20
              ${position === "below" ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45" : ""}
              ${position === "above" ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45" : ""}
              ${position === "left" ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45" : ""}
              ${position === "right" ? "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45" : ""}
            `}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SmartHint;

