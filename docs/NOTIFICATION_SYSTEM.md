# Notification System Technical Documentation

## Architecture Overview

The notification system in WordlePlus consists of three main components that work together to provide seamless, non-intrusive user feedback.

## Components

### 1. ErrorNotificationContext

**File**: `client/src/contexts/ErrorNotificationContext.jsx`

**Purpose**: Centralized state management for notifications across the entire application.

#### Key Features

```javascript
// Core state structure
{
  notifications: [
    {
      id: "unique-uuid",
      message: "Connection lost",
      severity: "warning"
    }
  ]
}
```

#### API Methods

##### `showNotification(message, severity = "info")`
Displays a new notification.

**Parameters:**
- `message` (string): The text to display
- `severity` (string): "error" | "warning" | "info" | "success"

**Returns:** The notification ID (for manual dismissal)

**Example:**
```javascript
const id = showNotification("Game saved!", "success");
```

##### `dismissNotification(id)`
Manually dismisses a notification by ID.

**Parameters:**
- `id` (string): The notification ID returned by `showNotification`

**Example:**
```javascript
const id = showNotification("Processing...", "info");
// Later...
dismissNotification(id);
```

##### `clearNotifications()`
Removes all active notifications.

**Example:**
```javascript
clearNotifications(); // Clear all
showNotification("Fresh start!", "info");
```

#### Implementation Details

**Auto-dismissal Timer:**
```javascript
const NOTIFICATION_DURATION = 1500; // 1.5 seconds

useEffect(() => {
  const timer = setTimeout(() => {
    dismissNotification(notification.id);
  }, NOTIFICATION_DURATION);
  
  return () => clearTimeout(timer);
}, [notification.id]);
```

**Notification Stacking:**
Notifications are rendered in a stack at the top-center of the screen. New notifications appear above older ones.

**UUID Generation:**
Each notification gets a unique ID using `crypto.randomUUID()`:
```javascript
const id = crypto.randomUUID();
```

### 2. GameNotification Component

**File**: `client/src/components/GameNotification.jsx`

**Purpose**: Visual representation of a single notification.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `message` | string | The notification text |
| `severity` | string | "error", "warning", "info", "success" |
| `onDismiss` | function | Callback when notification is dismissed |

#### Styling

**Color Scheme:**
```javascript
const severityStyles = {
  error: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white"
};
```

**Positioning:**
```javascript
// Absolutely positioned to prevent layout shifts
className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50"
```

**Responsive Design:**
```javascript
// Mobile: 90% width, tablet: 400px max
className="w-11/12 sm:w-96"

// Touch-friendly minimum height on mobile
className="min-h-[48px] sm:min-h-[40px]"
```

**Animation:**
```javascript
// CSS animations defined in index.css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOutDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

#### Accessibility

**ARIA Labels:**
```jsx
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  {message}
</div>
```

**Keyboard Support:**
- Auto-dismisses after timeout
- Can be dismissed programmatically
- Screen reader announces immediately

### 3. useErrorNotification Hook

**File**: `client/src/contexts/ErrorNotificationContext.jsx`

**Purpose**: Convenient hook to access notification methods in any component.

#### Usage

```javascript
import { useErrorNotification } from "../contexts/ErrorNotificationContext";

function MyComponent() {
  const { showNotification, dismissNotification, clearNotifications } = useErrorNotification();
  
  return (
    <button onClick={() => showNotification("Clicked!", "success")}>
      Click Me
    </button>
  );
}
```

#### Error Handling

If used outside of ErrorNotificationProvider:
```javascript
if (!context) {
  throw new Error("useErrorNotification must be used within ErrorNotificationProvider");
}
```

## Integration with Socket.IO

**File**: `client/src/hooks/useSocketConnection.js`

The notification system is integrated with Socket.IO for automatic connection status feedback.

### Connection Events

#### 1. Connect Event
```javascript
socket.on("connect", () => {
  setConnected(true);
  
  if (hasShownDisconnectRef.current) {
    showNotification("Reconnected to server", "success");
    hasShownDisconnectRef.current = false;
  }
});
```

#### 2. Disconnect Event
```javascript
socket.on("disconnect", () => {
  setConnected(false);
  hasShownDisconnectRef.current = true;
  showNotification("Connection lost - Reconnecting...", "warning");
});
```

#### 3. Connection Error Event
```javascript
socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
  showNotification("Connection error - Please check your network", "error");
});
```

### Preventing Duplicate Notifications

**Problem**: On page refresh or navigation, disconnect/reconnect can fire rapidly.

**Solution**: Use a ref to track disconnect state:

```javascript
const hasShownDisconnectRef = useRef(false);

// Only show reconnect notification if we previously disconnected
if (hasShownDisconnectRef.current) {
  showNotification("Reconnected to server", "success");
  hasShownDisconnectRef.current = false;
}
```

## Data Flow

```
User Action or Event
       ↓
useErrorNotification.showNotification("message", "severity")
       ↓
ErrorNotificationContext adds notification to state
       ↓
GameNotification component renders with notification data
       ↓
Auto-dismiss timer starts (1.5 seconds)
       ↓
ErrorNotificationContext removes notification from state
       ↓
GameNotification unmounts (fade-out animation)
```

## Performance Considerations

### 1. Notification Limit

To prevent memory issues from too many notifications:

```javascript
const MAX_NOTIFICATIONS = 5;

