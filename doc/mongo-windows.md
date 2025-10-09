# MongoDB – Guide Windows

## 1) Installation

Méthode 1 – Winget (recommandé):

```powershell
winget install --id MongoDB.Server -e
winget install --id MongoDB.Shell -e
```

Méthode 2 – Chocolatey:

```powershell
choco install mongodb --version=7.0.14 -y
choco install mongosh -y
```

Méthode 3 – MSI officiel:

- Télécharger « MongoDB Community Server » et « mongosh » depuis https://www.mongodb.com/try/download/community
- Suivre l’installateur (ajouter au PATH, service en automatique).

## 2) Démarrer, vérifier, se connecter

```powershell
# Démarrer/arrêter/redémarrer le service
Start-Service -Name "MongoDB"
# Stop-Service -Name "MongoDB"
# Restart-Service -Name "MongoDB"

# Démarrage automatique
Set-Service -Name "MongoDB" -StartupType Automatic

# Vérifier l’état
Get-Service -Name "MongoDB"

# Se connecter au shell
mongosh "mongodb://localhost:27017"
```

## 3) Créer et tester les collections DAO (daos, users, tasks)

Dans mongosh:

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

// READ
db.users.find({ email: "admin@2snd.fr" }).pretty();
db.daos.find({ _id: daoId }).pretty();
db.tasks.find({ daoId }).pretty();

// UPDATE
db.tasks.updateOne({ title: "Tâche 1" }, { $set: { status: "done" } });

// DELETE
db.tasks.deleteOne({ title: "Tâche 2" });

print("users:", db.users.countDocuments());
print("daos:", db.daos.countDocuments());
print("tasks:", db.tasks.countDocuments());
```

## 5) Générer un JWT après authentification

API dev via Vite proxy: http://localhost:8080/api/auth/login

```powershell
$body = @{ email = "admin@2snd.fr"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login" -ContentType "application/json" -Body $body
```

Node.js (manuel):

```javascript
// node gen-jwt.js
import jwt from "jsonwebtoken";
const token = jwt.sign(
  { sub: "<userId>", email: "admin@2snd.fr", role: "admin" },
  process.env.JWT_SECRET,
  { expiresIn: "24h" },
);
console.log(token);
```

`.env` requis:

```text
USE_MONGO=true
MONGODB_URI=mongodb://localhost:27017/dao-management
```

## 6) Tester la présence des données

```javascript
use("dao-management");
show collections;
["daos","users","tasks"].forEach(c => print(c, db.getCollectionNames().includes(c) ? "OK" : "MISSING"));
```

## 7) Conseils – erreurs « recharger la page »

- L’ID de boot (`X-Boot-Id`) change → le front demande de recharger pour vider le cache.
- Éviter les resets fréquents (TRIGGER_RESET=false) et stabiliser `TOKEN_BOOT_ID`.
- En cas d’erreurs réseau/429, attendre puis réessayer; vider le cache si besoin.

## 8) Responsive et confort mobile (grands pouces)

- Cibles tactiles ≥ 44×44 px, boutons larges, marges généreuses.
- Tester avec Outils de développement Edge/Chrome (mode appareil).
- Police ≥ 16px, contraste suffisant, évitez le zoom forcé.

## 9) Script d’auto‑test (PowerShell)

```powershell
$script = @'
use("dao-management");
const must=["daos","users","tasks"]; const have=db.getCollectionNames();
let ok=true; for (const c of must){ if(!have.includes(c)){ print("MISSING:"+c); ok=false; } }
if(!ok) quit(2);
'@

# Exécute mongosh en mode silencieux et échoue si collections manquantes
mongosh --quiet --eval $script
if ($LASTEXITCODE -ne 0) { Write-Error "Collections manquantes"; exit 2 } else { Write-Host "Collections OK" }
```

## 10) Récapitulatif commandes

```powershell
# Service
Start-Service -Name "MongoDB"
Set-Service -Name "MongoDB" -StartupType Automatic
Get-Service -Name "MongoDB"

# Shell
mongosh "mongodb://localhost:27017"

# API login
$body = @{ email = "admin@2snd.fr"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login" -ContentType "application/json" -Body $body
```
