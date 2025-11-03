# Cross-Domain Session Auth: A Practical Guide

This walkthrough captures the exact steps we took to get the WordlePlus React frontend (hosted on Vercel) talking to its Express/Passport backend (hosted on Render) while keeping session cookies intact. Use it as a teaching aid or a future playbook when browser security and identity combine to produce mysterious “it works locally but not in prod” bugs.

---

## 1. Recognizing the Problem

**Symptoms we saw**

- Login/signup appeared to succeed with the OpenID provider, but the frontend still treated the user as anonymous.
- Network tab showed `/api/auth/user` returning `304 Not Modified`, yet the UI never updated.
- Render logs complained: `Error: Origin https://...vercel.app not allowed by CORS`.
- The browser occasionally set a `connect.sid` cookie, but follow-up requests never carried it.

**What was really happening**

1. The frontend browser session ran on `https://wordleplus-gamma.vercel.app`.
2. The API lived on `https://wordleplus-1-8f2s.onrender.com`.
3. Because the origins differed, the browser treated every fetch as **cross-site**:
   - Requests default to omitting cookies (`credentials: "same-origin"`).
   - Responses are blocked unless the server returns matching `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`.
4. Our backend’s original `cors()` setup always replied with `Access-Control-Allow-Origin: *`, which immediately disqualifies the response when `credentials: true` is desired.
5. Some fetches still hit `/api/...` *without* an explicit host, so on Vercel the browser tried `https://wordleplus-gamma.vercel.app/api/...` instead of the Render origin.

---

## 2. Debugging Checklist

Teach students to gather evidence instead of guessing.

1. **Network Tab (Chrome DevTools → F12)**
   - Reload the page and inspect `/api/auth/user`.
   - Check request headers: is `Cookie: connect.sid=...` present?
   - Check response headers: `Access-Control-Allow-Origin` must match the frontend origin *exactly*, and `Access-Control-Allow-Credentials` must be `true`.
   - Verify the `Set-Cookie` header (should include `SameSite=None; Secure` in production).

2. **Application → Storage → Cookies**
   - Confirm the `connect.sid` cookie exists after hitting the endpoint.
   - Ensure its domain is that of the backend (`wordleplus-1-8f2s.onrender.com`) and the path is `/`.

3. **Server Logs**
   - Tail logs from Render. Look for rejected origins or passport strategy errors.

4. **Environment Variables**
   - Print them in the runtime environment or double-check in Render’s dashboard.
   - Specifically confirm `BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOWED_ORIGIN_SUFFIXES`, and `SESSION_COOKIE_*` values.

5. **Browser Console**
   - Watch for CORS errors, blocked cookies, or `TypeError: Failed to fetch`.

---

## 3. The Fix: Step by Step

### Step 1 — Centralize the API Origin on the Frontend

- Add a helper that builds full URLs from `VITE_SERVER_URL`.
- Use it everywhere we call `fetch()`, perform navigations (`/api/login`, `/api/logout`), or hit socket endpoints.

```js
// client/src/config.js
const fromEnv = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
const fromWindow =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : null;
const localDefault =
  fromWindow && /localhost/i.test(fromWindow)
    ? "http://localhost:8080"
    : fromWindow;

export const SERVER_URL = fromEnv || localDefault || "http://localhost:8080";

export function buildApiUrl(path = "") {
  if (!path) return SERVER_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${SERVER_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
```

Use the helper:

```js
// client/src/contexts/AuthContext.jsx
const response = await fetch(buildApiUrl("/api/auth/user"), {
  credentials: "include",
});
window.location.href = buildApiUrl(`/api/login${queryString ? `?${queryString}` : ""}`);
```

```js
// client/src/modes/daily/actions.js
const res = await fetch(buildApiUrl("/api/daily/guess"), {
  method: "POST",
  credentials: "include",
  headers: { ...JSON_HEADERS, "X-User-Id": userId },
  body: JSON.stringify({ guess }),
});
```

### Step 2 — Tighten Express CORS Rules

- Allow credentials.
- Reply with the *exact* requesting origin instead of `*`.
- Support a whitelist + optional suffix (useful for Vercel previews).
- Share the same logic with Socket.IO.

```js
// server/index.js
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const normalizeOrigin = (value) => {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
};

const allowedOrigins = (() => {
  const origins = new Set(
    DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin).filter(Boolean)
  );

  const baseOrigin = normalizeOrigin(process.env.BASE_URL);
  if (baseOrigin) origins.add(baseOrigin);

  const extras = process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const origin of extras) {
    const normalized = normalizeOrigin(origin.trim());
    if (normalized) origins.add(normalized);
  }

  return Array.from(origins);
})();

const allowedOriginSet = new Set(allowedOrigins);
const allowedSuffixes =
  process.env.CORS_ALLOWED_ORIGIN_SUFFIXES?.split(",")
    .map((suffix) => suffix.trim())
    .filter(Boolean) ?? [];

const hostnameMatchesSuffix = (hostname, suffix) => {
  if (!hostname || !suffix) return false;
  const normalized = hostname.toLowerCase();
  const cleaned = suffix
    .toLowerCase()
    .replace(/^\*\./, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^\./, "");

  return (
    normalized === cleaned ||
    normalized.endsWith(`.${cleaned}`)
  );
};

const evaluateCorsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true); // allow curl/health-checks
  const normalized = normalizeOrigin(origin);
  if (normalized && (allowedOriginSet.has(normalized) ||
      hostnameMatchesSuffix(new URL(normalized).hostname, cleanedSuffix)))
    return cb(null, true);

  cb(new Error(`Origin ${origin} not allowed by CORS`));
};

app.use(cors({
  origin: evaluateCorsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-User-Id", "Authorization"],
  credentials: true,
}));
app.options("*", cors({ origin: evaluateCorsOrigin, credentials: true }));

const io = new Server(httpServer, {
  cors: {
    origin: evaluateCorsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
```

