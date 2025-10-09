/**
Rôle: Configuration backend — src/backend-express/config/runtime.ts
Domaine: Backend/Config
Exports: StorageConfig, getStorageConfig
Dépendances: ./database
Performance: cache/partitionnement/bundling optimisés
*/
import { connectToDatabase } from "./database";
import { logger } from "../utils/logger";

export type StorageConfig = {
  useMongo: boolean;
  strictDbMode: boolean; // si true et useMongo=true, échouer rapidement en cas d'erreur DB
  fallbackOnDbError: boolean; // si true et useMongo=true, basculer en mémoire si la DB échoue
};

export function getStorageConfig(): StorageConfig {
  const useMongo = (process.env.USE_MONGO || "false").toLowerCase() === "true";
  const strictDbMode =
    (process.env.STRICT_DB_MODE || "false").toLowerCase() === "true";
  const fallbackOnDbError =
    (process.env.FALLBACK_ON_DB_ERROR || "true").toLowerCase() === "true";
  return { useMongo, strictDbMode, fallbackOnDbError };
}

export async function assertDbConnectivityIfRequired(): Promise<void> {
  const cfg = getStorageConfig();
  if (!cfg.useMongo) return; // mode mémoire, rien à vérifier

  try {
    await connectToDatabase();
  } catch (e) {
    if (cfg.strictDbMode && !cfg.fallbackOnDbError) {
      // Échouer immédiatement au démarrage
      throw new Error(
        `STRICT_DB_MODE=true et USE_MONGO=true mais MongoDB est inaccessible. Erreur : ${String(
          (e as Error).message,
        )}`,
      );
    }
    // sinon : autoriser le repli à l’exécution côté services
    logger.warn(
      "MongoDB inaccessible au démarrage ; utilisation du repli si activé",
      "RUNTIME",
    );
  }
}
