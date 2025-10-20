import React, { useEffect, useState } from "react";

/**
 * Transient notification that appears near the top of the game grid
 * Auto-dismisses after a short delay
 * Supports severity levels with color coding: error (red), warning (yellow), info (blue), success (green)
 */
export default function GameNotification({ 
  message, 
  duration = 1000, 
  onDismiss, 
  severity = "info",
  style = {} 
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!message) return;

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        // Wait for fade-out animation before calling onDismiss
        setTimeout(onDismiss, 200);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message || !isVisible) return null;

  // Default background color if not provided in style
  const backgroundColor = style.backgroundColor || "#1e293b";
  const icon = style.icon || "";

  return (
    <>
      <style>
        {`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: translateX(-50%) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) scale(1);
            }
          }
          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
          .game-notification {
            animation: fadeInScale 200ms ease-out;
          }
          .game-notification.fade-out {
            animation: fadeOut 200ms ease-in;
          }
        `}
      </style>
      <div
        className={`game-notification ${!isVisible ? "fade-out" : ""}`}
        style={{
          position: "absolute",
          top: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            whiteSpace: "nowrap",
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {icon && <span style={{ fontSize: "16px" }}>{icon}</span>}
          <span>{message}</span>
        </div>
      </div>
    </>
  );
}
