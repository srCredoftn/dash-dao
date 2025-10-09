# MongoDB – Guide Linux

## 1) Installation

### Ubuntu/Debian (dépôt officiel MongoDB 7.0)

```bash
# Import clé et dépôt (Ubuntu 22.04 en exemple, adaptez la version si besoin)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org mongosh
```

### RHEL/CentOS/Fedora

```bash
# /etc/yum.repos.d/mongodb-org-7.0.repo
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo >/dev/null <<'REPO'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
REPO

sudo yum install -y mongodb-org mongosh || sudo dnf install -y mongodb-org mongosh
```

### Arch Linux

```bash
sudo pacman -Syu mongodb-bin mongosh
```

## 2) Démarrer, vérifier, se connecter

```bash
# Démarrage service
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérifier l’état
systemctl status mongod --no-pager

# Logs
journalctl -u mongod -n 100 --no-pager

# Se connecter au shell
mongosh "mongodb://localhost:27017"
```

## 3) Créer et tester les collections DAO (daos, users, tasks)

```javascript
use("dao-management");

db.createCollection("daos");
db.createCollection("users");
db.createCollection("tasks");

db.users.createIndex({ email: 1 }, { unique: true });
db.tasks.createIndex({ daoId: 1, status: 1 });
```

## 4) Commandes CRUD (insert / update / delete / find)

```javascript
use("dao-management");

const adminId = new ObjectId();
db.users.insertOne({
  _id: adminId,
  name: "Admin",
  email: "admin@2snd.fr",
  role: "admin",
  passwordHash: "<hash-bcrypt>",
  createdAt: new Date(),
});

const daoId = new ObjectId();
db.daos.insertOne({
  _id: daoId,
  name: "DAO Demo",
  ownerId: adminId,
  status: "active",
  createdAt: new Date(),
});

db.tasks.insertMany([
  { daoId, title: "Tâche 1", status: "todo", createdAt: new Date() },
  { daoId, title: "Tâche 2", status: "in_progress", createdAt: new Date() },
]);

db.users.find({ email: "admin@2snd.fr" }).pretty();
db.daos.find({ _id: daoId }).pretty();
db.tasks.find({ daoId }).pretty();

db.tasks.updateOne({ title: "Tâche 1" }, { $set: { status: "done" } });
db.tasks.deleteOne({ title: "Tâche 2" });

print("users:", db.users.countDocuments());
print("daos:", db.daos.countDocuments());
print("tasks:", db.tasks.countDocuments());
```

## 5) Générer un JWT après authentification

`.env` (à la racine du projet):

```bash
USE_MONGO=true
MONGODB_URI=mongodb://localhost:27017/dao-management
```

Login via API (dev):

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@2snd.fr","password":"admin123"}' | jq .
```

Node.js manuel:

```javascript
import jwt from "jsonwebtoken";
const token = jwt.sign(
  { sub: "<userId>", email: "admin@2snd.fr", role: "admin" },
  process.env.JWT_SECRET,
  { expiresIn: "24h" },
);
console.log(token);
```

## 6) Tester la présence des données

```javascript
use("dao-management");
show collections;
["daos","users","tasks"].forEach(c => print(c, db.getCollectionNames().includes(c) ? "OK" : "MISSING"));
```

## 7) Conseils – erreurs « recharger la page »

- Le front détecte un changement de `X-Boot-Id` (reset/déploiement) et force le rechargement pour purger le cache.
- Vérifier `/api/boot`, `TRIGGER_RESET=false`, stabilité de `TOKEN_BOOT_ID`.
- En cas de 429 ou de perte réseau, patienter avant de réessayer; vider le cache si besoin.

## 8) Responsive et confort mobile

- Cibles tactiles ≥ 44×44 px, zones d’action espacées, boutons pleine largeur sur mobile.
- Tester avec `Ctrl+Shift+M` (Firefox) ou Device Toolbar (Chrome/Edge).
- Utiliser des grilles flexibles, images fluides, et éviter les débordements horizontaux.

## 9) Script d’auto‑test (bash)

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

## 10) Récapitulatif

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
mongosh "mongodb://localhost:27017"

# API login test
curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@2snd.fr","password":"admin123"}'
```
