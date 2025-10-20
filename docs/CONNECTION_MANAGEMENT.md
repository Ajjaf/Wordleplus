# Connection Management Guide

## Overview

WordlePlus uses Socket.IO for real-time multiplayer communication. The connection management system ensures users stay connected, can rejoin disconnected sessions, and receive clear feedback about connection status.

## Components

### 1. Socket.IO Client Setup

**File**: `client/src/socket.js`

The Socket.IO client connects to the backend server:

```javascript
import { io } from "socket.io-client";

// Development: localhost:8080
// Production: hosted backend URL
export const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:8080", {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});
```

**Key Configuration:**
- `autoConnect: true` - Automatically connect on page load
- `reconnection: true` - Auto-reconnect on disconnect
- `reconnectionDelay: 1000` - Wait 1 second between reconnection attempts
- `reconnectionAttempts: Infinity` - Keep trying forever

### 2. useSocketConnection Hook

**File**: `client/src/hooks/useSocketConnection.js`

This custom hook manages all connection logic, including:
- Connection state tracking
- Automatic reconnection
- Session resumption
- Rejoin offers

#### Key Features

##### State Management

```javascript
const [connected, setConnected] = useState(socket.connected);
const [rejoinOffered, setRejoinOffered] = useState(false);
```

##### LocalStorage Keys

```javascript
const LS_ROOM = "wp.lastRoomId";          // Last room ID user was in
const LS_SOCKET = "wp.lastSocketId";      // Current socket ID
const LS_LAST_NAME = "wp.lastName";       // User's name
```

##### Connection Events

###### On Connect
```javascript
const onConnect = () => {
  setConnected(true);
  
  // Show success notification if recovering from disconnect
  if (hasShownDisconnectRef.current) {
    showNotification("Reconnected to server", "success");
    hasShownDisconnectRef.current = false;
  }
  
  // If already in a room, store socket ID and done
  if (room?.id) {
    localStorage.setItem(LS_SOCKET, socket.id);
    return;
  }
  
  // Try to resume previous session
  const oldId = localStorage.getItem(LS_SOCKET + ".old");
  
  if (!triedResumeRef.current && savedRoomId && oldId) {
    triedResumeRef.current = true;
    
    socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
      if (res?.ok) {
        // Successfully resumed - update socket ID
        localStorage.setItem(LS_SOCKET, socket.id);
        localStorage.removeItem(LS_SOCKET + ".old");
        sessionStorage.setItem("wp.reconnected", "1");
        setScreen?.("game");
      } else {
        // Resume failed - offer manual rejoin
        setRejoinOffered(Boolean(savedRoomId && savedName));
      }
    });
  } else {
    // No resume attempt needed - offer rejoin if data exists
    setRejoinOffered(Boolean(savedRoomId && savedName && !room?.id));
  }
};
```

###### On Disconnect
```javascript
const onDisconnect = () => {
  const last = localStorage.getItem(LS_SOCKET);
  
  // Save old socket ID for resume attempt
  if (last) {
    localStorage.setItem(LS_SOCKET + ".old", last);
  }
  
  setConnected(false);
  hasShownDisconnectRef.current = true;
  showNotification("Connection lost - Reconnecting...", "warning");
  
  // Allow new resume attempt on next connect
  triedResumeRef.current = false;
};
```

###### On Connection Error
```javascript
const onConnectError = (error) => {
  console.error("Socket connection error:", error);
  showNotification("Connection error - Please check your network", "error");
};
```

##### Rejoin Logic

```javascript
const doRejoin = () => {
  if (!savedRoomId || !savedName) return;
  
  const oldId = localStorage.getItem(LS_SOCKET + ".old");
  
  // Try resume first (preserves game state)
  if (oldId) {
    socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
      if (res?.ok) {
        localStorage.setItem(LS_SOCKET, socket.id);
        localStorage.removeItem(LS_SOCKET + ".old");
        sessionStorage.setItem("wp.reconnected", "1");
        setScreen?.("game");
        setRejoinOffered(false);
      } else {
        // Fallback to regular join
        socket.emit("joinRoom", { name: savedName, roomId: savedRoomId }, (res2) => {
          if (res2?.ok) {
            localStorage.setItem(LS_SOCKET, socket.id);
            localStorage.removeItem(LS_SOCKET + ".old");
            setScreen?.("game");
            setRejoinOffered(false);
          }
        });
      }
    });
  } else {
    // No old socket ID - just rejoin
    socket.emit("joinRoom", { name: savedName, roomId: savedRoomId }, (res) => {
      if (res?.ok) {
        localStorage.setItem(LS_SOCKET, socket.id);
        setScreen?.("game");
        setRejoinOffered(false);
      }
    });
  }
};
```

