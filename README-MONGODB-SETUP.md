# MongoDB setup (Express backend)

This project uses the Express backend (backend-express/) with optional MongoDB persistence via Mongoose. When MongoDB is unavailable, the app automatically falls back to safe in-memory storage so you can continue working. This guide explains how to enable and verify MongoDB locally and in the cloud.

## 1) Choose your MongoDB

- Option A — MongoDB Atlas (recommended)
  1. Create a free Atlas cluster
  2. Create a database user and allow your IP (or 0.0.0.0/0 for testing)
  3. Copy your connection string (mongodb+srv://.../dao-management)

- Option B — Local MongoDB
  - macOS (Homebrew):
    brew services start mongodb/brew/mongodb-community
  - Ubuntu/Debian:
    sudo systemctl start mongod
  - Docker (any OS):
    docker run -d --name mongodb -p 27017:27017 mongo:7

## 2) Set environment variables

Set these on your host (local shell, Fly, Netlify, Vercel) — do not commit secrets.

Required
- JWT_SECRET — a random string >= 32 chars
- MONGODB_URI — your Mongo connection string

Recommended
- ADMIN_EMAIL — initial admin email (used to ensure a super admin exists)
- ADMIN_PASSWORD — initial admin password
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM — to enable email notifications

Optional
- SEED_USERS=true — creates a small set of demo users (development only)
- SEED_DAOS=true — seeds demo DAO data in memory (useful without Mongo)
- MONGODB_FAST_FAIL=1 — fail fast on DB connection so fallback kicks in immediately

## 3) Start the app (development)

pnpm install
pnpm dev

- Frontend: http://localhost:8080
- API:      http://localhost:3001/api/

If MongoDB is reachable, data is persisted. If not, you will see a console warning and the app will serve data from in-memory storage instead of crashing.

## 4) Verify connectivity

- Health:            GET /api/health            → 200 OK
- Auth (after login): GET /api/auth/me          → current user
- DAOs:              GET /api/dao               → { items: [], total: 0 } when empty

If you see MongooseServerSelectionError in logs:
- Ensure MongoDB is running and your MONGODB_URI is correct
- Check network/firewall settings (Atlas IP allowlist)
- Temporarily set MONGODB_FAST_FAIL=1 to avoid long timeouts while testing

## 5) Production notes

- Always set a strong JWT_SECRET (>= 32 chars)
- Set MONGODB_URI to your managed MongoDB (Atlas)
- Configure SMTP to receive login/reset notifications
- The server will never expose stack traces in production

## 6) Troubleshooting

- HTTP 500 on /api/dao
  - Usually indicates DB errors; the app now auto-fallbacks to in-memory. Verify MONGODB_URI and that MongoDB is up. With fallback you should see an empty list instead of 500.

- Login errors
  - Ensure JWT_SECRET is set
  - In dev, you can log in with the seeded users when SEED_USERS=true or with ADMIN_EMAIL/ADMIN_PASSWORD.

## 7) Seeded demo users (development)

When SEED_USERS=true, the following users are created in dev:
- admin@2snd.fr / admin123
- marie.dubois@2snd.fr / marie123
- pierre.martin@2snd.fr / pierre123

These are for local testing only; disable seeds in production.
