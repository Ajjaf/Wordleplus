# WordlePlus — Player Flows & UI/UX

This document describes every screen and interaction a player encounters, organized by game mode. Use it to identify friction points, simplify flows, and ensure mobile-first responsiveness.

---

## 1. Entry: Home Screen

### 1a. First Visit (No Name Set)

**What the user sees:**
- Full-screen gradient background
- Centered card with title "Welcome to WordlePlus"
- Subtitle: "Enter your name to get started"
- Text input: "Your display name"
- "Continue" button (disabled until name is entered)

**Actions:**
- Type name → Continue → transitions to main home

---

### 1b. Main Home (Name Set)

**What the user sees (top to bottom):**

1. **Daily Challenge Hero** — Large card with daily stats (streak, max streak, win rate, wins, played) and a "Play" button
2. **Game Modes** — 4 cards in a row (desktop: 3-col grid, mobile: horizontal scroll):
   - Duel (1v1)
   - Battle Royale (multiplayer)
   - AI Battle (server-hosted)
   - Shared Duel (co-op)
3. **Open Game Rooms** — List of joinable rooms showing: mode badge, room ID, host name, player count, status (In Match / Waiting), "Join Room" button per room
4. **Active Events** — "AI Battle Hour" event card with player count, time slot, "Join Now"
5. **Join a Room** — 6-character room code input + "Join Room" button
6. **Leaderboard** — Two cards: "Top Players" (by wins) and "Top Streaks"
7. **Footer** — Copyright text

**Actions:**
- Tap "Play" on Daily Hero → Daily Challenge screen
- Tap a game mode card → Creates a room, goes to game/lobby
- Tap "Join Room" on an open room → Joins that room
- Enter room code + "Join Room" → Joins by code
- Tap "Join Now" on event → Joins the AI Battle event room

---

## 2. Daily Challenge Flow

### Screen: DailyGameScreen

**What the user sees:**
- Header: "Daily Challenge" title, today's date, "Guess the word in 6 tries"
- Single game board: 6 rows of 5 tiles
- On-screen keyboard at the bottom

**Actions:**
- Type letters (physical or on-screen keyboard) → letters appear in the active row
- Press Enter → submits guess, row animates with color feedback:
  - Green = correct letter, correct position
  - Yellow = correct letter, wrong position
  - Gray = letter not in the word
- Press Backspace/DEL → removes last letter
- Invalid word → row shakes, no submission

**End state:**
- Solved → VictoryModal: "Solved in X guesses", streak info, no Play Again
- Failed (6 wrong guesses) → VictoryModal: shows the answer, streak reset
- Close modal → stays on board showing final state

**Flow:** Home → Daily Challenge → Guess → Win/Lose modal → Done (back to home)

---

## 3. Duel Mode Flow (1v1)

### 3a. Room Creation

**From home:** Tap "Duel" mode card → room is created → player enters the game screen directly

### 3b. Joining

**From home:** Enter room code or tap "Join Room" on an open duel room → joins the room

### 3c. Secret Word Setup Phase

**What the user sees (DuelGameScreen):**
- "Choose your secret word" label at top
- Row of 5 tiles for entering the secret word
- Dice button (generates a random valid word)
- Hint text: "Press Enter to set" (when 5 letters entered)
- Status below: "Set your secret word" / "Waiting for opponent..." / "Starting..."
- On-screen keyboard

**Actions:**
- Type 5 letters → tiles fill in
- Tap dice → random word fills the tiles
- Press Enter → secret word is set, status changes to "Waiting for opponent"
- When both players set secrets → game auto-starts

### 3d. Guessing Phase

**What the user sees:**
- **Desktop:** Two boards side by side — your board (left) and opponent's board (right)
- **Mobile:** One board visible at a time, tap/swipe to toggle between your board and opponent's
- Player cards above each board: name, wins, streak
- Timer bar (6-minute round)
- On-screen keyboard at bottom (only active on your board)

**Actions:**
- Type letters → appear in your active row
- Press Enter → submit guess, see color feedback
- Tap opponent card/board → switch view (mobile)

### 3e. End of Round

**What the user sees:**
- Both secret words revealed on the boards
- VictoryModal overlay:
  - Left/right player cards showing who solved / didn't solve
  - Winner announcement or "Draw"
  - Stats: guesses used, secret words
- "Request Rematch" button
- Status: "Waiting for opponent" or "Opponent ready"

**Actions:**
- "Request Rematch" → waits for opponent to also request
- Both request → confetti animation → new round starts (back to secret word setup)
- Close modal → stays in room, can still request rematch

**Flow:** Home → Create/Join → Set Secret → Guess → Win/Lose → Rematch (loop) or Leave

---

## 4. Battle Royale Flow

### 4a. Host Flow

**Room creation:** Tap "Battle Royale" card → room created → player is the host

**What the host sees (HostSpectateScreen):**
- "You are the Host" header
- Secret word input: 5 tiles + dice button + "Press Enter to set word"
- "Start Battle" button (disabled until word is set and 2+ players joined)
- Player count
- Leaderboard button

**Host actions:**
- Type/generate a word → Enter → word is set
- Wait for players to join
- "Start Battle" → round begins, host switches to spectate view

