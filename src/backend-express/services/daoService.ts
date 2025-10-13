/**
Rôle: Service métier côté serveur — src/backend-express/services/daoService.ts
Domaine: Backend/Services
Exports: DaoService
Dépendances: @shared/dao, ../config/database, ../repositories/memoryDaoRepository, ../repositories/mongoDaoRepository, ../repositories/daoRepository, ../utils/logger
Liens: appels /api, utils de fetch, types @shared/*
Performance: cache/partitionnement/bundling optimisés
*/
import type { Dao } from "@shared/dao";
import { connectToDatabase } from "../config/database";
import { getStorageConfig } from "../config/runtime";
import { MemoryDaoRepository } from "../repositories/memoryDaoRepository";
import { MongoDaoRepository } from "../repositories/mongoDaoRepository";
import type { DaoRepository } from "../repositories/daoRepository";
import { logger } from "../utils/logger";

// Compteur monotone par année pour éviter la réutilisation de numéros apr��s des suppressions
const lastIssuedSeqByYear: Record<string, number> = {};

let repo: DaoRepository | null = null;
let attempted = false;

async function getRepo(): Promise<DaoRepository> {
  /*
    Résolution du repository de persistance:
    - Priorité: Mongo si configuré (USE_MONGO=true) et disponible
    - Sinon: fallback sur un dépôt en mémoire (MemoryDaoRepository)
    - attempted: permet d'éviter une seconde tentative coûteuse de connexion à la DB
    - En mode strict, on peut lever l'erreur pour forcer la disponibilité de la DB

    Cette abstraction permet de basculer facilement entre in-memory et MongoDB
    sans modifier le reste du code métier.
  */
  if (repo) return repo;
  if (attempted) return repo || new MemoryDaoRepository();
  attempted = true;

  const WANT_MONGO = (process.env.USE_MONGO || "").toLowerCase() === "true";
  if (!WANT_MONGO) {
    // Mode développement: utilisation du dépôt en mémoire pour la simplicité
    repo = new MemoryDaoRepository();
    return repo;
  }

  try {
    // Tentative de connexion à Mongo + création du repository Mongo
    await connectToDatabase();
    repo = new MongoDaoRepository();
    return repo;
  } catch (e) {
    // En cas d'erreur, possibilité de chuter vers la mémoire selon la configuration
    const cfg = getStorageConfig();
    if (cfg.strictDbMode && !cfg.fallbackOnDbError) {
      // En mode strict, nous voulons que l'erreur remonte pour être traitée à l'appelant
      throw e;
    }
    logger.warn(
      "MongoDB indisponible, utilisation d’un dépôt en mémoire",
      "DAO_SERVICE",
    );
    repo = new MemoryDaoRepository();
    return repo;
  }
}

export class DaoService {
  // Récupérer tous les DAO
  static async getAllDaos(): Promise<Dao[]> {
    const r = await getRepo();
    const list = await r.findAll();
    return list.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  // Récupérer le dernier DAO créé
  static async getLastCreatedDao(): Promise<Dao | null> {
    const r = await getRepo();
    return r.getLastCreated();
  }

  // Supprimer le dernier DAO créé et le retourner
  static async deleteLastCreatedDao(): Promise<Dao | null> {
    const last = await this.getLastCreatedDao();
    if (!last) return null;
    const ok = await this.deleteDao(last.id);
    return ok ? last : null;
  }

  // Récupérer les DAO avec filtrage, tri et pagination
  static async getDaos(opts: {
    search?: string;
    autorite?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Dao[]; total: number }> {
    const r = await getRepo();
    return r.findAndPaginate(opts);
  }

  // Récupérer un DAO par ID
  static async getDaoById(id: string): Promise<Dao | null> {
    const r = await getRepo();
    return r.findById(id);
  }

  // Générer le prochain numéro de DAO (mutant : fait avancer la base pour les créations)
  static async generateNextDaoNumber(): Promise<string> {
    const r = await getRepo();
    const year = new Date().getFullYear();

    const list = await r.findByNumeroYear(year);
    const computeMaxSeq = (arr: { numeroListe: string }[]) => {
      const nums = arr
        .map((d) => d.numeroListe.match(/DAO-(\d{4})-(\d{3})/))
        .filter((m): m is RegExpMatchArray => !!m && m[1] === String(year))
        .map((m) => parseInt(m[2], 10))
        .filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.max(...nums) : 0;
    };

    const maxSeq = computeMaxSeq(list as any);
    const baseline = Math.max(lastIssuedSeqByYear[String(year)] || 0, maxSeq);
    const nextSeq = baseline + 1;
    lastIssuedSeqByYear[String(year)] = nextSeq;
    return `DAO-${year}-${nextSeq.toString().padStart(3, "0")}`;
  }

  // Prévisualiser le prochain numéro de DAO (non mutant)
  static async peekNextDaoNumber(): Promise<string> {
    const r = await getRepo();
    const year = new Date().getFullYear();
    const list = await r.findByNumeroYear(year);
    const computeMaxSeq = (arr: { numeroListe: string }[]) => {
      const nums = arr
        .map((d) => d.numeroListe.match(/DAO-(\d{4})-(\d{3})/))
        .filter((m): m is RegExpMatchArray => !!m && m[1] === String(year))
        .map((m) => parseInt(m[2], 10))
        .filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.max(...nums) : 0;
    };

    const maxSeq = computeMaxSeq(list as any);
    const baseline = Math.max(lastIssuedSeqByYear[String(year)] || 0, maxSeq);
    const nextSeq = baseline + 1;
    return `DAO-${year}-${nextSeq.toString().padStart(3, "0")}`;
  }

  // Créer un nouveau DAO
  static async createDao(
    daoData: Omit<Dao, "id" | "createdAt" | "updatedAt">,
  ): Promise<Dao> {
    const r = await getRepo();
    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Toujours générer côté serveur pour éviter les doublons
    let numeroListe = await this.generateNextDaoNumber();

    // Assurer l’unicité avec une petite boucle de retry pour Mongo ou la mémoire
    /*
      Pourquoi ce retry ?
      - génération du numéro (numeroListe) peut entrer en collision lorsqu'il y a
        des insertions concurrentes (surtout en base de données).
      - En cas d'erreur de duplication (E11000), on régénère un nouveau numeroListe
        et on retente l'insertion. Limité à 3 tentatives pour éviter boucles infinies.
    */
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const newDao: Dao = {
          ...daoData,
          numeroListe,
          id,
          createdAt: now,
          updatedAt: now,
        } as Dao;
        const inserted = await r.insert(newDao);
        return inserted;
      } catch (e: any) {
        const msg = String((e && e.message) || e);
        if (msg.includes("E11000") || msg.toLowerCase().includes("duplicate")) {
          // Conflit d'unicité: régénérer le numéro et retenter
          numeroListe = await this.generateNextDaoNumber();
          continue;
        }
        // Autre erreur: remonter
        throw e;
      }
    }

    const finalDao: Dao = {
      ...daoData,
      numeroListe,
      id,
      createdAt: now,
      updatedAt: now,
    } as Dao;
    const inserted = await r.insert(finalDao);
    return inserted;
  }

