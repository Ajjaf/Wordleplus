# WordlePlus — Nice to Have

Post-launch feature roadmap. These are the ideas that will make WordlePlus genuinely fun to keep coming back to — not just play once.

---

## 1. Leaderboard (Full)

**Goal:** Make the leaderboard something players actively care about, not just a stat dump.

### What it needs to be fun
- **Live rank movement** — animate rank changes in real time during a battle room so players can see themselves climb
- **Global + Room leaderboards** — global all-time, global weekly, and a per-room leaderboard for the current session
- **Categories** — separate boards for: Most Wins, Best Win Rate, Longest Streak, Fastest Solve (by average guess count)
- **Player rank badge** — show rank tier badge (Bronze/Silver/Gold/Platinum/Diamond) next to player name in lobbies and on boards
- **"Near me" view** — show your rank plus 3 players above/below you so you always have a target
- **Weekly reset with rewards** — weekly leaderboard resets every Monday; top 3 earn a currency bonus and a cosmetic

### Schema additions needed
```
- add `totalWins`, `winRate`, `avgGuesses`, `fastestSolve` to User
- add `weeklyPoints`, `weeklyRank` (reset via cron job)
- add `RankTier` enum: BRONZE | SILVER | GOLD | PLATINUM | DIAMOND
```

---

## 2. Special Events Leaderboard

**Goal:** Limited-time competitive events that create urgency and buzz.

### How it works
- A **special event** runs for a fixed window (e.g. 48 hours, weekend)
- Every player who participates gets points for solving, speed, and streak
- Dedicated leaderboard page for the active event
- Event ends → top players get exclusive cosmetics (profile border, board theme, confetti colour)
- Events can have unique rules: "5-letter words only", "no backspace", "solve in 3 or less"

### Event types to build
| Event | Description |
|---|---|
| Speed Week | Points weighted heavily by guess count |
| Streak Run | Points only for maintaining a streak across rounds |
| Word of the Day Challenge | All players share a word; fastest solve wins |
| Double Points Weekend | Standard play, 2× currency earned |

### Schema additions needed
```
- Event table already exists (analytics) — extend to support competitive events
- add `EventLeaderboard` table: eventId, userId, points, rank, rewardClaimed
```

---

## 3. Player Profile

**Goal:** Give each player an identity they feel ownership over.

### Profile page includes
- **Display name** (editable)
- **Profile picture** — upload or choose from a set of illustrated avatars (animals, abstract shapes, etc.)
- **Profile colour** — accent colour used in lobbies, player cards, and the progress strip avatar
- **Stats card** — Total games, wins, win rate, best streak, average guesses
- **Achievements** — badges earned (see cosmetics section)
- **Recent games** — last 10 results with mode, guesses used, and whether they won
- **Rank badge** — current MMR tier displayed prominently

### How profile colour is used in-game
- Progress strip avatar background uses the player's chosen colour
- Player card border in lobbies uses the colour
- Name label in spectate view uses the colour

### Implementation
- Profile picture: store as URL (Cloudinary or S3 upload, or pick from preset set)
- Colour: store as hex string `#rrggbb`, validate on server
- Falls back gracefully for anonymous users (session-only, not persisted)

---

## 4. Cosmetics

**Goal:** Let players personalise their game experience visually without affecting gameplay.

### Categories

#### Board Patterns
Change the visual style of the guess tiles. Examples:
- Default (flat coloured tiles)
- Outlined (border only, minimal fill)
- Pill (rounded rectangle tiles)
- Classic (slightly 3D/embossed look)
- High contrast (accessible, bold)

#### Board Glow
An ambient glow effect on the board when a correct letter is placed:
- None (default)
- Green pulse
- Rainbow wave (one tile at a time)
- Gold shimmer

#### Confetti Style
What happens when you win:
- Classic multi-colour confetti (default)
- Gold coins
- Emoji burst (🎉🔥⚡)
- Fireworks
- None (clean)

#### Profile Border / Frame
A decorative ring around your avatar in lobbies and the progress strip. Unlocked through events or purchased.

#### Keyboard Skin
Colour scheme of the on-screen keyboard:
- Dark (default)
- Light
- Neon
- Monochrome

### Opinion — what to actually build first
Start with **board glow + confetti style** since they are client-only CSS/animation changes with no schema needed. Profile borders and keyboard skins come next since they are visible to other players. Board patterns require the most UI work and should be last.

