# 🚀 Guide de référence rapide - Standards Builder.io

## Structure de fichiers

```
project/
├── client/components/ui/     → Composants UI réutilisables
├── client/pages/            → Pages de l'application
├── client/services/         → Services et API calls
├── client/hooks/            → Custom hooks React
├── server/routes/           → Routes Express API
├── server/services/         → Logique métier serveur
├── shared/                  → Types et utils partagés
└── .builder/rules/          → Règles et configurations
```

## Imports recommandés

### React Components

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@shared/dao";
```

### API Routes

```typescript
import express from "express";
import { AuthService } from "../services/authService";
import type { LoginCredentials } from "@shared/dao";
```

## Patterns courants

### Composant React avec props typées

```typescript
interface ComponentProps {
  title: string;
  user?: User;
  onSave: (data: FormData) => void;
}

export default function MyComponent({ title, user, onSave }: ComponentProps) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-4">
      <h1>{title}</h1>
      {user && <UserCard user={user} />}
    </div>
  );
}
```

### Hook personnalisé

```typescript
export function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await apiService.getUser(userId);
        setUser(userData);
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userId]);

  return { user, loading };
}
```

### Route API avec gestion d'erreurs

```typescript
router.post("/users", authenticate, async (req, res) => {
  try {
    const userData = req.body;

    if (!userData.email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const newUser = await UserService.create(userData);
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});
```

### Service avec types

```typescript
class ApiService {
  private baseUrl = "/api";

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${this.baseUrl}/users`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create user");
    }

    return response.json();
  }
}

export const apiService = new ApiService();
```

## Checklist rapide

- [ ] ✅ Imports ESM (`import`/`export`)
- [ ] ✅ Types TypeScript définis
- [ ] ✅ `const`/`let` au lieu de `var`
- [ ] ✅ Nommage en camelCase/PascalCase
- [ ] ✅ Gestion d'erreurs appropriée
- [ ] ✅ Pas de variables inutilisées
- [ ] ✅ Props React typées
- [ ] ✅ JSON valide (pas de virgules finales)
- [ ] ✅ Commentaires clairs si complexe
- [ ] ✅ Responsive et accessible

## Commandes utiles

```bash
# Vérifier le code
pnpm typecheck
pnpm format.fix

# Tester
pnpm test

# Build
pnpm build
```