  // Mettre à jour un DAO
  static async updateDao(
    id: string,
    updates: Partial<Dao>,
  ): Promise<Dao | null> {
    const r = await getRepo();

    // Fetch previous state to detect critical transitions
    const before = await r.findById(id);

    const updated = await r.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    try {
      if (updated) {
        // Determine criticality thresholds from env (configurable)
        const CRIT_DAYS = Math.max(0, Number(process.env.CRITICAL_DAYS_THRESHOLD || 7));
        const CRIT_PROGRESS = Math.max(0, Number(process.env.CRITICAL_PROGRESS_THRESHOLD || 20));
        const mode = (process.env.CRITICAL_SEND_MODE || "team").toLowerCase(); // 'team' | 'all' | 'central'

        const isCritical = (dao: Dao | null) => {
          if (!dao) return false;
          let critical = false;
          try {
            const date = new Date(dao.dateDepot);
            const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diffDays <= CRIT_DAYS) critical = true;
          } catch {}
          try {
            const progress = (await import('./txEmail')).computeDaoProgress(dao);
            if (progress <= CRIT_PROGRESS) critical = true;
          } catch {}
          return critical;
        };

        const wasCritical = isCritical(before);
        const nowCritical = isCritical(updated);

        if (!wasCritical && nowCritical) {
          // Compose notification
          const title = `DAO critique — ${updated.objetDossier}`;
          const message = `Le DAO ${updated.objetDossier} (${updated.reference}) est devenu critique.`;

          // Send according to mode
          if (mode === "all") {
            const { NotificationService } = await import("./notificationService");
            await NotificationService.add({
              type: "dao_updated",
              title,
              message,
              data: { daoId: updated.id },
              recipients: "all",
            });
          } else if (mode === "central") {
            const central = (process.env.SMTP_CENTRAL_ADDRESS || "").trim();
            if (central) {
              const { sendEmail } = await import("./txEmail");
              const subject = title;
              const body = `${message}\n\nRéférence: ${updated.reference}\nDate dépôt: ${updated.dateDepot}`;
              await sendEmail(central, subject, body, "DAO_UPDATED");
            }
          } else {
            // team mode: notify members + chef
            const memberIds = Array.isArray(updated.equipe)
              ? updated.equipe.map((m) => String((m as any).id))
              : [];
            const { NotificationService } = await import("./notificationService");
            await NotificationService.add({
              type: "dao_updated",
              title,
              message,
              data: { daoId: updated.id },
              recipients: memberIds,
            });
          }
        }
      }
    } catch (e) {
      // Log but don't fail the update flow
      const { logger } = await import("../utils/logger");
      logger.warn("Erreur lors de la notification DAO critique", "DAO_SERVICE", {
        message: String((e as Error)?.message || e),
      });
    }

    return updated;
  }

  // Supprimer un DAO
  static async deleteDao(id: string): Promise<boolean> {
    const r = await getRepo();
    const existing = await r.findById(id);
    const ok = await r.deleteById(id);
    if (ok && existing?.numeroListe) {
      const m = existing.numeroListe.match(/DAO-(\d{4})-(\d{3})/);
      if (m) {
        const year = m[1];
        const remaining = await r.findByNumeroYear(year);
        const nums = remaining
          .map((d) => d.numeroListe.match(/DAO-\d{4}-(\d{3})/))
          .map((mm) => parseInt((mm ? mm[1] : "0") as string, 10))
          .filter((n) => !isNaN(n));
        lastIssuedSeqByYear[year] = nums.length ? Math.max(...nums) : 0;
      }
    }
    return ok;
  }

  // Initialiser avec des données d’exemple si vide (no-op pour la mémoire car le seed est géré ailleurs)
  static async initializeSampleData(sampleDaos: Dao[]): Promise<void> {
    const r = await getRepo();
    const c = await r.count();
    if (c === 0 && sampleDaos.length) {
      await r.insertMany(sampleDaos);
    }
  }

  // Effacer tous les DAO (DB ou mémoire)
  static async clearAll(): Promise<void> {
    const r = await getRepo();
    for (const k of Object.keys(lastIssuedSeqByYear))
      delete lastIssuedSeqByYear[k];
    await r.deleteAll();
  }
}
