# Event Activation Guide

This doc explains how to turn any supported multiplayer mode into a timed “event” that the backend treats as a featured, always-on lobby. The current implementation targets **AI Battle Hour**, but you can reuse the same pattern for future events (e.g., Duel Rush) by swapping the mode-specific wiring.

---

## 1. Prerequisites

- Production build running the latest server commit that includes the event controller (`server/index.js`, Oct 2025 update).  
- Admin access to deployment environment variables (e.g., Vercel, Render, ECS, Docker).  
- Optional: ability to hit internal admin endpoints or run scripts against the server for on-demand activation.

---

## 2. Environment Flags

Add the following variables to your deployment config or `.env.production`:

```env
AI_BATTLE_EVENT_ACTIVE=false      # default state
AI_BATTLE_EVENT_SLOT="20:00-21:00"
```

- `AI_BATTLE_EVENT_ACTIVE` drives the live event toggle. When the process boots with this set to `true`, it immediately provisions the canonical event room.  
- `AI_BATTLE_EVENT_SLOT` is informational metadata surfaced via `room.meta.slot`; use it for UI labels or analytics.

If you need multiple events, use unique keys (see §6) or extend the controller to read a comma-separated list.

---

## 3. Manual Start/Stop (no redeploy)

The server exposes a helper inside `server/index.js`:

```js
setAiBattleEventActive(true);  // start
setAiBattleEventActive(false); // stop
```

You can call this in several ways:

1. **Node REPL / pm2** – attach to the running process (`node --inspect` or pm2 shell) and invoke the function manually.  
2. **Temporary admin endpoint** – create a protected route that calls `setAiBattleEventActive(req.body.enable)`.  
3. **CLI script** – add `scripts/ai-battle-event.js` that imports the http server and toggles the flag (remember to exit after the promise resolves).

Whichever method you choose, the controller will:

- Ensure exactly one event room exists (`battle_ai` mode).  
- Stamp `room.meta.isEvent = true`, `eventId`, `slot`, and mark it as `featured`.  
- Set `room.hostId = "server"` so the host never “disconnects”.  
- Automatically restart the countdown when the room empties.  
- Skip cleanup deletions while the flag stays on.

Stopping the event flips the metadata off, clears the “server host” marker, and lets the room behave like any normal AI battle lobby.

---

## 4. Scheduled Automation

To guarantee a daily window (e.g., 20:00–21:00 GMT):

1. **Create a scheduler job** (GitHub Actions, CloudWatch, cron on a management box, etc.).  
2. At **19:55 GMT** call your “start” automation (`setAiBattleEventActive(true)`).  
3. At **21:00 GMT** call the “stop” automation (`setAiBattleEventActive(false)`).  
4. Send alerts if either invocation fails (HTTP status ≥400 or throws).  

This keeps the flag aligned with your messaging and lets the server handle round recycling on its own.

---

## 5. Client & Ops Checklist

- **Home screen**: surface a banner/card when `room.meta.isEvent` is true (e.g., poll `/api/rooms/open` every 15 s; event rooms show `hostName: "AI Battle Hour"`).  
- **Announcements**: schedule Discord/email push 5 minutes before start.  
- **Monitoring**: track `room.battle.pendingStart`, player counts, and error logs during the slot.  
- **Postmortem**: log peak concurrency, unique participants, and any incidents once the event stops.

Refer to `docs/ai-battle-event.md` for the detailed operations playbook.

---

## 6. Adapting to Other Modes

To launch a different mode as an event:

1. Duplicate the helper block in `server/index.js` with a new base key (e.g., `duel_rush_hour`).  
2. Adjust `create<Event>Room` to call the appropriate `init*` functions and metadata.  
3. Decide whether the host should remain the server or rotate among players; update disconnect logic accordingly.  
4. Update `summarizeJoinableRoom` and the open-room API to tag the new event label (`"Duel Rush Hour"`).  
5. Create a matching documentation page/playbook under `docs/`.

Until you generalize the controller, keep at most one “manual” event live at a time to avoid overlapping meta flags.

---

## 7. Quick Test Plan

1. Set `AI_BATTLE_EVENT_ACTIVE=true` locally, start the server.  
2. Inspect `/api/rooms/open`; verify the featured AI Battle event room appears even with zero players.  
3. Join the room, play a round, exit, and confirm the countdown restarts after the lobby clears.  
4. Toggle the flag off, ensure the room loses the “AI Battle Hour” label and the cleanup timer eventually retires it.

Once these checks pass, you can confidently roll the event into production.
