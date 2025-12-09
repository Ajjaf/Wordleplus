# Server-Side Rules & Guidelines

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4.19+
- **Real-time**: Socket.IO 4.7+
- **Database**: PostgreSQL with Prisma ORM 6.18+
- **Authentication**: OpenID Connect (OAuth) with Passport
- **Session**: Express Session with PostgreSQL store
- **Validation**: Custom validation functions

## Project Structure

```
server/
├── modes/           # Game mode modules
│   ├── duel.js
│   ├── battle.js
│   ├── shared.js
│   └── index.js    # Mode registry
├── prisma/         # Database schema and migrations
├── utils/          # Utility functions
├── admin/          # Admin endpoints
├── tests/          # Test files
├── scripts/        # Utility scripts
└── index.js        # Main server file
```

## Server Architecture

### Mode-Based Design

Each game mode is a self-contained module with:

- `init<Mode>Room(room, helpers)`: Initialize mode-specific state
- `canJoin<Mode>(room, options)`: Validate player can join
- `start<Mode>Round(context)`: Start a new round
- `handle<Mode>Guess(context)`: Process player guesses
- `reset<Mode>Round(room)`: Reset round state
- `sanitize<Mode>(room)`: Create client-safe room snapshot

### Room State Management

1. **Server is Source of Truth**: All game state lives on server
2. **Immutable Updates**: Create new objects when updating state
3. **Validation**: Validate all inputs before updating state
4. **Sanitization**: Sanitize data before sending to clients

### Socket.IO Patterns

```javascript
// Event handler pattern
io.on("connection", (socket) => {
  socket.on("joinRoom", async (data) => {
    try {
      const result = await handleJoinRoom(socket, data);
      socket.emit("joinRoomResult", result);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
});

// Room broadcasting
io.to(roomId).emit("roomUpdate", sanitizedRoom);
```

## Security Rules

### Input Validation

1. **Validate Everything**: Never trust client input
2. **Word Validation**: Always validate words against word list
3. **Length Checks**: Validate string lengths, array sizes
4. **Type Checks**: Validate data types before processing

```javascript
// Good: Validate input
function handleGuess(room, socketId, guess) {
  if (typeof guess !== "string" || guess.length !== 5) {
    return { error: "Invalid guess" };
  }
  if (!isValidWord(guess)) {
    return { error: "Not a valid word" };
  }
  // process guess
}
```

### Secret Management

1. **Never Expose Secrets**: Secret words only in `sanitize` functions
2. **Sanitization**: Always use `sanitize<Mode>` before sending room data
3. **Reveal Timing**: Only reveal secrets when game ends or round finishes
4. **Client Validation**: Client can validate format, but server validates existence

### Authentication & Authorization

1. **Session Validation**: Validate session on every request
2. **Player Verification**: Verify player is in room before actions
3. **Host Privileges**: Check host status for host-only actions
4. **Rate Limiting**: Implement rate limits on guess submissions

## Database Patterns

### Prisma Usage

1. **Schema First**: Define schema in `prisma/schema.prisma`
2. **Migrations**: Use migrations for schema changes
3. **Queries**: Use Prisma Client for all database operations
4. **Transactions**: Use transactions for multi-step operations

```javascript
// Good: Using Prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Transaction example
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { wins: { increment: 1 } } }),
  prisma.game.create({ data: { userId: id, result: "win" } }),
]);
```

### Data Models

1. **User Model**: Stores user authentication and stats
2. **Game Model**: Stores game history and results
3. **Session Model**: Stores session data (via connect-pg-simple)
4. **Relations**: Use Prisma relations for related data

## API Design

### REST Endpoints

1. **Naming**: Use RESTful naming conventions
2. **Status Codes**: Use appropriate HTTP status codes
3. **Error Responses**: Consistent error response format
4. **Validation**: Validate request body/params/query

