# Open Room Ghost Cleanup

This note documents the recent changes that prevent “ghost” lobbies from lingering in the Open Rooms panel and addresses the scenarios that allowed players to become stranded when a host dropped.

## Problems Observed

- **Stale listings:** Rooms with a disconnected host (or no active players at all) continued to appear in the open-room feed indefinitely.
- **No-path recovery:** Remaining players were left in limbo when the host disconnected because host reassignment only happened manually.
- **Socket duplication:** Reconnection flows could create duplicate player entries when a socket ID changed, producing inconsistent state snapshots.

## Design Principles

1. **Graceful host drop:** Give the host a short grace window to reconnect before destroying their lobby.
2. **Authoritative cleanup:** Keep the server as the single source of truth by pruning stale players/rooms on an interval.
3. **Client accuracy:** Ensure the Open Rooms endpoint exposes only rooms with an active host and at least one active participant.
4. **Stable resume path:** Reconnection must migrate player state without duplicates, regardless of whether the reconnecting player is the host or a guest.

## Implementation Highlights

| Area | Description | Code reference |
| --- | --- | --- |
| Joinable summaries | `summarizeJoinableRoom` now rejects rooms whose host is absent/disconnected or whose active roster is empty. This keeps “ghost” lobbies out of the `/api/rooms/open` payload. | `server/index.js:519-547` |
| Host grace timer | Introduced `HOST_DISCONNECT_GRACE_MS` (2 min). The host can reconnect within this window before their room is hard-deleted. | `server/index.js:498-501`, `server/index.js:971-1004` |
| Disconnect handling | On socket drop we flag the player, stamp `disconnectedAt`, attempt host reassignment, and update the room timestamp so cleanup routines have fresh metadata. | `server/index.js:928-948` |
| Periodic cleanup | The 5-minute interval now removes long-disconnected players, reassigns hosts, and deletes rooms whose occupants have all exceeded the grace period. | `server/index.js:953-1004` |
| Resume semantics | Rejoin/resume paths clone state to the new socket while clearing `disconnected` flags and timestamps, ensuring a single authoritative player record. | `server/index.js:667-687`, `server/index.js:907-921` |

## Behavioural Summary

- **Active lobbies stay visible.** As long as the host (or a newly promoted host) is connected, the lobby remains in the open-room feed.
- **Host drop window.** If the host disconnects, other active players immediately inherit host control. If everyone disconnects, the room is retained only until the grace timer expires.
- **No ghosts.** Rooms populated solely by disconnected players are removed server-side and never appear in `/api/rooms/open` responses.
- **Resume without duplicates.** When the original host (or any player) reconnects, their previous record is updated in place; no orphan entries linger.

## Suggested Verification

1. **Host drop, active guest:** Create a duel, join with a second browser, close the host tab. Confirm the guest becomes host and the room stays listed.
2. **Full disconnect:** Disconnect all participants and wait two minutes. The room should vanish from `/api/rooms/open` and `rooms` map.
3. **Resume path:** Reconnect the original host within the grace window and confirm only one entry exists for their name and socket ID.
4. **Battle mode start:** When a battle round is active (`room.battle.started === true`), `/api/rooms/open` excludes the room until it returns to lobby state.

These checks ensure the system now meets the “no ghosts, no stranded players” goals set out in the design brief.
