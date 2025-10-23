import React, { createContext, useContext, useState, useCallback } from "react";
import GameNotification from "../components/GameNotification";

const NOTIFICATION_DURATION = 1500; // default auto-dismiss in ms

const ErrorNotificationContext = createContext(null);

export function ErrorNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  /**
   * Show a notification with automatic dismiss
   * @param {string} message - The message to display
   * @param {string} severity - One of: 'error', 'warning', 'info', 'success'
   * @returns {string} The notification ID
   */
  const showNotification = useCallback((message, severity = "info", options = {}) => {
    if (!message) return null;
    const { duration } = options;
    const id = crypto.randomUUID();
    setNotifications((prev) => [
      ...prev,
      {
        id,
        message,
        severity,
        duration:
          typeof duration === "number" && duration > 0
            ? duration
            : NOTIFICATION_DURATION,
      },
    ]);
    return id;
  }, []);

  /**
   * Dismiss a specific notification by ID
   * @param {string} id - The notification ID to dismiss
   */
  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    showNotification,
    dismissNotification,
    clearNotifications,
  };

  return (
    <ErrorNotificationContext.Provider value={value}>
      {children}
      <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {notifications.map((notification) => (
          <GameNotification
            key={notification.id}
            message={notification.message}
            severity={notification.severity}
            duration={notification.duration ?? NOTIFICATION_DURATION}
            onDismiss={() => dismissNotification(notification.id)}
          />
        ))}
      </div>
    </ErrorNotificationContext.Provider>
  );
}

/**
 * Hook to access error notification system
 * @returns {object} Notification methods: { showNotification, dismissNotification, clearNotifications }
 */
export function useErrorNotification() {
  const context = useContext(ErrorNotificationContext);
  if (!context) {
    throw new Error("useErrorNotification must be used within ErrorNotificationProvider");
  }
  return context;
}
