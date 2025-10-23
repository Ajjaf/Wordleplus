# Friendle Clone (with Battle Royale)

Minimal Wordle-with-friends clone featuring Duel (1v1) and Battle Royale modes.

## Dev

Server: `cd server && npm install && npm run dev` (http://localhost:4000)
Client: `cd client && npm install && npm run dev` (http://localhost:5173)

## Modes

Duel – each player sets a secret word for the other; 6 guesses; winner by solve/steps.
Battle Royale – host sets one word; 2+ players guess; first correct wins; reveal if no winner.

- **Play Again** (Battle Royale) : host can reset instantly, keeping the same word or clearing it for a new one.
