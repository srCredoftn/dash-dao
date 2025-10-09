# DAO Dashboard (2SND) — Development README

This repository contains the DAO Dashboard (frontend + Express backend). This README documents how to run the project locally, the important environment variables, runtime reset behavior, and troubleshooting steps. It is written for developers and administrators working in a local development environment.

## Quick start

1. Install dependencies

   pnpm install

2. Start the development servers (frontend + backend)

   pnpm dev

3. Open the app in your browser
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3001/api/

Notes

- The dev script runs both backend and frontend concurrently.
- Vite provides HMR for the frontend; backend will restart automatically when server files change.

## Important environment variables

Set these in your .env (do not commit secrets) or export them in your environment.

- JWT_SECRET — REQUIRED: secure JWT signing secret (>= 32 chars)
- ADMIN_EMAIL — Admin account email for initial in-memory user
- ADMIN_PASSWORD — Admin password for initial in-memory user
- SEED_USERS — true/false; if true, seeded demo users will be created
- SEED_DAOS — true/false; if true, demo DAO data may be present
- TRIGGER_RESET — true/false; when true the server will perform an automatic runtime reset on startup
- MONGODB_URI — optional: if provided the app will attempt to use MongoDB (fallback to in-memory storage on failure)

SMTP / Email settings (optional but recommended for email notifications):

- SMTP_HOST — SMTP server host (e.g. smtp.example.com)
- SMTP_PORT — SMTP port (e.g. 465 or 587)
- SMTP_SECURE — true/false — whether to use TLS
- SMTP_USER — SMTP username
- SMTP_PASS — SMTP password
- SMTP_FROM — From address used for notification emails (e.g. noreply@example.com)
- MAIL_DOMAIN — (optional) domain used for email templates and DKIM

Do not store secrets in repository files. Use environment management or project UI when available.

## Runtime reset behavior

The project supports a safe runtime reset that clears DAOs, notifications and sessions without restarting the server.

Behavior summary:

- On startup: when `NODE_ENV !== 'production'` OR `TRIGGER_RESET=true`, the server attempts to clear persistent DAOs by calling the DaoService.clearAll(). If MongoDB is not available it falls back to the in-memory daoStorage.clearAll(). It also clears notifications and sessions, reinitializes users (from env or seeds) and rotates the runtime bootId to force client-side purge.

- Admin runtime endpoint: POST /api/admin/reset-app
  - In production this endpoint requires a valid admin JWT.
  - In development the endpoint allows unauthenticated resets (to make local debugging and CI easier).
  - Body: { rotateBootId?: boolean, seedDaos?: boolean }
  - Example (browser console):

    fetch('/api/admin/reset-app', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotateBootId: true, seedDaos: false }) })

  - When rotateBootId=true the server returns the new bootId in the response which the frontend uses to invalidate localStorage keys.

Server-side filtering, sorting and pagination (GET /api/dao)

- The backend supports query params on GET /api/dao to handle large datasets and server-side filtering:
  - search — text search over numeroListe, objetDossier, reference, autoriteContractante
  - autorite — exact match on autoriteContractante
  - dateFrom — ISO date or yyyy-mm-dd (inclusive) to filter dateDepot >= dateFrom
  - dateTo — ISO date or yyyy-mm-dd (inclusive) to filter dateDepot <= dateTo
  - sort — field name to sort by (default: updatedAt)
  - order — asc or desc
  - page — 1-based page number
  - pageSize — items per page (max 100)

- Example request:

  curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3001/api/dao?search=ami&autorite=Mairie%20de%20Lyon&dateFrom=2025-08-01&dateTo=2025-09-01&page=1&pageSize=20&sort=updatedAt&order=desc"

Sessions and token revocation

- GET /api/admin/sessions — list active sessions (development: no token required; production: requires admin JWT). Returns decoded user when token valid.
- POST /api/admin/revoke-session — revoke a specific token. Body: { token: "<TOKEN_TO_REVOKE>" } (production: requires admin JWT)

