## Mobile Duel Layout Fix Notes

### What was broken?
- On phones, the duel board sat far below the “Guesses” label, leaving empty space that the keyboard didn’t use.
- The board component always centered itself inside its container (`placeItems: center`), so even when the parent had extra height, it shoved the grid downwards.
- The duel screen’s flex column let the “Guesses” section grow, so the centered board appeared midway down the viewport.

### How we diagnosed it
1. Inspected `Board.jsx` to see how it handles sizing. Found the wrapper always uses `display: grid; place-items: center;` with no way to override alignment.
2. Checked `DuelGameScreen.jsx` and confirmed the board lives in a flex column that fills the remaining height. Since the board’s wrapper was centering, any unused height appeared above the grid.
3. Conclusion: we needed a way to tell `Board` to pin to the top while keeping horizontal centering.

### Changes in `Board.jsx`
- Added two optional props: `horizontalAlign` and `verticalAlign` (line `22`).
- Normalized incoming values so we support common aliases like `"top"`/`"center"`/`"bottom"` (lines `126-139`).
- Applied the resolved values to the wrapper grid via `alignItems` and `justifyItems` instead of the fixed `placeItems: "center"` (lines `168-173`).
- Defaults stay `"center"`, so every existing use keeps its old behavior unless it opts in.

### Changes in `DuelGameScreen.jsx`
- Wrapped the board container with `items-start` and passed `verticalAlign="start"` to the board (lines `802` and `823`). This nudges the grid toward the top while still centering it horizontally.
- No other screens use these overrides yet, but they now can if they ever need custom alignment.

### Result
- Duel board now hugs the “Guesses” label, so the keyboard can slide in without hiding rows.
- Desktop and other modes stay unchanged because the defaults remain centered.