**During round (host spectating):**
- Grid of spectate cards — one per player showing their board in real-time
- Leaderboard modal (tap to open)
- Round ends when someone solves or all players exhaust guesses

**Between rounds:**
- "Play Again" button → resets the round, host can set a new word

### 4b. Player Flow

**Joining:** Enter room code or tap "Join Room" on an open battle room

**What the player sees (BattleGameScreen):**
- Header: "Live" indicator + timer, or "Next round" + countdown, or winner name
- Progress strip showing all players' progress (how many guesses used)
- Single game board (your guesses)
- On-screen keyboard

**Actions:**
- Type letters → Enter → submit guess
- First correct guess wins the round for everyone
- If you exhaust 6 guesses, you're marked done and wait

**End of round:**
- The word is revealed
- Game results: standings, winner highlighted
- Wait for host to start next round

**Flow:** Home → Join → Wait for host → Guess → Results → Next round (loop) or Leave

---

## 5. AI Battle Flow

### 5a. How It Differs from Battle Royale

- No human host required — the server picks words and starts rounds automatically
- Countdown timer between rounds (12 seconds)
- Any player can "Claim Host" to pick words manually, or "Release to AI" to go back to auto

### 5b. Player Flow

**What the player sees (BattleGameScreen):**
- Same as Battle Royale but with:
  - Countdown timer to next round (when between rounds)
  - "Start Now" button (if player wants to skip countdown)
  - "Claim Host" button (to take over word selection)

**Actions:**
- Same guessing as Battle Royale
- "Start Now" → starts round immediately
- "Claim Host" → becomes the host, sees HostSpectateScreen

**Flow:** Home → Join/Create → Auto-countdown → Guess → Results → Auto-countdown (loop)

---

## 6. Shared Mode Flow (Co-op)

### Screen: SharedDuelGameScreen

**What the user sees:**
- Shared board (one board for both players)
- Player cards: "You" and "Opponent" — active player highlighted
- Turn indicator: only the current turn player can type
- On-screen keyboard (disabled when not your turn)

**Pre-game:**
- Host sees "Start Shared Round" button (needs 2+ players)
- Non-host sees "Waiting for host to start"

**During game:**
- Players alternate turns guessing the same word
- Active turn player's card is highlighted
- Keyboard disabled for the non-active player

**End:**
- Solved or failed → VictoryModal with revealed word and winner
- "Play Again" → resets the round

**Flow:** Home → Create/Join → Host starts → Take turns guessing → Win/Lose → Play Again (loop)

---

## 7. Common UI Components

### Game Board
- 6 rows of 5 tiles
- Tile states: empty (dark border), typing (white text), correct (green), present (yellow), absent (gray)
- Row animations: flip on guess submit, shake on invalid word
- Optional secret word row above the guess rows (duel mode)
- Auto-sizes to fit the container (responsive)

### On-Screen Keyboard
- 3 rows: QWERTYUIOP / ASDFGHJKL / ENTER + ZXCVBNM + DEL
- Keys color-coded based on guess results (green/yellow/gray)
- Fixed to bottom on mobile, inline on desktop
- Disabled during opponent's turn or when game is over

### Victory Modal
- Backdrop blur overlay
- Mode-specific content (daily stats, duel player cards, battle standings)
- "Close" and optional "Play Again" / "Request Rematch" buttons
- Screen reader announcement on open

### Secret Word Input
- 5 inline tiles with hidden text input
- Dice/generate button for random word
- "Press Enter to set" hint
- Validation error text if word is invalid
- On mobile: full on-screen keyboard below the tiles

---

## 8. Navigation & Transitions

| From | To | Trigger |
|---|---|---|
| Home | Daily Challenge | Tap "Play" on daily hero |
| Home | Duel (secret setup) | Tap "Duel" card / join a duel room |
| Home | Battle (waiting) | Join a battle room as player |
| Home | Host Spectate | Create a battle/AI battle room |
| Home | AI Battle (countdown) | Join an AI battle room |
| Home | Shared (lobby) | Tap "Shared" card / join shared room |
| Secret setup | Guessing (duel) | Both players set secrets |
| Host spectate | Host spectate (round) | Host starts battle |
| Waiting (battle) | Guessing (battle) | Host starts round |
| Guessing | Victory modal | Round ends |
| Victory modal | Secret setup (duel) | Both request rematch |
| Victory modal | Waiting (battle) | Host resets round |
| Any game screen | Home | Leave room / disconnect |

---

## 9. Known UX Pain Points

- [x] **Progress strip** — Simplified: removed guess count, kept avatar + name + mini grid only, tightened spacing, flattened card layout from vertical to horizontal.
- [x] **Host keyboard** — Physical keyboard now works globally on the host's secret word screen (fallback `keydown` listener on `window`).
- [x] **Error sound** — `error.mp3` now plays on every invalid/incorrect guess across all modes (Duel, Battle, Daily).
- [x] **Minimal cleanup** — Stripped visual noise: removed pulsing/glowing/shadow effects from secret word tiles, removed "Choose your secret word" labels, simplified Daily header (no instruction text), simplified Duel footer (plain text instead of animated badges), simplified Host Spectate header (compact, no decorative banner), removed unused "Guesses" labels and explanation paragraphs, cleaned up unused imports.
