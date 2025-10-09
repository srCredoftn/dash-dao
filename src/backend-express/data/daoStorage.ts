/**
Rôle: Entrée/Bootstrap backend — src/backend-express/data/daoStorage.ts
Domaine: Backend/Core
Exports: daoStorage
Dépendances: @shared/dao, ./mockDaos, ../utils/logger
Performance: cache/partitionnement/bundling optimisés
*/
import type { Dao } from "@shared/dao";
import { serverMockDaos } from "./mockDaos";
import { logger } from "../utils/logger";

// Décider si on doit initialiser des données de démonstration (optionnel). Par défaut : pas de seed pour un premier démarrage propre.
const SHOULD_SEED =
  process.env.SEED_DAOS === "1" || process.env.SEED_DAOS === "true";

// Stockage partagé en mémoire pour les DAOs avec indexation optimisée
// En production, ceci serait remplacé par un service de base de données
class DaoStorage {
  // Démarrer avec un stockage vide pour garantir un état de projet « propre » par défaut
  private storage: Dao[] = [];
  private idIndex: Map<string, number> = new Map();
  private autoriteIndex: Map<string, Dao[]> = new Map();

  constructor() {
    logger.info("Initialisation du stockage DAO", "DAO_STORAGE");

    // Toujours initialiser à vide sauf si un seed explicite est demandé plus tard via clearAll(true)
    this.storage = [];
    this.idIndex.clear();
    this.autoriteIndex.clear();

    this.rebuildIndexes(true);

    // Vérification immédiate de l’intégrité
    this.verifyIntegrity();

    logger.info("Stockage DAO prêt", "DAO_STORAGE");
  }

  // Reconstruire tous les index
  private rebuildIndexes(verbose = false): void {
    this.idIndex.clear();
    this.autoriteIndex.clear();

    this.storage.forEach((dao, index) => {
      // Index par ID
      this.idIndex.set(dao.id, index);

      // Index par autorité contractante
      const autorite = dao.autoriteContractante;
      if (!this.autoriteIndex.has(autorite)) {
        this.autoriteIndex.set(autorite, []);
      }
      this.autoriteIndex.get(autorite)!.push(dao);
    });

    if (verbose) {
      logger.info("Index DAO reconstruits", "DAO_STORAGE", {
        count: this.storage.length,
      });
    }
  }

  // Récupérer tous les DAOs (retourne une copie pour éviter les mutations externes)
  getAll(): Dao[] {
    return [...this.storage];
  }

  // Trouver un DAO par ID (optimisé avec index)
  findById(id: string): Dao | undefined {
    const index = this.idIndex.get(id);
    return index !== undefined ? this.storage[index] : undefined;
  }

  // Trouver l'index d'un DAO par ID (optimisé avec index)
  findIndexById(id: string): number {
    return this.idIndex.get(id) ?? -1;
  }

  // Ajouter un nouveau DAO
  add(dao: Dao): void {
    this.storage.push(dao);
    this.rebuildIndexes(true); // Reconstruire les index après ajout
  }

  // Mettre à jour un DAO à l'index (indexation sûre)
  updateAtIndex(index: number, dao: Dao): void {
    if (index >= 0 && index < this.storage.length) {
      this.storage[index] = dao;
      // Toujours reconstruire les indexes pour éviter toute corruption
      this.rebuildIndexes(true);
      logger.info("DAO mis à jour (index reconstruits)", "DAO_STORAGE");
    }
  }

  // Supprimer un DAO par ID
  deleteById(id: string): boolean {
    const index = this.findIndexById(id);
    if (index !== -1) {
      this.storage.splice(index, 1);
      this.rebuildIndexes(true); // Reconstruire les index après suppression
      return true;
    }
    return false;
  }

  // Trouver des DAOs par autorité contractante (optimisé avec index)
  findByAutorite(autorite: string): Dao[] {
    return this.autoriteIndex.get(autorite) || [];
  }

  // Filtrer les DAOs selon une condition
  filter(predicate: (dao: Dao) => boolean): Dao[] {
    return this.storage.filter(predicate);
  }

  // Obtenir la taille du stockage
  size(): number {
    return this.storage.length;
  }

  // Vérifier l'intégrité des données et corriger les éventuels problèmes
  verifyIntegrity(): boolean {
    logger.info("Vérification de l’intégrité du stockage DAO", "DAO_STORAGE");

    // Vérifier les ID en double
    const idCounts = new Map<string, number>();
    for (const dao of this.storage) {
      const count = idCounts.get(dao.id) || 0;
      idCounts.set(dao.id, count + 1);
    }

    let hasIssues = false;
    for (const [_id, count] of idCounts) {
      if (count > 1) {
        logger.warn("ID de DAO en double détecté", "DAO_STORAGE");
        hasIssues = true;
      }
    }

    // Vérifier la cohérence des index
    for (const [id, expectedIndex] of this.idIndex) {
      const actualDao = this.storage[expectedIndex];
      if (!actualDao || actualDao.id !== id) {
        logger.warn("Incohérence d’index détectée", "DAO_STORAGE");
        hasIssues = true;
      }
    }

    // Afficher l’état actuel
    logger.info("État du stockage DAO vérifié", "DAO_STORAGE", {
      size: this.storage.length,
    });

    if (hasIssues) {
      logger.info(
        "Reconstruction des index pour corriger les problèmes",
        "DAO_STORAGE",
      );
      this.rebuildIndexes(true);
    } else {
      logger.info("Intégrité du stockage DAO vérifiée", "DAO_STORAGE");
    }

    return !hasIssues;
  }

  // Vider tous les DAOs stockés (optionnellement initialiser avec des données de démonstration)
  clearAll(seed = false): void {
    this.storage = seed && SHOULD_SEED ? [...serverMockDaos] : [];
    this.rebuildIndexes(true);
    this.verifyIntegrity();
    logger.info("Stockage DAO vidé", "DAO_STORAGE", { seeded: !!seed });
  }
}

// Export singleton instance
export const daoStorage = new DaoStorage();
