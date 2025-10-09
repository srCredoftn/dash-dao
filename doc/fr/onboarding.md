# Onboarding développeur (FR)

Prérequis

- Node 18+ / 20+, pnpm.
- (Optionnel) MongoDB si vous voulez la persistance.

Installation

1. pnpm install
2. Définir les variables d'env (voir README et architecture.md) — utilisez l'UI d'environnement quand dispo (éviter .env commité).
3. pnpm dev — Frontend sur 8080, Backend sur 3001 (proxy /api configuré côté Vite).

Comptes & Auth

- En dev, un admin est créé via ADMIN_EMAIL/ADMIN_PASSWORD (ou SEED_USERS=true pour users de démo).
- Connexion: écran /login (email + mot de passe). Token d'accès court, refresh httpOnly.

Flux de travail

- Ajouter un type? src/shared/dao.ts
- Ajouter une page? src/frontend/pages + route dans AppContent
- Appeler l'API? src/frontend/services/api.ts (ou authService pour /auth)
- Ajouter une route backend? src/backend-express/routes + enregistrement dans index.ts
- Accéder au repo données: services -> repositories (mémoire/Mongo)

Commande utiles

- pnpm dev, pnpm build, pnpm start
- pnpm typecheck, pnpm test, pnpm test:watch
- pnpm format.fix, pnpm lint

Debug

- /api/health, /api/boot
- Ctrl+Shift+C sur Index.tsx pour purger cache local côté app (dev).
- Logs backend: démarrage, audit, erreurs formatées.

Déploiement

- Voir deploiement.md (Netlify/Vercel via MCP). Pour un partage rapide non prod: utilisez [Open Preview](#open-preview).

Bonnes pratiques

- Suivez conventions.md. Ajoutez tests pour la logique critique. Validez strictement les entrées.
