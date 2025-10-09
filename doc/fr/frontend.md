# Frontend (React + Vite + Tailwind)

Points d'entrée

- src/frontend/main.tsx: redaction console en prod, nettoyage stockage premier run, vérification /api/boot, HMR, rendu App.
- src/frontend/App.tsx: providers (React Query, Router, Auth, Notifications), ErrorBoundary, AppContent.

Routage

- React Router 6, pages dans src/frontend/pages/ (Index.tsx, Login.tsx, ForgotPassword.tsx, DaoDetail.tsx, Admin\*...).
- AppHeader, OptimizedDaoCard et composants UI dans src/frontend/components/.

État & données

- TanStack Query pour requêtes/invalidations si besoin (queryClient déjà instancié).
- AuthContext (src/frontend/contexts/AuthContext.tsx):
  - login(credentials) / logout()
  - isAuthenticated, isAdmin(), hasRole(), canEdit()
  - Restauration sur boot si token valide, re-check périodique si souci réseau.

Services côté client

- apiService (src/frontend/services/api.ts):
  - request<T>() gère Authorization, idempotency, erreurs réseau, 401 (refresh), redirections.
  - DAOs: getAllDaos, getDaoById, createDao, updateDao, deleteDao (désactivé côté serveur), getNextDaoNumber, deleteLastDao, getLastDao.
  - Cache local léger via cacheService (invalidate, getOrSet, TTL).
- authService (src/frontend/services/authService.ts):
  - API /api/auth: login/logout/me/users/... avec refresh automatique si 401.
  - Stockage par onglet via utils/auth-storage (évite fuites inter-onglets).
  - startTabSession() pour scoper la session.

UI & Style

- TailwindCSS + Radix UI; tokens dans src/frontend/global.css et configuration dans tailwind.config.ts.
- Composants UI (src/frontend/components/ui/\*): Button, Card, Input, Label, Badge, Progress, etc.
- Utilitaires: cn() (merge classes), responsive utils, GRID_CLASSES.

Pages clés

- Login.tsx: formulaire accessible, validation simple, préchargement paresseux des routes fréquentes, feedback erreurs clair.
- Index.tsx: liste des DAO, stats globales, recherche + filtres, export global, création DAO (admin), raccourcis dev (Ctrl+Shift+T/C).
- DaoDetail.tsx: détail d'un DAO (tâches, commentaires, progression, assignations) — voir composants associés.

Accessibilité & UX

- Boutons/inputs labellisés, aria-label pour toggle password, messages d'erreur explicites, skeletons sur chargements.
- Animations minimales, désactivations ciblées pour éviter les clignotements (global.css).

Performance

- Découpage manuel de bundles (vite.config.ts -> manualChunks).
- Imports dynamiques pour écrans secondaires, debounce saisies de recherche.
- Caches courts côté client pour éviter surcharge serveur en prod.

Bonnes pratiques frontend

- Ne jamais stocker de secrets; préférer les services et le backend.
- Toujours passer par apiService/authService (timeouts, retries, 401, idempotency).
- En cas de 401, vérifier que l'utilisateur est redirigé vers /login (géré automatiquement).
- Utiliser @shared/dao pour les types (Dao, DaoTask, AuthUser...).
