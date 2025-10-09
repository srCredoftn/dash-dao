# ChangeLog — Delivery Ready

## Summary

Prepared a professional clean delivery with the following changes (backend "neuf"):

- Rotated JWT_SECRET and TOKEN_BOOT_ID to invalidate existing tokens.
- Disabled automatic seeding by default: `SEED_DAOS=false`, `SEED_USERS=false`.
- Added environment-based admin provisioning: `ADMIN_EMAIL` + `ADMIN_PASSWORD` create one admin at startup (opt-in).
- Added runtime reset endpoint: `POST /api/admin/reset-app` (admin only) to clear DAOs, notifications and sessions without restarting the server.
- Added safe runtime reset trigger via `TRIGGER_RESET` env var for automated reset on startup.
- Implemented `daoStorage.clearAll()` and `NotificationService.clearAll()` for clean resets.
- Frontend: auth init bootId check to avoid validating stale tokens and improved error handling.
- Added `pnpm run seed:dev` for optional dev seeding (opt-in).
- Fixed SMTP_HOST formatting and ensured mailer fallback to Ethereal when credentials missing.

## How to get a fresh backend (recommended professional flow)

1. Ensure the following variables are set in `.env` (or use CI secrets):
   - `JWT_SECRET` (strong secret)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` to provision an admin on first boot (optional)
   - `SEED_DAOS=false`, `SEED_USERS=false`
2. Start server: `pnpm dev` (or build & start in production).
3. On first startup, if `ADMIN_*` present, the admin user will be created automatically.
4. To force a runtime reset (no restart): login as admin -> POST `/api/admin/reset-app`.

## Developer tools

- Dev example seed: `pnpm run seed:dev` (sets `SEED_USERS=true` and `SEED_DAOS=true` then runs dev server).
- Generate .env example: `pnpm run env:generate`.

## Smoke tests to run after deployment

- GET `/api/boot` -> verifies `bootId` and `seedDaos`.
- POST `/api/auth/login` with admin credentials -> returns token.
- GET `/api/auth/me` with token -> returns current user.
- POST `/api/notifications/test-email` (authenticated) -> checks mailer.
- POST `/api/admin/reset-app` (authenticated admin) -> verifies runtime reset.

## Security notes

- For production, prefer NOT to set `ADMIN_PASSWORD` in env or use a secure secret manager.
- Keep `SEED_*` flags off in prod.

---

If you want, I can now:

- Run automated smoke tests (login, boot, me, smtp, admin reset) and report results, or
- Push these changes to the existing PR for review.

Tell me which action to run next.
