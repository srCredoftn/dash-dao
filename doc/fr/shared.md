# Types partagés (src/shared)

Fichiers

- src/shared/dao.ts: types métier côté DAO, tâches, utilisateurs, auth; helpers de calcul.
- src/shared/api.ts: exemples d'interface de réponse (DemoResponse) pour /api/demo.

Types principaux (dao.ts)

- TeamMember: { id, name, role: 'chef_equipe'|'membre_equipe', email? }
- DaoTask: { id, name, progress|null, comment?, comments?, isApplicable, assignedTo?, lastUpdatedBy?, lastUpdatedAt? }
- Dao: { id, numeroListe, objetDossier, reference, autoriteContractante, dateDepot, equipe[], tasks[], createdAt, updatedAt }
- User, AuthUser, LoginCredentials, AuthResponse, UserRole
- DEFAULT_TASKS: liste de tâches par défaut pour toute création de DAO

Fonctions utilitaires

- calculateDaoStatus(dateDepot, progress): 'completed' | 'urgent' | 'safe' | 'default'
- calculateDaoProgress(tasks): moyenne des progress des tâches applicables (arrondie)

Bonnes pratiques

- Toujours importer les types depuis `@shared/dao` pour synchroniser frontend/backend.
- Étendre ici si de nouveaux contrats d'API sont introduits (ex: payloads/DTOs).
