/**
Rôle: Service HTTP/Client — src/frontend/services/cacheService.ts
Domaine: Frontend/Services
Exports: cacheService
Liens: appels /api, utils de fetch, types @shared/*
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * Simple cache service pour optimiser les performances
 * En production, utiliser Redis ou une solution similaire
 */

interface CacheItem<T> {
  data: T; // Données mises en cache
  timestamp: number; // Date d'insertion
  ttl: number; // Durée de vie en millisecondes
}

class CacheService {
  private cache: Map<string, CacheItem<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Récupère une valeur du cache si non expirée
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null; // clé absente
    }

    // Expiration: purge et retourne null
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Stocke une valeur dans le cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    this.cache.set(key, item);
  }

  /**
   * Supprime une clé du cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Vide entièrement le cache (avec logs utiles en dev)
   */
  clear(): void {
    const entriesCount = this.cache.size;
    console.log(`🧹 Nettoyage complet du cache (${entriesCount} entrées)`);
    this.cache.clear();
    console.log(`✅ Cache vidé avec succès`);
  }

  /**
   * Nettoyage "fort" : cache mémoire + clés locales liées
   */
  forceFullClear(): void {
    console.log("🧹 Nettoyage forcé de tous les caches et stockages...");

    // 1) Cache mémoire
    this.clear();

    // 2) Stockage persistant (localStorage) pour quelques clés usuelles
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("cache") || key.includes("dao") || key.includes("DAO"))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      console.log(`🗑️ Clé localStorage supprimée : ${key}`);
    });

    console.log(
      `✅ Nettoyage forcé terminé - ${keysToRemove.length} éléments localStorage supprimés`,
    );
  }

  /**
   * Récupère une valeur ou exécute une fonction si elle n'existe pas (avec mise en cache)
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      console.log(`🎯 Cache utilisé pour ${key}`);
      return cached;
    }

    console.log(`⚡ Cache manquant pour ${key}, récupération...`);
    const data = await fetchFunction();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalide les clés qui matchent un pattern (RegExp)
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Supprime silencieusement les entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Statistiques utiles (debug)
   */
  getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cacheService = new CacheService();

// Tâche périodique: nettoyage toutes les 10 minutes
setInterval(
  () => {
    cacheService.cleanup();
    console.log("🧹 Nettoyage du cache terminé");
  },
  10 * 60 * 1000,
);
