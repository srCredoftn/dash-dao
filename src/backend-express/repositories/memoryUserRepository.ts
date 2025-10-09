/**
Rôle: Repository (persistance) — src/backend-express/repositories/memoryUserRepository.ts
Domaine: Backend/Repositories
Exports: MemoryUserRepository, __memoryUsers
Dépendances: ./userRepository
Liens: models (Mongo), services (métier), config DB
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import type { PersistedUser, UserRepository } from "./userRepository";

const users: PersistedUser[] = [];

function genId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class MemoryUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<PersistedUser | null> {
    return (
      users.find(
        (u) => u.isActive && u.email.toLowerCase() === email.toLowerCase(),
      ) || null
    );
  }
  async findAnyByEmail(email: string): Promise<PersistedUser | null> {
    return (
      users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
    );
  }
  async findById(id: string): Promise<PersistedUser | null> {
    return users.find((u) => u.isActive && u.id === id) || null;
  }
  async listActive(): Promise<PersistedUser[]> {
    return users.filter((u) => u.isActive);
  }
  async create(
    u: Omit<PersistedUser, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<PersistedUser> {
    const doc: PersistedUser = {
      id: u.id || genId(),
      name: u.name,
      email: u.email.toLowerCase(),
      role: u.role,
      createdAt: u.createdAt || new Date().toISOString(),
      isActive: true,
      isSuperAdmin: Boolean(u.isSuperAdmin),
      passwordHash: u.passwordHash,
      lastLogin: u.lastLogin,
    };
    // Faire respecter l’unicité de l’email (actif)
    const existingIdx = users.findIndex(
      (x) => x.isActive && x.email.toLowerCase() === doc.email.toLowerCase(),
    );
    if (existingIdx !== -1) {
      // Fusionner/mettre à jour l’existant plutôt que créer un doublon
      users[existingIdx] = {
        ...users[existingIdx],
        ...doc,
        id: users[existingIdx].id,
        createdAt: users[existingIdx].createdAt,
      };
      return users[existingIdx];
    }
    users.push(doc);
    return doc;
  }
  async updateById(
    id: string,
    updates: Partial<Omit<PersistedUser, "id" | "email" | "createdAt">>,
  ): Promise<PersistedUser | null> {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    return users[idx];
  }
  async deactivateById(id: string): Promise<boolean> {
    const u = users.find((x) => x.id === id && x.isActive);
    if (!u) return false;
    u.isActive = false;
    return true;
  }
  async deleteById(id: string): Promise<boolean> {
    const idx = users.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    return true;
  }
  async deleteAll(): Promise<void> {
    users.splice(0, users.length);
  }
}

export function __memoryUsers() {
  return users;
}
