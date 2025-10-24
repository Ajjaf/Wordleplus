## Logout Redirect Flow

### The Problem
- Logging out sent the browser to the backend (`/api/logout`).
- After the session cleared, the backend redirected to its own base URL, so users landed on the backend splash screen instead of the game UI.

### What Changed
- **Client (`client/src/contexts/AuthContext.jsx`)**  
  `logout()` now calls `/api/logout?redirect=<frontend-origin>`.  
  Passing the current origin tells the server where the player should end up.
- **Server (`server/auth.js`)**  
  The `/api/logout` handler reuses `resolveFrontendRedirect()`, which validates the `redirect` query (same-origin check) and picks a safe fallback (`DEFAULT_FRONTEND_URL`).  
  When OpenID provides an end-session endpoint, we forward the validated `redirect` as `post_logout_redirect_uri`, otherwise we redirect to it directly.

### Result
> After logout, users are sent straight back to the frontend (or another approved URL you supply) instead of stopping on the backend landing page.

### Key Takeaway
Let the client specify a return target, but always validate it on the server before redirecting to prevent open-redirect issues.***