### 3. ConnectionBar Component

**File**: `client/src/components/ConnectionBar.jsx`

Visual indicator showing connection status to the user.

#### States

##### 1. Disconnected
```jsx
if (!connected) {
  return (
    <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 px-3 rounded mb-3">
      Connection lost — trying to reconnect…
    </div>
  );
}
```

##### 2. Can Rejoin
```jsx
if (canRejoin) {
  return (
    <div className="w-full bg-blue-50 text-blue-900 text-sm py-2 px-3 rounded mb-3 flex items-center justify-between">
      <span>
        You were in room <b>{savedRoomId}</b>. Rejoin?
      </span>
      <Button size="sm" onClick={onRejoin}>
        Rejoin
      </Button>
    </div>
  );
}
```

##### 3. Connected (Normal State)
```jsx
return null; // Show nothing when everything is normal
```

## Connection Flow Diagrams

### Normal Connection Flow
```
Page Load
    ↓
Socket.IO Auto-Connect
    ↓
onConnect() fires
    ↓
Save socket.id to localStorage
    ↓
User joins room
    ↓
Save room ID and name to localStorage
    ↓
Connected and playing
```

### Disconnect and Reconnect Flow
```
Playing in room
    ↓
Network disconnects
    ↓
onDisconnect() fires
    ↓
Save socket.id as socket.id.old
    ↓
Show "Connection lost" notification (yellow)
    ↓
Socket.IO auto-reconnects
    ↓
onConnect() fires
    ↓
Get new socket.id
    ↓
Emit "resume" with old socket.id
    ↓
Backend verifies and restores session
    ↓
Show "Reconnected" notification (green)
    ↓
Continue playing
```

### Failed Resume Flow
```
onConnect() fires
    ↓
Emit "resume" with old socket.id
    ↓
Backend responds with {ok: false}
    ↓
Set rejoinOffered = true
    ↓
ConnectionBar shows "Rejoin?" button
    ↓
User clicks "Rejoin"
    ↓
Emit "joinRoom" (fresh join)
    ↓
Backend creates new player in room
    ↓
User back in game (new state)
```

## Backend Resume Handler

**File**: `server/index.js`

The backend needs to handle the resume event:

```javascript
socket.on("resume", ({ roomId, oldId }, callback) => {
  const room = rooms.get(roomId);
  
  if (!room) {
    callback({ ok: false, error: "Room not found" });
    return;
  }
  
  // Find player with old socket ID
  const player = room.players.find(p => p.socketId === oldId);
  
  if (!player) {
    callback({ ok: false, error: "Player not found" });
    return;
  }
  
  // Update to new socket ID
  player.socketId = socket.id;
  socket.join(roomId);
  
  // Emit current room state to reconnected player
  socket.emit("room", room);
  
  callback({ ok: true });
});
```

## Session Persistence

### What Gets Saved

**localStorage:**
- `wp.lastRoomId` - Room code user was in
- `wp.lastSocketId` - Current socket ID
- `wp.lastName` - User's display name
- `wp.lastSocketId.old` - Previous socket ID (for resume)

**sessionStorage:**
- `wp.reconnected` - Flag showing reconnection banner (1-time)

### Cleanup

**On successful room join:**
```javascript
localStorage.setItem("wp.lastRoomId", roomId);
localStorage.setItem("wp.lastName", name);
localStorage.setItem("wp.lastSocketId", socket.id);
```

**On leaving room:**
```javascript
localStorage.removeItem("wp.lastRoomId");
localStorage.removeItem("wp.lastName");
localStorage.removeItem("wp.lastSocketId");
localStorage.removeItem("wp.lastSocketId.old");
```

**On successful resume:**
```javascript
localStorage.setItem("wp.lastSocketId", socket.id);
localStorage.removeItem("wp.lastSocketId.old");
sessionStorage.setItem("wp.reconnected", "1");
```

## Preventing Duplicate Notifications

### Problem
On page refresh or rapid disconnect/reconnect, notifications can fire multiple times.

### Solution
Use refs to track state:

```javascript
const hasShownDisconnectRef = useRef(false);

// On disconnect
hasShownDisconnectRef.current = true;
showNotification("Connection lost", "warning");

// On reconnect - only show if we previously disconnected
if (hasShownDisconnectRef.current) {
  showNotification("Reconnected", "success");
  hasShownDisconnectRef.current = false;
}
```

### Resume Attempt Limiter

Prevent multiple resume attempts in React StrictMode:

```javascript
const triedResumeRef = useRef(false);

if (!triedResumeRef.current && savedRoomId && oldId) {
  triedResumeRef.current = true;
  socket.emit("resume", ...);
}

// Reset on disconnect
onDisconnect: () => {
  triedResumeRef.current = false;
}
```

