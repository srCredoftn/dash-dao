# MongoDB – Guide macOS (Homebrew)

## 1) Installation

- Prérequis: Homebrew installé (https://brew.sh)
- Installer le serveur MongoDB Community et le shell mongosh:

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0 mongodb-database-tools mongosh
```

- Démarrer au boot et lancer le service immédiatement:

```bash
brew services start mongodb-community@7.0
# Pour arrêter/redémarrer
# brew services stop mongodb-community@7.0
# brew services restart mongodb-community@7.0
```

Notes chemins par défaut:

- Apple Silicon: /opt/homebrew/var/mongodb (dbpath) et /opt/homebrew/etc/mongod.conf
- Intel: /usr/local/var/mongodb et /usr/local/etc/mongod.conf

## 2) Démarrer, vérifier, se connecter

```bash
# Vérifier l’état du service
brew services list | grep mongodb

# Vérifier que le port 27017 écoute
lsof -iTCP:27017 -sTCP:LISTEN

# Se connecter au shell MongoDB
mongosh --norc "mongodb://localhost:27017"
```

## 3) Créer et tester les collections DAO (daos, users, tasks)

Dans mongosh:

```javascript
use("dao-management");

// Collections (créées à l’insertion)
db.createCollection("daos");
db.createCollection("users");
db.createCollection("tasks");

// Index utiles
db.users.createIndex({ email: 1 }, { unique: true });
db.tasks.createIndex({ daoId: 1, status: 1 });
```

## 4) Commandes CRUD (insert / update / delete / find)

```javascript
use("dao-management");

// INSERT
const adminId = new ObjectId();
db.users.insertOne({
  _id: adminId,
  name: "Admin",
  email: "admin@2snd.fr",
  role: "admin",
  passwordHash: "<hash-bcrypt>", // voir section JWT pour création via API
  createdAt: new Date(),
});

const daoId = new ObjectId();
db.daos.insertOne({
  _id: daoId,
  name: "DAO Demo",
  description: "Exemple de DAO",
  ownerId: adminId,
  status: "active",
  createdAt: new Date(),
});

db.tasks.insertMany([
  {
    daoId,
    title: "Tâche 1",
    status: "todo",
    assignees: [adminId],
    createdAt: new Date(),
  },
  {
    daoId,
    title: "Tâche 2",
    status: "in_progress",
    assignees: [],
    createdAt: new Date(),
  },
]);

// READ
db.users.find({ email: "admin@2snd.fr" }).pretty();
db.daos.find({ _id: daoId }).pretty();
db.tasks.find({ daoId }).pretty();

// UPDATE
db.tasks.updateOne(
  { title: "Tâche 1" },
  { $set: { status: "done", doneAt: new Date() } },
);

// DELETE
db.tasks.deleteOne({ title: "Tâche 2" });

// Vérifications rapides
print("users:", db.users.countDocuments());
print("daos:", db.daos.countDocuments());
print("tasks:", db.tasks.countDocuments());
```

## 5) Générer un JWT après authentification

Dans cette app, l’API d’auth est disponible via:

- Dev via proxy Vite: http://localhost:8080/api/auth/login
- Direct backend: http://localhost:3001/api/auth/login

Assurez-vous dans `.env`:

```bash
USE_MONGO=true
MONGODB_URI="mongodb://localhost:27017/dao-management"
STRICT_DB_MODE=false
FALLBACK_ON_DB_ERROR=true
```

Authentification et récupération d’un token:

```bash
curl -i -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@2snd.fr","password":"admin123"}'
```

Générer un JWT en Node.js (si besoin hors API):

```javascript
// node gen-jwt.js
import jwt from "jsonwebtoken";
const secret = process.env.JWT_SECRET;
const token = jwt.sign(
  { sub: "<userId>", email: "admin@2snd.fr", role: "admin" },
  secret,
  { expiresIn: "24h" },
);
console.log(token);
```

## 6) Tester la présence des données

```javascript
use("dao-management");
show collections; // doit lister daos, users, tasks
["daos", "users", "tasks"].forEach(c => {
  const exists = db.getCollectionNames().includes(c);
  print(`${c}:`, exists ? "OK" : "MISSING");
});
```

## 7) Conseils – erreurs « recharger la page »

- Le backend envoie un en‑tête `X-Boot-Id`. Si l’ID change (reset, déploiement), le front force un rafraîchissement pour vider le cache local.
- Vérifiez `/api/boot` et la stabilité de `TOKEN_BOOT_ID`. Désactivez les resets fréquents (`TRIGGER_RESET=false`).
- Sur erreurs réseau/429, attendez quelques secondes puis réessayez.
- Videz le cache navigateur si le message persiste.

## 8) Responsive et ergonomie (grands pouces)

- Respecter des cibles tactiles ≥ 44×44 px (WCAG). Utiliser des espacements généreux et des boutons pleine largeur sur mobile.
- Tester avec Chrome DevTools (Device Toolbar), iOS/Android réels si possible.
- Éviter le contenu débordant; utiliser flex/grid et classes utilitaires (Tailwind) pour le wrapping.
- Maintenir un contraste suffisant et des tailles de police ≥ 16px.

## 9) Scripts d’auto‑test des collections

Bash (macOS):

```bash
#!/usr/bin/env bash
set -euo pipefail
mongosh --quiet --eval '
  use("dao-management");
  const must=["daos","users","tasks"];
  const have=db.getCollectionNames();
  let ok=true;
  for (const c of must){ if(!have.includes(c)){ print(`MISSING:${c}`); ok=false; } }
  if(!ok) quit(2);
'
echo "Collections OK"
```

## 10) Toutes les commandes utiles (récapitulatif)

```bash
# Installation
brew tap mongodb/brew
brew install mongodb-community@7.0 mongodb-database-tools mongosh

# Service
brew services start mongodb-community@7.0
brew services status mongodb-community@7.0 || true
brew services restart mongodb-community@7.0

# Shell
mongosh "mongodb://localhost:27017"

# App (.env)
echo 'USE_MONGO=true' >> .env
echo 'MONGODB_URI=mongodb://localhost:27017/dao-management' >> .env

# API login
curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@2snd.fr","password":"admin123"}'
```