```javascript
// Good: RESTful endpoint
app.post("/api/rooms/:roomId/guess", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { guess } = req.body;

    // Validate
    if (!guess || guess.length !== 5) {
      return res.status(400).json({ error: "Invalid guess" });
    }

    // Process
    const result = await processGuess(roomId, guess);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Error Handling

1. **Try-Catch**: Wrap async operations in try-catch
2. **Error Logging**: Log errors for debugging
3. **User Messages**: Return user-friendly error messages
4. **Status Codes**: Use appropriate HTTP status codes

```javascript
// Good: Error handling
try {
  const result = await processAction();
  return { ok: true, data: result };
} catch (error) {
  logger.error("Action failed:", error);
  return { error: "Action failed. Please try again." };
}
```

## Game Logic Rules

### Word Validation

1. **Word List**: Use `words.txt` and `allowed_guesses.txt`
2. **Validation**: Check word exists in word list
3. **Caching**: Cache word list in memory for performance
4. **Case Insensitive**: Normalize to uppercase for comparison

### Guess Scoring

1. **Pattern Generation**: Use `scoreGuess` function from `game.js`
2. **Pattern Format**: Return array of 'correct', 'present', 'absent'
3. **Consistency**: Same word + guess always produces same pattern
4. **Validation**: Validate pattern before storing

### Turn Management

1. **Turn Order**: Define turn order in mode logic
2. **Turn Validation**: Verify it's player's turn before processing
3. **Turn Updates**: Update turn state atomically
4. **Timeout Handling**: Handle turn timeouts appropriately

## Performance Guidelines

### Caching

1. **Word Lists**: Cache word lists in memory
2. **Room Data**: Cache room data when appropriate
3. **User Data**: Cache user stats for read-heavy operations
4. **Invalidation**: Invalidate cache on updates

### Database Queries

1. **Indexes**: Use database indexes for frequent queries
2. **Selective Fields**: Only select needed fields
3. **Batch Operations**: Use batch operations when possible
4. **Connection Pooling**: Configure connection pool appropriately

### Socket.IO Optimization

1. **Room Broadcasting**: Use room-based broadcasting
2. **Selective Updates**: Only send changed data
3. **Debouncing**: Debounce frequent updates
4. **Compression**: Enable Socket.IO compression

## Testing

### Unit Tests

1. **Game Logic**: Test all game logic functions
2. **Validation**: Test input validation
3. **State Management**: Test state transitions
4. **Edge Cases**: Test edge cases and error conditions

```javascript
// Test example
describe("handleDuelGuess", () => {
  it("should process valid guess", async () => {
    const room = createTestRoom();
    const result = await handleDuelGuess({
      room,
      socketId: "player1",
      guess: "HELLO",
      scoreGuess: mockScoreGuess,
    });
    expect(result.ok).toBe(true);
    expect(result.pattern).toBeDefined();
  });
});
```

### Integration Tests

1. **API Endpoints**: Test API endpoints
2. **Socket Events**: Test Socket.IO event handlers
3. **Database**: Test database operations
4. **Authentication**: Test auth flows

## Common Patterns

### Room Creation

```javascript
function createRoom(mode, hostId) {
  const room = {
    id: generateRoomId(),
    mode: normalizeMode(mode),
    hostId,
    players: {},
    started: false,
    // mode-specific state initialized by init<Mode>Room
  };
  initModeRoom(room, helpers);
  return room;
}
```

### Player Management

```javascript
function addPlayer(room, socketId, playerData) {
  if (!canJoinMode(room, { socketId, playerData })) {
    return { error: "Cannot join room" };
  }
  room.players[socketId] = {
    id: socketId,
    name: playerData.name,
    guesses: [],
    done: false,
    // mode-specific fields
  };
  return { ok: true };
}
```

### State Sanitization

```javascript
function sanitizeRoom(room) {
  const sanitized = {
    id: room.id,
    mode: room.mode,
    started: room.started,
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, player]) => [
        id,
        sanitizePlayer(player, room),
      ])
    ),
    // mode-specific sanitization
  };
  return sanitizeMode(room, sanitized);
}
```

## Deployment Considerations

1. **Environment Variables**: Use environment variables for config
2. **Database Migrations**: Run migrations on deployment
3. **Health Checks**: Implement health check endpoints
4. **Logging**: Set up proper logging for production
5. **Monitoring**: Monitor server performance and errors

## Common Pitfalls to Avoid

1. **Don't mutate room objects directly**: Create new objects
2. **Don't expose secrets**: Always sanitize before sending
3. **Don't trust client state**: Validate everything server-side
4. **Don't ignore errors**: Handle and log all errors
5. **Don't block event loop**: Use async/await properly
