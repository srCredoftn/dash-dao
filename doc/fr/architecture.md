# Architecture générale

Vue d'ensemble

- Monorepo avec trois espaces principaux:
  - Frontend SPA: src/frontend/
  - Backend Express: src/backend-express/
  - Types partagés: src/shared/
- Outils: Vite (frontend), Express (backend), TypeScript partout, TailwindCSS + Radix UI, React Router 6, TanStack Query.
- Dev: deux serveurs (Vite sur 8080 avec proxy /api vers 3001). Commande: `pnpm dev`.
- Build prod: `pnpm build` (client + serveur), démarrage: `pnpm start`.

Résolution des chemins

- Alias Vite:
  - @ -> ./src/frontend
  - @shared -> ./src/shared
- Attention: importez les types via `@shared/...`.

Flux principal côté frontend

1. src/frontend/main.tsx: nettoyage première exécution, vérification /api/boot (bootId) pour invalider localStorage en cas de redéploiement, rendu <App/>.
2. src/frontend/App.tsx: QueryClientProvider, BrowserRouter, AuthProvider, NotificationProvider, AppContent.
3. Pages dans src/frontend/pages/, routes configurées dans AppContent.

Sécurité & caches côté client

- Données sensibles nettoyées au premier run et lors d'un bootId différent (cf. /api/boot + clé localStorage boot_id_v1).
- Auth stockée par onglet via utils/auth-storage. Redirections auto en 401.
- fetch sécurisé via utils/secure-fetch avec timeouts/retries contrôlés.

Backend Express (src/backend-express)

- src/backend-express/server.ts: démarre le serveur (port 3001 par défaut).
- src/backend-express/index.ts: configuration Express, middlewares de sécurité (helmet, CORS), logs, routes, gestion erreurs, endpoint /api/boot et /api/health.
- Routes:
  - /api/auth: login/refresh/logout/me/users/... (auth.ts)
  - /api/dao: CRUD sécurisé DAO + filtrage/pagination (dao-simple.ts)
  - /api/dao/.../tasks: gestion des tâches d'un DAO (tasks.ts)
  - /api/comments: commentaires par tâche (comments.ts)
  - /api/notifications: notifications (notifications.ts)
  - /api/admin: reset-app, sessions, revoke-session, delete-last-dao (admin.ts)
- Services:
  - AuthService: JWT, refresh tokens httpOnly, sessions en mémoire, utilisateurs (repo mémoire ou Mongo).
  - DaoService: DAO (repo mémoire ou Mongo), génération séquentielle sécurisée de `numeroListe`.
- Repositories: mémoire (par défaut) ou Mongo (si USE_MONGO/MONGODB_URI valides). Fallback propre selon config.

Variables d'environnement clés

- JWT_SECRET (obligatoire, >=32 chars)
- ADMIN_EMAIL / ADMIN_PASSWORD (création admin initial)
- SEED_USERS, SEED_DAOS, TRIGGER_RESET
- MONGODB_URI, USE_MONGO, STRICT_DB_MODE, FALLBACK_ON_DB_ERROR
- SMTP\_\* pour emails (optionnel)

Boot, reset et cohérence client

- /api/boot expose un bootId (X-Boot-Id en header + JSON). Le frontend purge les caches si ce bootId change.
- TRIGGER_RESET=true: au démarrage, purge des DAOs/notifications/sessions et rotation du bootId.
- /api/admin/reset-app: réinitialisation à chaud (en prod: admin JWT requis).

Sécurité

- helmet, CORS restrictif en prod, validation Zod sur toutes entrées sensibles, audit logging.
- Auth: JWT d'accès court (JWT_EXPIRES_IN), refresh token httpOnly (cookie sur /api/auth/refresh).

Tests & qualité

- Vitest pour tests unitaires, e2e avec Playwright (e2e/), ESLint + Prettier.
