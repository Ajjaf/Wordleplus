# AI Battle Hour Event Playbook

Daily live event that highlights the AI Battle mode and concentrates players into a single, high-energy lobby. This guide explains how to prepare, run, and monitor the one-hour session that runs every day from **20:00&ndash;21:00 GMT**.

## Goals
- Guarantee there is always at least one AI Battle lobby visible and ready to host new players during the event window.
- Drive traffic by featuring the event on the home screen and announcements.
- Provide light-touch moderation and automated resilience (auto restarts, fallback messaging) so hosts do not need manual involvement.

## Schedule & Timeline (GMT)

| Time          | Action                                                                 |
|---------------|------------------------------------------------------------------------|
| 19:45 (T-15)  | Warm-up checklist, pre-create lobby(s), sanity checks.                 |
| 19:55 (T-5)   | Publish announcement banner, ensure lobby marked as `featured`.        |
| 20:00 (start) | Flip `AI_BATTLE_EVENT_ACTIVE` flag, confirm countdown auto-starts.     |
| 20:00-21:00   | Monitor health dashboard & lobby roster; auto-recover on failures.     |
| 20:55 (T+55)  | Post “Last rounds” message in lobby chat (if available).               |
| 21:00 (end)   | Disable event flag, remove featured status, archive metrics.           |
| 21:05 (T+5)   | File summary (player count, incidents, follow-ups).                    |

## Configuration Checklist
1. **Environment flag**  
   Add to deployment config (e.g. Docker compose, Vercel env, etc.):  
   - `AI_BATTLE_EVENT_ACTIVE=false` (default)  
   - `AI_BATTLE_EVENT_SLOT="20:00-21:00"` (for reference/UI)  
   - Optional: `AI_BATTLE_EVENT_LOBBY_ID=` so the server can keep a specific room alive.

2. **Scheduler**  
   - Set up a cron job or managed scheduler (CloudWatch, GitHub Actions, etc.) that calls the admin endpoint or script twice daily:  
     - 19:55 GMT → `/admin/events/ai-battle/start` (sets flag true).  
     - 21:00 GMT → `/admin/events/ai-battle/stop` (sets flag false).  
   - Scripts should fail loudly (log + alert) if the call does not return HTTP 200.

3. **Server logic (recommended)**  
   - When `AI_BATTLE_EVENT_ACTIVE=true`, ensure at least one room is:  
     - Mode `battle_ai`.  
     - Marked `featured=true` so the open rooms API surfaces it prominently.  
     - Auto-refreshed if all players leave (call `scheduleAiBattleCountdown` to keep rounds flowing).  
   - When flag flips to false, un-feature the room but let ongoing matches finish naturally.

4. **Client UI hooks**  
   - Home screen card: show “AI Battle Hour” ribbon, countdown, and quick join when flag is true.  
   - Nav banner or notification with start/finish messages.  
   - Optionally include `buildApiUrl("/api/events/status")` check so the UI does not rely on redeploys.

## Runbook

### Pre-Event
- Verify production deploy is stable (no pending migrations, sockets healthy).  
- Clear stale AI Battle rooms or reset them to a clean state.  
- Spot-check `GET /api/rooms/open` to confirm featured lobby visibility.  
- Ensure observability dashboards (error logs, Socket.IO metrics) are up.

### During Event
- Watch player count; if the lobby hits the soft cap (e.g. 12 players), spawn a secondary featured lobby.  
- Respond to auto-alerts (disconnect spikes, repeated start failures). Key metrics: `room.battle.pendingStart`, countdown timers, submission error rates.  
- Encourage engagement via scheduled push/Discord messages if available.  
- For outages longer than 3 minutes, pause the event (set flag false), post notice, and investigate before resuming.

### Post-Event
- Toggle flag off, remove featured banners, and archive the lobby (export stats or leave for casual play).  
- Collect metrics: peak concurrency, unique players, round throughput, error count.  
- File follow-up tasks (bugs, UX tweaks, performance issues) in the issue tracker.

## Operational Tips
- **Testing**: dry-run at least once in staging with mocked GMT scheduler to validate start/stop routines.  
- **Fallback**: keep a manual script ready (`node scripts/ai-battle-event.js stop`) in case the scheduler misfires.  
- **Messaging**: design a global toast or modal that surfaces 5 minutes before start and at end-of-event.  
- **Moderation**: designate a community moderator during the first week to gather live feedback and ensure fair play.

## Next Steps
- Implement `/api/events/status` endpoint and corresponding admin toggles.  
- Ship client UI updates for featured event cards.  
- Automate reporting (daily email or Slack summary at 21:05 GMT).  
- Iterate on rewards (XP boosts, leaderboards) once participation data is captured.