## Testing Connection Scenarios

### 1. Normal Disconnect/Reconnect
1. Join a room
2. Open DevTools Network tab
3. Set throttling to "Offline"
4. Wait 2 seconds
5. Set back to "No throttling"
6. **Expected**: Yellow warning → Green success notification

### 2. Page Refresh
1. Join a room
2. Refresh page (F5)
3. **Expected**: Automatic resume, no rejoin prompt needed

### 3. Browser Tab Close/Reopen
1. Join a room
2. Close browser tab
3. Open new tab with same URL
4. **Expected**: "Rejoin?" prompt appears with room code

### 4. Long Disconnect (30+ minutes)
1. Join a room
2. Close laptop / sleep computer for 30+ minutes
3. Wake up and reconnect
4. **Expected**: Resume fails, "Rejoin?" prompt appears

### 5. Server Restart
1. Join a room
2. Restart backend server
3. Wait for reconnection
4. **Expected**: Resume fails (server lost state), "Rejoin?" prompt appears

## Configuration Options

### Reconnection Delay

Adjust how long to wait between reconnection attempts:

```javascript
const socket = io(url, {
  reconnectionDelay: 2000, // Wait 2 seconds (default: 1 second)
  reconnectionDelayMax: 10000, // Max 10 seconds
});
```

### Timeout Duration

Set how long to wait for server response:

```javascript
const socket = io(url, {
  timeout: 20000, // 20 seconds (default: 20000)
});
```

### Disable Auto-Connect

For testing, you can disable auto-connect:

```javascript
const socket = io(url, {
  autoConnect: false
});

// Manually connect later
socket.connect();
```

## Troubleshooting

### Issue: Reconnect Loop

**Symptoms**: Constant disconnect/reconnect cycle

**Possible Causes:**
1. CORS issues (check browser console)
2. Backend not running
3. Firewall blocking WebSocket connections

**Debug:**
```javascript
socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("Disconnected:", reason));
socket.on("connect_error", (error) => console.error("Error:", error));
```

### Issue: Resume Always Fails

**Symptoms**: Always see "Rejoin?" prompt, never auto-resumes

**Possible Causes:**
1. Backend doesn't implement resume handler
2. Player evicted from room (timeout)
3. Room was closed

**Fix:**
Check backend logs for resume event handling.

### Issue: Multiple Rejoin Prompts

**Symptoms**: "Rejoin?" appears multiple times

**Possible Causes:**
1. React StrictMode double-rendering
2. Multiple useEffect calls

**Fix:**
Use triedResumeRef to prevent duplicate attempts (already implemented).

### Issue: Old Notifications Persist

**Symptoms**: "Connection lost" notification doesn't clear

**Possible Causes:**
1. Notification not auto-dismissing
2. Multiple notifications stacking

**Fix:**
```javascript
// Clear all notifications on successful reconnect
clearNotifications();
showNotification("Reconnected", "success");
```

## Best Practices

### 1. Always Clean Up Listeners

```javascript
useEffect(() => {
  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  
  return () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
  };
}, []);
```

### 2. Save Room State Immediately

```javascript
// As soon as user joins
socket.emit("joinRoom", { name, roomId }, (response) => {
  if (response.ok) {
    localStorage.setItem("wp.lastRoomId", roomId);
    localStorage.setItem("wp.lastName", name);
    localStorage.setItem("wp.lastSocketId", socket.id);
  }
});
```

### 3. Clear State on Intentional Leave

```javascript
const leaveRoom = () => {
  socket.emit("leaveRoom");
  localStorage.removeItem("wp.lastRoomId");
  localStorage.removeItem("wp.lastName");
  localStorage.removeItem("wp.lastSocketId");
  localStorage.removeItem("wp.lastSocketId.old");
};
```

### 4. Handle Backend Errors Gracefully

```javascript
socket.emit("resume", data, (response) => {
  if (!response || !response.ok) {
    // Don't crash - just offer rejoin
    setRejoinOffered(true);
  }
});
```

## Summary

The connection management system:
- ✅ Auto-reconnects on disconnect
- ✅ Resumes sessions when possible
- ✅ Offers manual rejoin when resume fails
- ✅ Shows clear status notifications
- ✅ Persists room data across refreshes
- ✅ Handles backend restarts gracefully
- ✅ Prevents duplicate notifications
- ✅ Works on mobile devices

For more details, see:
- `ERROR_HANDLING_GUIDE.md` - Overall error handling system
- `NOTIFICATION_SYSTEM.md` - Notification implementation details
