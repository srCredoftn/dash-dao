# ⚡️ Règles de génération de code pour Builder.io

## Objectif

Générer du code propre, maintenable, et toujours valide, en respectant la structure du projet et les standards de développement professionnels.

## Règles générales

### 1. Validité du code

- Le code doit être 100% valide, sans erreurs de syntaxe
- Toujours tester la compilation avant de livrer
- Aucun warning TypeScript non résolu

### 2. Format JSON (RFC 8259)

- Toutes les clés entre guillemets doubles
- Toutes les valeurs texte entre guillemets doubles
- Pas de `REDACTED` ni de valeurs masquées, remplacer par chaîne vide ou placeholder
- Pas de virgules en fin de tableau ou d'objet
- Indentation cohérente (2 espaces)

### 3. JavaScript/TypeScript

- Utiliser l'ESM (`import` / `export`) et non `require`
- Constantes en `const`, variables modifiables en `let`, jamais `var`
- Pas de code mort ni de variables inutilisées
- Types TypeScript stricts
- Destructuring pour les imports multiples

### 4. Organisation des fichiers

```
project/
├��─ client/           → code front-end React
├── server/           → API Express, logique back-end
├── shared/           → types et fonctions partagées
├── .builder/rules/   → règles spécifiques Builder.io
└── public/           → assets statiques
```

### 5. Conventions de nommage

- Fichiers et dossiers : `kebab-case` (`ma-fonction.ts`, `mon-composant.tsx`)
- Composants React : `PascalCase` (`UserProfile.tsx`)
- Variables et fonctions : `camelCase` (`getUserData`, `isLoading`)
- Constantes : `SCREAMING_SNAKE_CASE` (`API_BASE_URL`)
- Types et interfaces : `PascalCase` (`UserData`, `ApiResponse`)

### 6. Structure modulaire

- Chaque composant ou service dans un fichier séparé
- Index files pour les exports (`index.ts`)
- Séparation claire des responsabilités
- Réutilisabilité maximale

### 7. Documentation

- Commentaires clairs et concis pour expliquer les parties complexes
- JSDoc pour les fonctions publiques
- README pour chaque module important
- Types TypeScript comme documentation

## Standards spécifiques au projet

### Architecture React

```typescript
// ✅ Bon
import { useState, useEffect } from "react";
import type { User } from "@shared/types";

export default function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser(userId);
  }, [userId]);

  return <div>{user?.name}</div>;
}

// ❌ Mauvais
const React = require("react");
var UserProfile = function(props) {
  var user = React.useState(null)[0];
  // ...
}
```

### API Routes Express

```typescript
// ✅ Bon
import express from "express";
import type { AuthUser } from "@shared/dao";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const users = await getUsersFromDB();
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

export default router;
```

### Types partagés

```typescript
// shared/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
}

export type UserRole = "admin" | "user";
```

## Exigences de sortie

### Format de réponse

- Si un fichier est du JSON → produire uniquement le JSON valide, rien d'autre
- Si un fichier est du code → produire un code entièrement prêt à exécuter, formaté
- Toujours indiquer le chemin du fichier en commentaire

### Exemple de format attendu

```typescript
// code/client/components/UserCard.tsx
import type { User } from "@shared/dao";

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
}

export default function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-muted-foreground">{user.email}</p>
      {onEdit && (
        <button onClick={() => onEdit(user)}>
          Modifier
        </button>
      )}
    </div>
  );
}
```

## Checklist avant livraison

- [ ] Code compile sans erreur
- [ ] Pas de warnings TypeScript
- [ ] Nommage cohérent
- [ ] Imports optimisés
- [ ] Code formaté (Prettier)
- [ ] Tests passent
- [ ] Documentation à jour
- [ ] Performance acceptable
- [ ] Accessibilité respectée
- [ ] Responsive design

## Outils recommandés

- **Linter** : ESLint avec rules strictes
- **Formatter** : Prettier
- **Type checking** : TypeScript strict mode
- **Testing** : Vitest
- **Build** : Vite
- **Package manager** : pnpm

Ces règles garantissent un code de haute qualité, maintenable et évolutif pour l'équipe.
