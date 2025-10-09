# Backends Disponibles

## 🔧 Backend Principal (Recommandé)

**Dossier :** `backend-express/`

### Caractéristiques :

- ✅ **Intégré avec Vite** : Développement unifié sur port 8080
- ✅ **Hot reload complet** : Frontend + Backend simultané
- ✅ **Types partagés** : Synchronisation automatique via `shared/`
- ✅ **Stockage en mémoire** : Données persistantes en session
- ✅ **API RESTful complète** : CRUD pour DAOs, utilisateurs, commentaires
- ✅ **Authentification** : Système de login/logout fonctionnel

### Technologies :

- Express.js
- TypeScript
- Sessions en mémoire
- CORS configuré

### Utilisation :

```bash
pnpm dev  # Lance frontend + backend ensemble
```

### Endpoints disponibles :

- `GET /api/dao` - Liste des DAOs
- `POST /api/dao` - Créer un DAO
- `PUT /api/dao/:id` - Modifier un DAO
- `DELETE /api/dao/:id` - Supprimer un DAO
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/comments/:daoId/:taskId` - Commentaires d'une tâche

---

## 🗄️ Backend MongoDB (Alternative)

**Dossier :** `backend-mongodb/`

### Caractéristiques :

- 🔶 **Standalone** : Serveur indépendant sur port 5000
- 🔶 **MongoDB + Mongoose** : Base de données persistante
- 🔶 **Sécurité avancée** : Helmet, compression
- 🔶 **API complète** : Authentification JWT, validation Zod
- 🔶 **Production ready** : Logging, gestion d'erreurs

### Technologies :

- Express.js
- MongoDB + Mongoose
- JWT Authentication
- Bcrypt (hash mots de passe)
- Zod (validation)
- Helmet (sécurité)

### Configuration nécessaire :

1. Installer MongoDB
2. Configurer `.env` :
   ```
   MONGODB_URI=mongodb://localhost:27017/dao-management
   JWT_SECRET=your-super-secret-key
   FRONTEND_URL=http://localhost:3000
   ```

### Utilisation :

```bash
cd backend-mongodb
pnpm install
pnpm dev  # Lance sur port 5000
```

### Endpoints disponibles :

- `GET /api/dao` - Liste des DAOs
- `POST /api/dao` - Créer un DAO
- `PUT /api/dao/:id` - Modifier un DAO
- `DELETE /api/dao/:id` - Supprimer un DAO
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion JWT
- `GET /api/users` - Liste des utilisateurs (admin)

---

## 🎯 Recommandation

**Utilisez `backend-express/`** pour :

- ✅ Développement rapide
- ✅ Prototypage
- ✅ Applications petites/moyennes
- ✅ Quand vous voulez tout en un

**Utilisez `backend-mongodb/`** pour :

- 🔶 Applications en production
- 🔶 Données persistantes critiques
- 🔶 Authentification robuste
- 🔶 Équipes multiples (frontend/backend séparées)

---

## 🔄 Migration

Pour migrer du backend Express vers MongoDB :

1. **Démarrer MongoDB :**

   ```bash
   cd backend-mongodb
   pnpm install
   cp .env.example .env  # Configurer les variables
   pnpm dev
   ```

2. **Modifier le frontend :**
   - Changer l'URL de base API de `http://localhost:8080/api` vers `http://localhost:5000/api`
   - Ajouter la gestion des tokens JWT
   - Adapter les calls API si nécessaire

3. **Données :**
   - Importer les DAOs existants via l'API
   - Créer les utilisateurs admin
   - Configurer les permissions

Le frontend actuel est compatible avec les deux backends !
