/**
Rôle: Repository (persistance) — src/backend-express/repositories/mongoDaoRepository.ts
Domaine: Backend/Repositories
Exports: MongoDaoRepository
Dépendances: @shared/dao, ../models/Dao, ./daoRepository
Liens: models (Mongo), services (métier), config DB
*/
import type { Dao } from "@shared/dao";
import DaoModel from "../models/Dao";
import type { DaoRepository, DaoQueryOptions } from "./daoRepository";

export class MongoDaoRepository implements DaoRepository {
  async findAll(): Promise<Dao[]> {
    const docs = await DaoModel.find().sort({ updatedAt: -1 });
    return docs.map((d) => d.toObject() as Dao);
  }

  async findById(id: string): Promise<Dao | null> {
    const doc = await DaoModel.findOne({ id });
    return doc ? (doc.toObject() as Dao) : null;
  }

  async getLastCreated(): Promise<Dao | null> {
    const doc = await DaoModel.findOne().sort({ createdAt: -1 });
    return doc ? (doc.toObject() as Dao) : null;
  }

  async count(): Promise<number> {
    return DaoModel.countDocuments();
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

    const query: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { numeroListe: regex },
        { objetDossier: regex },
        { reference: regex },
        { autoriteContractante: regex },
      ];
    }
    if (autorite && autorite.trim()) {
      query.autoriteContractante = autorite.trim();
    }

    if (dateFrom || dateTo) {
      const range: any = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) range.$gte = from.toISOString();
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          range.$lte = to.toISOString();
        }
      }
      if (Object.keys(range).length) query.dateDepot = range;
    }

    const total = await DaoModel.countDocuments(query);
    const sortObj: any = {};
    sortObj[sort] = order === "asc" ? 1 : -1;

    const skip = Math.max(0, (Math.max(1, page) - 1) * pageSize);
    const docs = await DaoModel.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(pageSize);
    return { items: docs.map((d) => d.toObject() as Dao), total };
  }

  async findByNumeroYear(year: number | string): Promise<Dao[]> {
    const docs = await DaoModel.find({
      numeroListe: { $regex: `^DAO-${year}-` },
    });
    return docs.map((d) => d.toObject() as Dao);
  }

  async insert(dao: Dao): Promise<Dao> {
    const doc = new DaoModel(dao);
    const saved = await doc.save();
    return saved.toObject() as Dao;
  }

  async insertMany(daos: Dao[]): Promise<void> {
    if (!daos.length) return;
    await DaoModel.insertMany(daos);
  }

  async update(id: string, updates: Partial<Dao>): Promise<Dao | null> {
    const updated = await DaoModel.findOneAndUpdate(
      { id },
      { ...updates },
      { new: true },
    );
    return updated ? (updated.toObject() as Dao) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await DaoModel.deleteOne({ id });
    return result.deletedCount ? result.deletedCount > 0 : false;
  }

  async deleteAll(): Promise<void> {
    await DaoModel.deleteMany({});
  }
}
