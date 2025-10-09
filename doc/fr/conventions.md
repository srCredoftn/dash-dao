# Conventions & bonnes pratiques

Général

- TypeScript partout. Pas d'`any` inutile. Noms explicites.
- Importer les types métier via `@shared/dao`.
- Ne pas stocker de secrets en clair (ni logs). Jamais commit de .env.

Frontend

- Toujours passer par apiService/authService pour les requêtes.
- Gérer 401 -> redirection /login (déjà géré). Pas de duplication de logique d'auth.
- Composants UI découplés (./components/ui) et pages simples. Utiliser `cn()`.
- Tailwind: classes utilitaires, tokens dans global.css, pas d'inline style.
- Découper les gros composants (voir règle organize-ui) et favoriser la lisibilité.

Backend

- Valider toutes entrées (Zod). Nettoyer les chaînes (sanitizeString) si nécessaire.
- Respecter la séparation routes/services/repositories.
- Journaliser avec utils/logger (audit pour actions sensibles).
- Ne pas exposer d'infos sensibles dans les messages d'erreur.
- Idempotence: utiliser `x-idempotency-key` pour opérations sensibles (création user/DAO/…)

Sécurité

- JWT court (JWT_EXPIRES_IN) + refresh httpOnly sur /api/auth/refresh.
- CORS restrictif en prod (FRONTEND_URL).

Tests & Qualité

- Vitest pour unités, Playwright pour E2E.
- ESLint + Prettier en CI locale (pnpm lint, pnpm format.fix).

Performances

- manualChunks Vite, imports dynamiques, caches client (TTL courts en prod).
- Eviter les rerenders inutiles, debounce sur inputs intensifs.

Process contributions

- Branches descriptives, PR petites et ciblées, description claire.
- Ajouter/mettre à jour la doc FR si vous touchez à l'architecture.
