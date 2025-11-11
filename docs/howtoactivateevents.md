Here’s the full, practical checklist for kicking off AI Battle Hour now that everything is wired up:

Set the shared admin token (one time).
In server/.env (or your deploy config) add something long and random—e.g.

EVENT_ADMIN_TOKEN=super-long-random-string-here
AI_BATTLE_EVENT_ACTIVE=false
AI_BATTLE_EVENT_SLOT=20:00-21:00
Restart the server so it reads the new vars.

Start the event via HTTP.
From any machine, run:

curl -X POST https://<your-server>/admin/events/ai-battle/start \
 -H "Authorization: Bearer super-long-random-string-here"

You should get back JSON like { "ok": true, "active": true, "roomId": "ABC123", ... }.
As soon as this request succeeds the controller ensures the canonical AI Battle room exists and stays featured.

Verify it’s live.

Admin view:
curl https://https://wordleplus-1-8f2s.onrender.com/admin/events/ai-battle/status \
 -H "Authorization: Bearer vHIKKXHZtvipSGpljRbeAvPtRFVwLLtOvDJwYAJDAvPtRFVwLLtOvDJwYAJD"
Confirms active flag, room id, slot.
Public/client view:
curl https://<your-server>/api/events/status
Same status but without needing the token. The home screen polls this and shows the “AI Battle Hour” card immediately, even if zero players.
Join from the UI.
Reload the app’s Home screen—your event card should be there. Hit “Join Now” to jump into the server-hosted lobby.

Stop the event when the window ends.

curl -X POST https://<your-server>/admin/events/ai-battle/stop \
 -H "Authorization: Bearer super-long-random-string-here"
The event room is de-featured, the home card disappears, and normal cleanup resumes.
