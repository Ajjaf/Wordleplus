import React, { useEffect, useState } from "react";

/**
 * Severity-based color styles
 */
const SEVERITY_STYLES = {
  error: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white"
};

/**
 * Transient notification component with accessibility support
 * Displays a color-coded notification that auto-dismisses after a set duration
 * 
 * @param {string} message - The notification text
 * @param {string} severity - "error" | "warning" | "info" | "success"
 * @param {number} duration - Auto-dismiss duration in milliseconds
 * @param {function} onDismiss - Callback when notification is dismissed
 */
export default function GameNotification({ 
  message, 
  duration = 1500, 
  onDismiss, 
  severity = "info"
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!message) return;

    setIsVisible(true);
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        setTimeout(onDismiss, 300);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const severityClass = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`
        ${severityClass}
        px-6 py-3 rounded-lg shadow-lg
        font-semibold text-sm
        transition-all duration-300
        pointer-events-auto
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
        min-h-[48px] sm:min-h-[40px]
        flex items-center justify-center
        w-11/12 sm:w-auto sm:max-w-md
      `}
    >
      {message}
    </div>
  );
}