These endpoints are useful for debugging active users and invalidating compromised tokens.

## Frontend local cache rules and how to force a clean state

The frontend stores auth and some cached data in localStorage. The common keys include `auth_token`, `auth_user`, `notifications`, and cache keys that include the substrings `dao`, `DAO` or `cache`.

If you need a clean slate locally:

- Use the app key combination (dev helper): Ctrl+Shift+C — it will clear caches and reload the page (this is implemented in Index.tsx for development).

- Or paste the following snippet in the browser console and press Enter:

  for (let i = localStorage.length - 1; i >= 0; i--) {
  const k = localStorage.key(i);
  if (k && /(dao|DAO|cache|notification)/i.test(k)) localStorage.removeItem(k);
  }
  location.reload();

Notes

- The frontend in development forces fresh fetching of `/api/dao` (it disables the `all-daos` cache) so you should always see the server state after a reset.

## Health checks and diagnostics

- GET /api/health — basic server health (200 OK when running)
- GET /api/boot — returns current runtime bootId used to detect new deployments reseting local storage
- GET /api/dao — returns DAOs (requires authentication in normal flows)

If something looks stale:

1. Check backend logs for messages about TRIGGER_RESET, DaoService.clearAll, or bootId rotation.
2. Check /api/boot and compare bootId with browser localStorage key `boot_id_v1`.
3. If MongoDB is enabled (MONGODB_URI), verify Mongo is reachable; fallback to in-memory storage will be used if Mongo is unavailable.

## Clearing MongoDB (if using persistent DB)

If you are running a local MongoDB and need to wipe DAOs from the DB, run (locally on your machine):

# connect to your database and remove documents in the dao collection

# Example using the mongo shell or mongosh

use <your-db-name>
db.daos.deleteMany({})

Warning: this deletes production data if pointed at a production DB. Always double-check MONGODB_URI before running destructive commands.

## Creating a clean ZIP of the project (developer)

If you need a ZIP ready for distribution, use one of the following on your machine after pulling the latest changes:

- From the project UI: click "Download Project" (recommended for convenience).
- From CLI (clean archive without node_modules / secrets):

  git archive --format=zip -o dao-dashboard-clean.zip HEAD

Or create a zip and exclude node_modules and env files:

zip -r dao-dashboard-clean.zip . -x "node_modules/_" ".git/_" "\*_/.env_" "dist/_" "build/_"

## Troubleshooting common issues

- I still see DAOs after reset:
  - Ensure you are hitting the same backend instance (check that frontend is pointing to `http://localhost:3001` or same host)
  - Check /api/boot bootId and the browser `boot_id_v1` localStorage value — if they differ the frontend should purge localStorage on startup.
  - If MongoDB is used, the server may have persisted DAOs. Either run the admin reset endpoint (POST /api/admin/reset-app) or clear the DAO collection in MongoDB.

- Authentication problems:
  - Ensure JWT_SECRET is configured and long enough; the server refuses to start without a secure JWT_SECRET.
  - In dev, an admin user is created from ADMIN_EMAIL/ADMIN_PASSWORD or via SEED_USERS.

- Backend can't connect to Mongo (ECONNREFUSED):
  - The app will automatically fall back to in-memory storage. To use persistence, start MongoDB and set MONGODB_URI.

## Developer notes and conventions

- Files and patterns:
  - Backend routes reside in `backend-express/routes`
  - In-memory DAO is at `backend-express/data/daoStorage.ts`
  - API service and cache on frontend: `frontend/services/api.ts` and `frontend/services/cacheService.ts`
  - Frontend initial boot and localStorage purging logic: `frontend/main.tsx`

- Reset behavior was intentionally implemented to be safe for development: the server will attempt to clear the DB and fall back to memory to ensure predictable local dev state.

## Need help?

If you want, I can:

- Open a PR with this README update (I already have a branch prepared locally), or
- Generate a checklist you can run locally before packaging, or
- Create a small admin script (curl/node) to automate reset and verification from your machine.

Tell me which option you prefer and I will proceed.
