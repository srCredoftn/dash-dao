# Backend Express (API REST)

Entrées principales

- src/backend-express/server.ts: lance le serveur (PORT=3001 par défaut).
- src/backend-express/index.ts: configuration Express et enregistrement des routes.

Middlewares et sécurité

- helmet: en-têtes de sécurité, CSP adaptée au dev.
- CORS: permissif en dev, restrictif en prod (FRONTEND_URL).
- Logging: utils/logger (audit, warn, error) + requestLogger.
- Validation Zod sur payloads sensibles (auth, dao, tasks).

Routes

- /api/health, /api/boot, /api/ping, /api/demo
- /api/auth (routes/auth.ts):
  - POST /login: JWT d'accès + cookie refresh httpOnly; notifications.
  - POST /refresh: rafraîchit le token; rotation refresh.
  - POST /logout: révoque session (access/refresh), message utilisateur.
  - GET /me: retourne l'utilisateur courant.
  - GET /users (admin), POST /users (admin + idempotence), PUT /users/:id/role (super admin + password), DELETE /users/:id (super admin + password)
  - POST /change-password, PUT /profile (changement email interdit),
  - POST /forgot-password, /verify-reset-token, /reset-password (emails si SMTP configuré).
- /api/dao (routes/dao-simple.ts):
  - GET /: filtre/tri/pagination; GET /:id; GET /next-number
  - POST / (admin, idempotence mémoire): création DAO (normalise chaînes, tâches par défaut @shared/dao)
  - PUT /:id (rôles: chef_equipe ou admin; admin non chef ne peut pas modifier progression/applicabilité/assignation en masse)
  - DELETE /:id désactivé (403)
  - GET /admin/verify-integrity, GET /admin/last, DELETE /admin/delete-last (admin)
  - PUT /:id/tasks/reorder (chef_equipe ou admin)
  - PUT /:id/tasks/:taskId (chef_equipe ou admin; admin non chef limité)
- /api/dao/:daoId/tasks (routes/tasks.ts): création/rename tâches (admin ou leader), suppression désactivée.
- /api/comments (routes/comments.ts): CRUD restreint, notifications + emails.
- /api/notifications (routes/notifications.ts): listing, read, read-all.
- /api/admin (routes/admin.ts): reset-app, sessions, revoke-session, delete-last-dao.

Services

- AuthService: JWT, refresh tokens httpOnly, users en mémoire/Mongo, reset tokens, sessions, reinitializeUsers(), clearAllSessions().
- DaoService: gestion DAO, numérotation "DAO-YYYY-XXX" monotone par année, pagination côté repo, purge clearAll().
- NotificationService & Templates: diffusion en mémoire + emails via txEmail (SMTP optionnel, robuste aux échecs).

Données & Repositories

- Mémoire par défaut (Memory\*Repository). Mongo activable via USE_MONGO/MONGODB_URI.
- Modèles Mongoose: src/backend-express/models/\*.ts (User, Dao, Comment, ...).

Erreurs & journalisation

- Handler global renvoie { error, timestamp }. Statuts 4xx pour entrées invalides, 5xx sinon.
- Logs audit pour opérations sensibles (création, update, reset...).

Reset & bootId

- TRIGGER_RESET=true: purge DAOs/notifications/sessions au démarrage + rotation bootId.
- /api/admin/reset-app: réinit à chaud; en prod: JWT admin requis.