### Implementation approach
- Store equipped cosmetics as a JSON field `equippedCosmetics` on User: `{ board, glow, confetti, border, keyboard }`
- Client reads this on socket join and applies CSS variables / class names
- Cosmetics have no effect on server — purely client rendering

---

## 5. Shop

**Goal:** A place to spend currency on cosmetics.

### Structure
- **Featured** — 3 rotating items highlighted at the top (refresh weekly)
- **Cosmetics** tab — browse all unlockable items by category
- **Bundles** — themed packs at a discount (e.g. "Neon Pack": neon keyboard + glow + confetti style)
- **Event shop** — exclusive items only available during active special events

### Pricing philosophy
- Common cosmetics: 100–200 coins
- Rare cosmetics: 500–800 coins
- Bundles: 20% cheaper than buying separately
- Event exclusives: earned by placing top 10, not purchasable

### Schema additions needed
```
- ShopItem: id, name, category, price, rarity, previewUrl, availableFrom, availableTo
- OwnedItem: userId, itemId, acquiredAt, equipped
- FeaturedItem: itemId, slot (1-3), refreshesAt
```

---

## 6. Currency

**Goal:** A simple in-game economy that rewards play and gives purpose to winning.

### Currency name suggestion
**"Sparks"** ⚡ — earned by playing, spent on cosmetics.

### How you earn Sparks
| Action | Reward |
|---|---|
| Complete a daily challenge | +30 |
| Win a duel | +50 |
| Win a battle round | +40 |
| Maintain a 3+ day streak | +20 bonus |
| Top 3 in weekly leaderboard | +200 / +150 / +100 |
| Win a special event (top 10) | +300–500 |
| First win of the day | +20 bonus |
| Solve in 3 or fewer guesses | +15 bonus |

### Anti-abuse rules
- Daily cap: max 300 Sparks per day from regular play (prevents farming)
- No trading or gifting between players
- Negative balance not possible

### Schema additions needed
```
- add `sparks` (Int, default 0) to User
- add `SparkTransaction`: userId, amount, reason, createdAt (audit log)
- server validates and applies all earnings — never trust client
```

---

## 7. MMR System

**Goal:** A skill-based matchmaking rating so competitive players have meaningful progression.

### How it works
- Every player starts at **1000 MMR**
- MMR only changes in **Duel mode** (1v1 is the fairest context)
- Win against a higher-rated opponent → gain more MMR
- Lose against a lower-rated opponent → lose more MMR
- Forfeit / disconnect mid-game counts as a loss

### MMR tiers
| Tier | MMR Range | Badge |
|---|---|---|
| Bronze | 0 – 999 | 🥉 |
| Silver | 1000 – 1199 | 🥈 |
| Gold | 1200 – 1499 | 🥇 |
| Platinum | 1500 – 1799 | 💎 |
| Diamond | 1800+ | 🔷 |

### Calculation (Elo-based)
```
K = 32  (adjustment factor)
expected = 1 / (1 + 10^((opponentMMR - myMMR) / 400))
newMMR = currentMMR + K * (actualResult - expected)
  where actualResult = 1 for win, 0 for loss
```

### Where MMR is displayed
- Player profile page (tier badge + exact number)
- Duel lobby — both players can see each other's tier before the round starts
- Leaderboard (dedicated MMR rankings board)
- Post-game result screen — shows MMR change (+18, -12, etc.)

### Schema additions needed
```
- add `mmr` (Int, default 1000) to User
- add `mmrTier` (enum) derived/cached
- add `MmrHistory`: userId, change, opponentId, result, gameId, createdAt
- update Duel game end handler to calculate and apply MMR changes
```

---

## Build Order Recommendation

| Phase | Features | Why first |
|---|---|---|
| **v1.1** | Full leaderboard, profile (name + colour + picture), Sparks (earn only, no shop yet) | Foundation — everything else depends on player identity and currency existing |
| **v1.2** | Shop, cosmetics (glow + confetti), profile borders | Gives the currency a purpose; most visible impact for players |
| **v1.3** | MMR system, MMR leaderboard | Requires the player base to be established first so ranks are meaningful |
| **v1.4** | Special events leaderboard, event shop | Best when there's an engaged audience to compete |
| **v1.5** | Board patterns, keyboard skins, bundles | Polish pass — add depth to the cosmetic system |
