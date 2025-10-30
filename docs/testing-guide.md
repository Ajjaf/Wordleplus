# Server Testing Playbook

This guide shows how to run the new automated test suite for the Express backend, how the initial Supertest coverage is structured, and which scenarios to target next. Share it with anyone learning Jest or contributing to WordlePlus.

---

## 1. Prerequisites

- **Node 20+** (aligned with the server runtime)
- Dependencies installed inside `server/`:

  ```bash
  cd server
  npm install
  ```

  > Tip: Jest and Supertest are already listed in `devDependencies`, so `npm install` will fetch them automatically.

---

## 2. Running the Tests

Inside the `server` directory:

```bash
npm test
```

What the script does:

- Launches Jest in Node’s ESM mode (`node --experimental-vm-modules`).
- Forces `NODE_ENV=test`, which prevents the server from opening a network port.
- Sets `SKIP_AUTH_SETUP=true` so the session/Passport stack (and the Prisma-backed session store) are skipped during tests.

If you prefer an explicit one-liner:

```bash
SKIP_AUTH_SETUP=true NODE_ENV=test node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand
```

---

## 3. Current Test Coverage

File: `server/tests/health.test.js`

| Scenario | Purpose |
| --- | --- |
| `GET /health` | Verifies the health check returns `{ ok: true }` with JSON content type. |
| `GET /api/validate` | Confirms the validator returns `valid: false` when no word is provided. |
| `GET /api/random-word` | Ensures the route responds with a five-letter uppercase token from the word list. |

These cases spin up the real Express app but skip authentication, giving students a safe, fast feedback loop.

---

## 4. How the Test Harness Works

1. **Conditional Auth Setup** – `server/index.js` now exports both the Express app and the underlying HTTP server. Authentication middleware is loaded only when `SKIP_AUTH_SETUP` is not set (or when `NODE_ENV !== "test"`), so Jest can run without a database connection.
2. **Supertest** – We import the app via dynamic `import("../index.js")`, then use Supertest to make in-memory HTTP calls. No sockets or ports are opened.
3. **Cleanup** – If the HTTP server ever starts listening (e.g., in future integration tests), the suite will close it in `afterAll`.

---

## 5. Recommended Next Tests

When expanding coverage, aim for a mix of unit-style and integration-style tests:

### Authentication & Sessions
1. **`GET /api/auth/user` anonymous session flow**  
   - Mock or stub the session middleware and Prisma calls.  
   - Verify that a new anonymous user ID is created and persisted on the session.

2. **`POST /api/logout` redirect logic**  
   - Ensure logout clears the session and redirects to the caller-provided `redirect` param (or the default base URL).

### Daily Challenge
3. **`POST /api/daily/guess`**  
   - Seed an in-memory puzzle and assert the response structure (pattern, gameOver flags, etc.).  
   - Use dependency injection or test doubles for the Prisma calls.

4. **`GET /api/daily/stats`**  
   - Simulate an authenticated user and confirm stats aggregation logic.

### Multiplayer Modes
5. **Room lifecycle helpers**  
   - Unit test helpers such as `normalizeMode`, `updateStatsOnWin`, and duel/battle mode initializers. These functions are deterministic and easy to cover without HTTP.

6. **Socket.IO endpoints**  
   - Use `socket.io-client` in the test suite to assert events like `createRoom`, `joinRoom`, `syncRoom`, and disconnection handling.

### Resilience & Security
7. **CORS preflight**  
   - Send an `OPTIONS` request with an allowed origin and confirm the response contains the correct headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, etc.).

8. **Rate limiting / invalid payloads**  
   - When validation middleware is added, verify that malformed payloads return helpful errors (400) and do not crash the server.

For each category, remember to:

- Keep tests deterministic (seed RNG, avoid time-based flakiness).
- Mock external services (Prisma, OIDC) so local runs do not require network/database access.
- Split large integration tests into logical describe blocks to make failures easy to diagnose.

---

## 6. Teaching Notes

- **Start simple** – Health checks and pure functions are great introductory exercises.
- **Incrementally add complexity** – After students master Supertest basics, introduce session-dependent routes and mocking strategies.
- **Encourage TDD** – Have students write tests before refactoring endpoints; Supertest requests double as executable API documentation.
- **Document fixtures** – When adding seeds or mocks, capture them in helper utilities to keep tests readable.

---

Happy testing! Add this document to onboarding materials so the whole team can share a common approach to backend quality. If you extend the suite, append your scenarios and rationale here to build collective knowledge.
