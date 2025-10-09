/**
Rôle: Repository (persistance) — src/backend-express/repositories/memoryDaoRepository.ts
Domaine: Backend/Repositories
Exports: MemoryDaoRepository
Dépendances: @shared/dao, ../data/daoStorage, ./daoRepository
Liens: models (Mongo), services (métier), config DB
*/
import type { Dao } from "@shared/dao";
import { daoStorage } from "../data/daoStorage";
import type { DaoRepository, DaoQueryOptions } from "./daoRepository";

export class MemoryDaoRepository implements DaoRepository {
  async findAll(): Promise<Dao[]> {
    return daoStorage.getAll().slice();
  }

  async findById(id: string): Promise<Dao | null> {
    return daoStorage.findById(id) || null;
  }

  async getLastCreated(): Promise<Dao | null> {
    const list = daoStorage.getAll().slice();
    if (!list.length) return null;
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list[0];
  }

  async count(): Promise<number> {
    return daoStorage.size();
  }

  async findAndPaginate(
    opts: DaoQueryOptions,
  ): Promise<{ items: Dao[]; total: number }> {
    const {
      search,
      autorite,
      dateFrom,
      dateTo,
      sort = "updatedAt",
      order = "desc",
      page = 1,
      pageSize = 20,
    } = opts || {};

    let list = daoStorage.getAll().slice();

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((d) => {
        return (
          (d.numeroListe && d.numeroListe.toLowerCase().includes(q)) ||
          (d.objetDossier && d.objetDossier.toLowerCase().includes(q)) ||
          (d.reference && d.reference.toLowerCase().includes(q)) ||
          (d.autoriteContractante &&
            d.autoriteContractante.toLowerCase().includes(q))
        );
      });
    }

    if (autorite && autorite.trim()) {
      const a = autorite.trim();
      list = list.filter((d) => d.autoriteContractante === a);
    }

    if (dateFrom || dateTo) {
      let fromTs = dateFrom ? Date.parse(dateFrom) : -Infinity;
      let toTs = dateTo ? Date.parse(dateTo) : Infinity;
      if (isNaN(fromTs)) fromTs = -Infinity;
      if (isNaN(toTs)) toTs = Infinity;
      list = list.filter((d) => {
        const t = d.dateDepot ? Date.parse(d.dateDepot) : NaN;
        if (isNaN(t)) return false;
        return t >= fromTs && t <= toTs;
      });
    }

    const direction = order === "asc" ? 1 : -1;
    list.sort((a: any, b: any) => {
      const av = (a as any)[sort] || "";
      const bv = (b as any)[sort] || "";
      if (typeof av === "string" && typeof bv === "string")
        return direction * av.localeCompare(bv);
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });

    const total = list.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const items = list.slice(start, start + pageSize);

    return { items, total };
  }

  async findByNumeroYear(year: number | string): Promise<Dao[]> {
    const prefix = `DAO-${String(year)}-`;
    return daoStorage.getAll().filter((d) => d.numeroListe.startsWith(prefix));
  }

  async insert(dao: Dao): Promise<Dao> {
    daoStorage.add(dao);
    return dao;
  }

  async insertMany(daos: Dao[]): Promise<void> {
    for (const d of daos) daoStorage.add(d);
  }

  async update(id: string, updates: Partial<Dao>): Promise<Dao | null> {
    const idx = daoStorage.findIndexById(id);
    if (idx === -1) return null;
    const existing = daoStorage.findById(id)!;
    const updated: Dao = { ...existing, ...updates } as Dao;
    daoStorage.updateAtIndex(idx, updated);
    return updated;
  }

  async deleteById(id: string): Promise<boolean> {
    return daoStorage.deleteById(id);
  }

  async deleteAll(): Promise<void> {
    daoStorage.clearAll(false);
  }
}
