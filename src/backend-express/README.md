# Backend (Express) — Modes: Memory fallback ↔ MongoDB

This backend supports two interchangeable storage modes:

- Fallback (in-memory): USE_MONGO=false
- MongoDB (Mongoose): USE_MONGO=true

Important environment flags

- USE_MONGO: set to `true` to use MongoDB, otherwise memory repositories are used.
- STRICT_DB_MODE: when `true` and USE_MONGO=true, the server will fail startup if DB unreachable.
- FALLBACK_ON_DB_ERROR: when `true` and USE_MONGO=true, the server will fall back to in-memory repositories if DB is unreachable.

Quick start (fallback/in-memory)

1. Copy an env file: `cp .env.example.memory .env`
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev` or start backend-only: `pnpm run dev:backend`

Quick start (MongoDB)

1. Ensure MongoDB is running and update MONGODB_URI in `.env` (or use `.env.example.mongo`)
2. Copy: `cp .env.example.mongo .env`
3. Set `USE_MONGO=true` and configure `STRICT_DB_MODE` / `FALLBACK_ON_DB_ERROR` as desired
4. Start server: `pnpm run dev` or `pnpm run dev:backend`

Tests

- Run unit tests: `pnpm test` (Vitest)
- Run tests in both modes: `pnpm run test:modes` (this toggles USE_MONGO=false, then USE_MONGO=true)

Notes on test framework

- This repo uses Vitest (fast, first-class for ESM/TS). The test harness uses Vitest commands. If you prefer Jest, I can add migration steps.

Repository layout (backend-express)

- config/: database and runtime config
- models/: Mongoose schemas (User, Dao, Comment, Notification)
- repositories/: Repository interfaces + Memory and Mongo implementations
- services/: Business logic using repository abstraction
- routes/: Express routes (unchanged)
- utils/: logger, mailer, idempotency, etc.

Verification checklist (manual HTTP calls)

1. Health

- GET /api/health → 200 { status: "OK" }

2. Auth (register/login)

- POST /api/auth/register { name,email,password } → 201 + { user, token }
- POST /api/auth/login { email,password } → 200 + { user, token }
- GET /api/auth/me (with Authorization: Bearer <token>) → 200 { user }

3. DAOs

- GET /api/dao (with token) → 200 { items, total }
- POST /api/dao (admin) → 201 created DAO (requires admin role)
- PUT /api/dao/:id/tasks/:taskId → 200 updates task

4. Comments

- POST /api/comments { daoId, taskId, content } (auth) → 201 comment
- GET /api/comments/dao/:daoId → 200 list

5. Notifications

- GET /api/notifications (auth) → 200 list
- PUT /api/notifications/:id/read (auth) → 200 { ok: true }

Switching modes

- To switch to Mongo: set `USE_MONGO=true` and provide `MONGODB_URI`. Set `STRICT_DB_MODE` to `true` to avoid runtime fallback.
- To run entirely in-memory: `USE_MONGO=false`.

Runtime behavior

- Repositories are selected lazily on first use. If USE_MONGO=true but DB unreachable:
  - If STRICT_DB_MODE=true and FALLBACK_ON_DB_ERROR=false → server startup fails.
  - Otherwise the services will fallback to in-memory repositories and continue running (WARNING logged).

If you want, I can:

- Add integration tests (supertest) for auth + DAO flows
- Add OpenAPI spec and Postman/Insomnia collection for verification
