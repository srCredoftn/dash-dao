/**
Rôle: Repository (persistance) — src/backend-express/repositories/daoRepository.ts
Domaine: Backend/Repositories
Exports: DaoQueryOptions, DaoRepository
Dépendances: @shared/dao
Liens: models (Mongo), services (métier), config DB
*/
import type { Dao } from "@shared/dao";

export type DaoQueryOptions = {
  search?: string;
  autorite?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/**
 * Abstraction de dépôt (Repository) pour l’entité Dao.
 * Implémentations : MemoryDaoRepository et MongoDaoRepository
 */
export interface DaoRepository {
  findAll(): Promise<Dao[]>;
  findById(id: string): Promise<Dao | null>;
  findAndPaginate(
    opts: DaoQueryOptions,
  ): Promise<{ items: Dao[]; total: number }>;
  findByNumeroYear(year: number | string): Promise<Dao[]>;
  getLastCreated(): Promise<Dao | null>;
  count(): Promise<number>;

  insert(dao: Dao): Promise<Dao>;
  insertMany(daos: Dao[]): Promise<void>;
  update(id: string, updates: Partial<Dao>): Promise<Dao | null>;
  deleteById(id: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}
