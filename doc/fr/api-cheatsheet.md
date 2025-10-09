# API Cheatsheet (référence rapide)

Auth (/api/auth)

- POST /login { email, password } -> { user, token } + cookie refresh
- POST /refresh -> { token, user }
- POST /logout (Authorization: Bearer)
- GET /me (Authorization)
- GET /users (admin)
- POST /users (admin) { name, email, role, password? } (idempotence: x-idempotency-key)
- PUT /users/:id/role (super admin + password)
- DELETE /users/:id (super admin + password, hard?mode=hard)
- POST /change-password { newPassword }
- PUT /profile { name } (changement email interdit)
- POST /forgot-password { email }
- POST /verify-reset-token { email, token }
- POST /reset-password { email, token, newPassword }

DAO (/api/dao)

- GET /?search=&autorite=&sort=&order=asc|desc&page=1&pageSize=20
- GET /next-number
- GET /:id
- POST / (admin) { numeroListe, objetDossier, reference, autoriteContractante, dateDepot, equipe[], tasks? } (idempotence: x-idempotency-key)
- PUT /:id (chef_equipe ou admin; restrictions admin non leader sur tâches)
- DELETE /:id -> 403 (désactivé)
- GET /admin/verify-integrity (admin)
- GET /admin/last (admin)
- DELETE /admin/delete-last (admin)

Tâches (/api/dao/:daoId/tasks)

- POST / { name, isApplicable, progress|null, comment?, assignedTo? } (admin)
- PUT /:taskId/name { name } (admin)
- PUT ../:daoId/tasks/reorder { taskIds: number[] } (leader/admin)
- PUT ../:daoId/tasks/:taskId { progress?, comment?, isApplicable?, assignedTo? } (leader/admin; limitations admin non leader)

Commentaires (/api/comments)

- GET /dao/:daoId
- GET /dao/:daoId/task/:taskId
- POST / { daoId, taskId, content }
- PUT /:id { content }
- DELETE /:id

Notifications (/api/notifications)

- GET /
- PUT /:id/read
- PUT /read-all

Admin (/api/admin)

- POST /reset-app { rotateBootId?: boolean, seedDaos?: boolean } (prod: admin JWT requis)
- GET /sessions (prod: admin JWT requis)
- POST /revoke-session { token } (prod: admin JWT requis)
- DELETE /delete-last-dao { password } (admin + super admin password)
