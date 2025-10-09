# Structure du Projet DAO Management

## 📁 Architecture Actuelle (Recommandée)

Le projet utilise actuellement une architecture **monorepo intégrée** avec Vite qui est parfaitement fonctionnelle :

```
├── client/                    # 🎨 Frontend React + TypeScript
│   ├── components/           # Composants réutilisables
│   ├── pages/               # Pages de l'application
│   ├── contexts/            # Contextes React (Auth, Notifications)
│   ├── hooks/               # Hooks personnalisés
│   ├── services/            # Services API
│   └── types/               # Types TypeScript
│
├── server/                   # 🔧 Backend Express intégré
│   ├── routes/              # Routes API
│   ├── models/              # Modèles de données
│   ├── services/            # Services métier
│   └── middleware/          # Middlewares Express
│
├── shared/                   # 🔗 Types partagés frontend/backend
└── package.json             # Configuration monorepo avec PNPM
```

### ✅ Avantages de cette structure :

- **Développement unifié** : Un seul serveur sur le port 8080
- **Hot reload complet** : Frontend ET backend
- **Types partagés** : Synchronisation automatique
- **Déploiement simple** : Un seul build
- **Performance optimale** : Pas de latence réseau entre frontend/backend

## 📁 Structure Alternative (MongoDB)

Il existe aussi un backend MongoDB séparé dans `backend/` :

```
├── backend/                  # 🗄️ Backend MongoDB standalone
│   ├── src/
│   │   ├── models/          # Modèles Mongoose
│   │   ├── routes/          # Routes Express
│   │   ├── middleware/      # Auth, logging, errors
│   │   └── config/          # Configuration DB
│   └── package.json         # Backend indépendant
│
└── frontend/                 # ⚠️ Dossier incomplet (à nettoyer)
```

## 🎯 Recommandation

**Continuer avec la structure actuelle** (`client/` + `server/`) car :

1. ✅ Fonctionne parfaitement
2. ✅ Plus simple à maintenir
3. ✅ Meilleure expérience développeur
4. ✅ Types synchronisés automatiquement
5. ✅ Un seul serveur de développement

## 🧹 Nettoyage Nécessaire

Pour clarifier la structure, il faut :

1. 🗑️ Supprimer le dossier `frontend/` vide
2. 📝 Documenter l'utilisation du backend MongoDB si nécessaire
3. 🏷️ Renommer `client/` → `frontend/` si souhaité
4. 🏷️ Renommer `server/` → `backend/` si souhaité

## 🚀 Structure Idéale (après nettoyage)

```
├── frontend/                 # 🎨 Frontend React (ex-client/)
├── backend/                  # 🔧 Backend Express (ex-server/)
├── shared/                   # 🔗 Types partagés
└── package.json             # Configuration monorepo
```

Cette structure respecte la demande de l'utilisateur tout en conservant la fonctionnalité existante.
