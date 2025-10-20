import React, { createContext, useContext, useState, useCallback } from "react";
import GameNotification from "../components/GameNotification";

/**
 * Severity levels for notifications
 * - error: Red background, for failures and critical issues
 * - warning: Yellow background, for cautions and reconnecting states
 * - info: Blue background, for informational messages
 * - success: Green background, for successful operations
 */
const SEVERITY_STYLES = {
  error: {
    backgroundColor: "#dc2626",
    icon: "❌",
  },
  warning: {
    backgroundColor: "#f59e0b",
    icon: "⚠️",
  },
  info: {
    backgroundColor: "#3b82f6",
    icon: "ℹ️",
  },
  success: {
    backgroundColor: "#10b981",
    icon: "✓",
  },
};

const ErrorNotificationContext = createContext(null);

export function ErrorNotificationProvider({ children }) {
  const [notification, setNotification] = useState(null);

  /**
   * Show a notification with automatic dismiss
   * @param {string} message - The message to display
   * @param {string} severity - One of: 'error', 'warning', 'info', 'success'
   * @param {number} duration - How long to show (ms), default 2500
   */
  const showNotification = useCallback((message, severity = "error", duration = 2500) => {
    if (!message) return;
    
    setNotification({
      message,
      severity,
      duration,
      key: Date.now(), // Force re-render for same message
    });
  }, []);

  /**
   * Convenience methods for different severity levels
   */
  const showError = useCallback((message, duration) => {
    showNotification(message, "error", duration);
  }, [showNotification]);

  const showWarning = useCallback((message, duration) => {
    showNotification(message, "warning", duration);
  }, [showNotification]);

  const showInfo = useCallback((message, duration) => {
    showNotification(message, "info", duration);
  }, [showNotification]);

  const showSuccess = useCallback((message, duration) => {
    showNotification(message, "success", duration);
  }, [showNotification]);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const value = {
    showNotification,
    showError,
    showWarning,
    showInfo,
    showSuccess,
    dismissNotification,
  };

  return (
    <ErrorNotificationContext.Provider value={value}>
      {children}
      {notification && (
        <GameNotification
          key={notification.key}
          message={notification.message}
          severity={notification.severity}
          duration={notification.duration}
          onDismiss={dismissNotification}
          style={SEVERITY_STYLES[notification.severity]}
        />
      )}
    </ErrorNotificationContext.Provider>
  );
}

/**
 * Hook to access error notification system
 * @returns {object} Notification methods
 */
export function useErrorNotification() {
  const context = useContext(ErrorNotificationContext);
  if (!context) {
    throw new Error("useErrorNotification must be used within ErrorNotificationProvider");
  }
  return context;
}
