# Error Handling System Guide

## Overview
WordlePlus now has a comprehensive, user-friendly error notification system that provides real-time feedback for connection issues, game errors, and validation problems. All errors appear as **transient pop-up notifications** that auto-dismiss, preventing layout shifts and maintaining a smooth user experience.

## System Architecture

### 1. Error Notification Provider
Located in `client/src/contexts/ErrorNotificationContext.jsx`

The ErrorNotificationProvider wraps your entire application and provides centralized error management throughout the app.

**Key Features:**
- **Severity Levels**: error (red), warning (yellow), info (blue), success (green)
- **Auto-dismissal**: Notifications auto-dismiss after 1.5 seconds (adjustable)
- **Stacking**: Multiple notifications can appear simultaneously
- **Accessibility**: ARIA labels and screen reader support

### 2. GameNotification Component
Located in `client/src/components/GameNotification.jsx`

A reusable component that displays transient tooltip-style notifications with:
- Color-coded severity indicators
- Smooth fade-in/fade-out animations
- Absolute positioning to prevent layout shifts
- Mobile-friendly design (48px minimum touch targets on mobile)

### 3. Connection Management
Located in `client/src/hooks/useSocketConnection.js`

Automatically monitors Socket.IO connection status and shows notifications for:
- **Connection Lost**: Yellow warning notification
- **Reconnected**: Green success notification
- **Connection Error**: Red error notification

## How to Use

### Basic Usage in Any Component

```javascript
import { useErrorNotification } from "../contexts/ErrorNotificationContext";

function MyComponent() {
  const { showNotification } = useErrorNotification();
  
  const handleAction = async () => {
    try {
      // Your code here
      await someAsyncOperation();
      showNotification("Success!", "success");
    } catch (error) {
      showNotification(error.message || "Something went wrong", "error");
    }
  };
  
  return <button onClick={handleAction}>Do Something</button>;
}
```

### Notification Severity Levels

```javascript
// Error (red) - for critical failures
showNotification("Failed to join room", "error");

// Warning (yellow) - for non-critical issues
showNotification("Connection lost - Reconnecting...", "warning");

// Info (blue) - for informational messages
showNotification("Room code copied to clipboard", "info");

// Success (green) - for successful operations
showNotification("Reconnected to server", "success");
```

### Real-World Examples

#### 1. Form Validation
```javascript
const handleSubmit = () => {
  if (!name.trim()) {
    showNotification("Please enter your name", "warning");
    return;
  }
  
  if (!roomCode.trim()) {
    showNotification("Please enter a room code", "warning");
    return;
  }
  
  joinRoom(name, roomCode);
};
```

#### 2. API Error Handling
```javascript
const submitGuess = async (word) => {
  try {
    const response = await fetch("/api/daily/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word })
    });
    
    if (!response.ok) {
      const error = await response.json();
      showNotification(error.message, "error");
      return;
    }
    
    const data = await response.json();
    // Process successful response
    
  } catch (error) {
    showNotification("Network error - please check your connection", "error");
  }
};
```

#### 3. Socket.IO Event Handling
```javascript
useEffect(() => {
  socket.on("error", (error) => {
    showNotification(error.message || "Game error occurred", "error");
  });
  
  socket.on("roomClosed", () => {
    showNotification("Room has been closed by the host", "warning");
    // Navigate back to home screen
  });
  
  return () => {
    socket.off("error");
    socket.off("roomClosed");
  };
}, [showNotification]);
```

## Connection Status System

### Automatic Connection Monitoring

The `useSocketConnection` hook automatically monitors your connection and shows notifications:

```javascript
// In your App component (already implemented)
const {
  connected,
  canRejoin,
  doRejoin,
  savedRoomId
} = useSocketConnection(room, setScreen);
```

**What it does:**
1. **On Disconnect**: Shows yellow warning "Connection lost - Reconnecting..."
2. **On Reconnect**: Shows green success "Reconnected to server"
3. **On Error**: Shows red error "Connection error - Please check your network"

### ConnectionBar Component

The ConnectionBar component (in `client/src/components/ConnectionBar.jsx`) provides visual feedback for connection status in the UI:

```javascript
<ConnectionBar
  connected={connected}
  canRejoin={canRejoin}
  onRejoin={doRejoin}
  savedRoomId={savedRoomId}
/>
```

**Displays:**
- Yellow banner when disconnected: "Connection lost — trying to reconnect…"
- Blue banner when can rejoin: "You were in room XYZ. Rejoin?" with button
- Nothing when connected

## Best Practices

### 1. Use Appropriate Severity Levels
- **error**: Operation failed and user can't continue
- **warning**: Issue occurred but user can still proceed
- **info**: Neutral information (clipboard copy, etc.)
- **success**: Operation completed successfully

### 2. Keep Messages Short and Clear
```javascript
// Good
showNotification("Not in word list", "error");
showNotification("Room code copied", "success");

// Too verbose
showNotification("The word you entered is not in our dictionary. Please try again with a valid 5-letter word.", "error");
```

