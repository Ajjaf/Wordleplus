## React Hook Order Fix in `ProfileModal`

### What went wrong
- `ProfileModal` used hooks (`useMemo`) **after** an early `return null` guard.
- When `user` was missing, React bailed out before those hooks executed.
- On later renders (with `user` defined), the component reached the memo hook, so React detected a different hook order and threw:  
  `Error: Rendered more hooks than during the previous render.`

### How it was fixed
- Move the hook setup (`const stats = …`, `useMemo(...)`) **before** the `if (!mounted || !user) return null;` guard.
- With hooks declared unconditionally, every render now follows the same hook order and the error no longer occurs.

### Key takeaway
> React hooks must be called in the same order on every render. Avoid placing hook declarations inside conditionals or after early returns that can short-circuit different render paths.