### Step 3 — Session Cookie Guardrails

The Express session middleware already set the correct defaults:

```js
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.SESSION_COOKIE_SAME_SITE ||
            (process.env.NODE_ENV === "production" ? "none" : "lax"),
  domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
```

Key teaching points:

- For cross-site cookies, you **must** use `SameSite=None; Secure`.
- Leave `domain` unset unless you control a parent domain; otherwise, cookies disappear.
- Always provide a strong `SESSION_SECRET`.

### Step 4 — Environment Configuration

On **Render (backend)**:

| Key | Value |
| --- | --- |
| `BASE_URL` | `https://wordleplus-gamma.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://wordleplus-gamma.vercel.app` |
| `CORS_ALLOWED_ORIGIN_SUFFIXES` | `.vercel.app` |
| `SESSION_COOKIE_SAME_SITE` | `none` (optional; default code already sets this in production) |
| `SESSION_COOKIE_DOMAIN` | *(leave unset)* |

On **Vercel (frontend)**:

| Key | Value |
| --- | --- |
| `VITE_SERVER_URL` | `https://wordleplus-1-8f2s.onrender.com` |

Redeploy both services after updating environment variables.

---

## 4. Verification Steps After Deploy

1. Open the app in Vercel. Clear cookies for both domains to start fresh.
2. Reload the page → `/api/auth/user` should return `200` with JSON data.
3. DevTools → Application → Cookies should show `connect.sid` scoped to `.onrender.com`.
4. Click “Log In”, complete the OpenID flow, and verify the UI reflects the logged-in user.
5. Socket.IO connections should succeed (no CORS errors in the console).
6. Inspect Render logs—no “Origin ... not allowed by CORS” messages.

---

## 5. Optional: Keeping Frontend & Backend on the Same Origin

Sometimes the easiest fix is architectural. If you can host both assets on the same domain, you avoid 90% of CORS pain.

**Approach A — Reverse Proxy**

1. Serve the frontend under `/`.
2. Proxy `/api` and `/socket.io` to the backend.
3. Example Nginx snippet:

```nginx
server {
  server_name wordleplus.example.com;

  location / {
    root /var/www/wordleplus-client;  # built frontend assets
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass https://wordleplus-1-8f2s.onrender.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /socket.io/ {
    proxy_pass https://wordleplus-1-8f2s.onrender.com;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
  }
}
```

**Approach B — Deploy Everything Behind Vercel**

1. Deploy the Express app as a serverless function or API route.
2. Use Next.js or Vite SSR to bundle the backend into Vercel.
3. All requests originate from `https://wordleplus-gamma.vercel.app`, so cookies are first-party.

**Approach C — Subdomain Alignment**

1. Use a shared root domain (e.g., `app.wordleplus.com` for frontend, `api.wordleplus.com` for backend).
2. Set the session cookie domain to `.wordleplus.com`.
3. You still need CORS/credentials, but DNS remains under your control.

---

## 6. Teaching Tips & Common Pitfalls

1. **Always replicate production conditions locally**: run frontend on `localhost:5173`, backend on `localhost:8080`. This forces you to solve CORS before hitting deployment.
2. **Never hardcode `*` when dealing with auth**: `Access-Control-Allow-Origin: *` + `credentials: true` = browser rejection.
3. **Watch out for `304 Not Modified`** responses: browsers may skip re-reading the body when the response is cached; rely on state rather than heuristics.
4. **Use `fetch()` defaults wisely**: the default is `credentials: "same-origin"`. For cross-domain cookies, always set `credentials: "include"`.
5. **Don’t forget Socket.IO/WebSockets**: they require the same origin checks to avoid being silently dropped.
6. **Verify every environment variable**: typos or missing values (especially trailing slashes) can send requests to the wrong host.

---

## 7. Recap

| Issue | Fix |
| ----- | --- |
| Browser omitting cookies | Set `credentials: "include"` on every fetch. |
| Backend returning `*` for CORS | Replace with explicit origin reflection + whitelist. |
| Vercel previews failing | Support `CORS_ALLOWED_ORIGIN_SUFFIXES=.vercel.app`. |
| OAuth redirects bouncing | Use full backend URLs (`buildApiUrl`) for `/api/login` and `/api/logout`. |
| Mixed hosts causing confusion | Optional: align domains via reverse proxy or shared root domain. |

By tying together these concepts—browser security, server configuration, environment management—you can mentor students through the full lifecycle of diagnosing and fixing cross-origin session auth problems.

---

Happy debugging!