### 3. Don't Show Notifications for Expected User Actions
```javascript
// Bad - too noisy
const handleKeyPress = (key) => {
  if (key === "Enter") {
    showNotification("Submitting guess...", "info"); // Don't do this
    submitGuess();
  }
};

// Good - only show on errors
const handleKeyPress = (key) => {
  if (key === "Enter") {
    const error = validateGuess(currentGuess);
    if (error) {
      showNotification(error, "error");
      return;
    }
    submitGuess();
  }
};
```

### 4. Handle Network Errors Gracefully
```javascript
try {
  const response = await fetch("/api/endpoint");
  // ... handle response
} catch (error) {
  // Network errors (offline, timeout, etc.)
  if (error instanceof TypeError && error.message.includes("fetch")) {
    showNotification("No internet connection", "error");
  } else {
    showNotification("An error occurred. Please try again.", "error");
  }
}
```

## Customization

### Adjust Auto-Dismiss Duration

In `ErrorNotificationContext.jsx`, modify the `NOTIFICATION_DURATION`:

```javascript
const NOTIFICATION_DURATION = 1500; // milliseconds (default: 1.5 seconds)

// For longer messages, increase duration
const NOTIFICATION_DURATION = 3000; // 3 seconds
```

### Add Custom Notification Types

Extend the `GameNotification` component to support additional severity types:

```javascript
// In GameNotification.jsx
const severityStyles = {
  error: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
  // Add your custom type
  critical: "bg-purple-600 text-white border-4 border-purple-900"
};
```

## Troubleshooting

### Notifications Not Appearing

**Problem**: `showNotification` is undefined or notifications don't show

**Solution**: Ensure your component is wrapped by ErrorNotificationProvider

```javascript
// In main.jsx (already implemented)
import { ErrorNotificationProvider } from "./contexts/ErrorNotificationContext.jsx";

createRoot(document.getElementById("root")).render(
  <ErrorNotificationProvider>
    <App />
  </ErrorNotificationProvider>
);
```

### Notifications Stack Too Much

**Problem**: Too many notifications appear at once

**Solution**: Debounce rapid notifications or clear previous ones:

```javascript
const { showNotification, clearNotifications } = useErrorNotification();

// Clear all before showing new one
clearNotifications();
showNotification("New message", "info");
```

### Connection Notifications Show Too Often

**Problem**: Disconnect/reconnect notifications appear during normal page navigation

**Solution**: The system uses `hasShownDisconnectRef` to prevent duplicate notifications. If this still occurs, add a debounce delay in `useSocketConnection.js`.

## Migration Guide

### Converting Inline Errors to Notifications

**Before:**
```javascript
const [errorMessage, setErrorMessage] = useState("");

return (
  <div>
    {errorMessage && (
      <div className="text-red-500">{errorMessage}</div>
    )}
    <button onClick={() => {
      if (!valid) {
        setErrorMessage("Invalid input");
        return;
      }
    }}>Submit</button>
  </div>
);
```

**After:**
```javascript
const { showNotification } = useErrorNotification();

return (
  <div>
    <button onClick={() => {
      if (!valid) {
        showNotification("Invalid input", "error");
        return;
      }
    }}>Submit</button>
  </div>
);
```

**Benefits:**
- No layout shift (notification is absolutely positioned)
- Auto-dismisses (no manual state management)
- Consistent styling across the app
- Better mobile UX

## Testing

### Manual Testing Checklist

- [ ] Disconnect WiFi → Yellow "Connection lost" notification appears
- [ ] Reconnect WiFi → Green "Reconnected" notification appears
- [ ] Submit invalid guess → Red error notification appears
- [ ] Multiple rapid errors → Notifications stack properly
- [ ] Mobile view → Notifications are readable and touch-friendly
- [ ] Accessibility → Screen reader announces notifications

### Unit Testing (Future)

```javascript
import { render, screen } from "@testing-library/react";
import { ErrorNotificationProvider, useErrorNotification } from "./ErrorNotificationContext";

test("shows notification with correct severity", () => {
  const TestComponent = () => {
    const { showNotification } = useErrorNotification();
    return <button onClick={() => showNotification("Test", "error")}>Show</button>;
  };
  
  render(
    <ErrorNotificationProvider>
      <TestComponent />
    </ErrorNotificationProvider>
  );
  
  fireEvent.click(screen.getByText("Show"));
  expect(screen.getByText("Test")).toHaveClass("bg-red-500");
});
```

## Summary

The error notification system provides:
- ✅ Consistent, user-friendly error feedback
- ✅ Automatic connection status monitoring
- ✅ No layout shifts (transient pop-ups)
- ✅ Mobile-optimized design
- ✅ Accessible (ARIA labels, screen readers)
- ✅ Easy to use (`showNotification` hook)
- ✅ Customizable severity levels

For more details, see:
- `NOTIFICATION_SYSTEM.md` - Deep dive into notification mechanics
- `CONNECTION_MANAGEMENT.md` - Connection status implementation details