const showNotification = (message, severity = "info") => {
  const id = crypto.randomUUID();
  
  setNotifications(prev => {
    const newNotifications = [...prev, { id, message, severity }];
    
    // Keep only the most recent MAX_NOTIFICATIONS
    if (newNotifications.length > MAX_NOTIFICATIONS) {
      return newNotifications.slice(-MAX_NOTIFICATIONS);
    }
    
    return newNotifications;
  });
  
  return id;
};
```

### 2. Debouncing Rapid Notifications

For scenarios where many errors might fire rapidly:

```javascript
import { debounce } from "lodash"; // or implement your own

const debouncedNotification = debounce((message, severity) => {
  showNotification(message, severity);
}, 300); // 300ms debounce

// Usage
debouncedNotification("Error occurred", "error");
```

### 3. Memory Cleanup

All notification timers are properly cleaned up:

```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    dismissNotification(notification.id);
  }, NOTIFICATION_DURATION);
  
  // Cleanup on unmount
  return () => clearTimeout(timer);
}, [notification.id, dismissNotification]);
```

## Common Patterns

### 1. API Error Handler

```javascript
const handleApiError = (error, defaultMessage = "An error occurred") => {
  const { showNotification } = useErrorNotification();
  
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.message || defaultMessage;
    showNotification(message, "error");
  } else if (error.request) {
    // Request made but no response
    showNotification("No response from server", "error");
  } else {
    // Something else happened
    showNotification(error.message || defaultMessage, "error");
  }
};
```

### 2. Form Validation

```javascript
const validateForm = (formData) => {
  const { showNotification } = useErrorNotification();
  const errors = [];
  
  if (!formData.name) errors.push("Name is required");
  if (!formData.email) errors.push("Email is required");
  if (formData.email && !isValidEmail(formData.email)) {
    errors.push("Invalid email format");
  }
  
  if (errors.length > 0) {
    errors.forEach(error => showNotification(error, "warning"));
    return false;
  }
  
  return true;
};
```

### 3. Success Confirmation

```javascript
const handleSave = async () => {
  const { showNotification } = useErrorNotification();
  
  try {
    await saveData();
    showNotification("Saved successfully!", "success");
  } catch (error) {
    showNotification("Failed to save", "error");
  }
};
```

## Styling Customization

### Custom Colors

Add new severity types in `GameNotification.jsx`:

```javascript
const severityStyles = {
  error: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
  critical: "bg-purple-600 text-white border-4 border-purple-900",
  debug: "bg-gray-700 text-gray-100"
};
```

### Custom Animations

Modify animations in `index.css`:

```css
@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.notification-enter {
  animation: bounceIn 0.3s ease-out;
}
```

### Positioning Options

Change notification position:

```javascript
// Top-right
className="absolute top-4 right-4 z-50"

// Bottom-center
className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50"

// Top-left
className="absolute top-4 left-4 z-50"
```

## Testing

### Component Testing

```javascript
import { render, screen, waitFor } from "@testing-library/react";
import { ErrorNotificationProvider, useErrorNotification } from "./ErrorNotificationContext";

describe("Notification System", () => {
  test("displays notification", () => {
    const TestComponent = () => {
      const { showNotification } = useErrorNotification();
      
      return (
        <button onClick={() => showNotification("Test message", "info")}>
          Show
        </button>
      );
    };
    
    render(
      <ErrorNotificationProvider>
        <TestComponent />
      </ErrorNotificationProvider>
    );
    
    fireEvent.click(screen.getByText("Show"));
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });
  
  test("auto-dismisses after timeout", async () => {
    const TestComponent = () => {
      const { showNotification } = useErrorNotification();
      
      useEffect(() => {
        showNotification("Auto dismiss", "info");
      }, []);
      
      return null;
    };
    
    render(
      <ErrorNotificationProvider>
        <TestComponent />
      </ErrorNotificationProvider>
    );
    
    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
```

## Troubleshooting

### Issue: Notifications Don't Stack Properly

**Cause**: Z-index conflict with other positioned elements.

**Fix**: Ensure notifications have highest z-index:
```javascript
className="z-[9999]"
```

### Issue: Notifications Overlap on Mobile

**Cause**: Insufficient spacing between stacked notifications.

**Fix**: Add margin to notification container:
```javascript
className="space-y-2" // 8px spacing between notifications
```

### Issue: Text Too Small on Mobile

**Cause**: Fixed font size doesn't scale well.

**Fix**: Use responsive text sizing:
```javascript
className="text-sm sm:text-base"
```

## Future Enhancements

Potential improvements to consider:

1. **Notification Actions**: Add buttons to notifications
   ```javascript
   showNotification({
     message: "File uploaded",
     severity: "success",
     actions: [
       { label: "View", onClick: () => navigate("/files") },
       { label: "Dismiss", onClick: () => dismiss() }
     ]
   });
   ```

2. **Notification Groups**: Group related notifications
   ```javascript
   showNotification({
     message: "3 new messages",
     severity: "info",
     group: "messages",
     count: 3
   });
   ```

3. **Persistent Notifications**: Option to not auto-dismiss
   ```javascript
   showNotification({
     message: "Important update available",
     severity: "warning",
     persistent: true
   });
   ```

4. **Sound Effects**: Add audio feedback
   ```javascript
   const playSound = (severity) => {
     const audio = new Audio(`/sounds/${severity}.mp3`);
     audio.play();
   };
   ```

## Summary

The notification system provides a robust, accessible, and mobile-friendly way to communicate with users. It:
- Prevents layout shifts with absolute positioning
- Auto-dismisses to avoid clutter
- Integrates seamlessly with Socket.IO for connection status
- Supports multiple severity levels
- Is fully accessible (ARIA, screen readers)
- Works great on mobile devices
