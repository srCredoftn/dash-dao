/**
Rôle: Repository (persistance) — src/backend-express/repositories/userRepository.ts
Domaine: Backend/Repositories
Exports: PersistedUser, UserRepository
Dépendances: @shared/dao
Liens: models (Mongo), services (métier), config DB
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import type { User } from "@shared/dao";

export interface PersistedUser extends User {
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<PersistedUser | null>;
  /** Find by email including inactive users */
  findAnyByEmail?(email: string): Promise<PersistedUser | null>;
  findById(id: string): Promise<PersistedUser | null>;
  listActive(): Promise<PersistedUser[]>;
  create(
    u: Omit<PersistedUser, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<PersistedUser>;
  updateById(
    id: string,
    updates: Partial<Omit<PersistedUser, "id" | "email" | "createdAt">>,
  ): Promise<PersistedUser | null>;
  deactivateById(id: string): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
