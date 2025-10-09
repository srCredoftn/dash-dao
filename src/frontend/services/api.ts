/**
Rôle: Service HTTP/Client — src/frontend/services/api.ts
Domaine: Frontend/Services
Exports: apiService
Dépendances: @shared/dao, ./cacheService
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * apiService: couche HTTP générique pour les appels /api.
 * Gère Authorization, idempotency, erreurs réseau, 401→refresh/redirect, cache invalidations.
 */
/*
  Types partagés importés pour typage fort des réponses API (ex: Dao)
  - Garantit la cohérence entre frontend et backend
  - Facilite les transformations et validations côté client
*/
import type { Dao } from "@shared/dao";
import { cacheService } from "./cacheService";

// Import statiques pour éviter les warnings de bundler liés aux imports dynamiques
import { getToken } from "@/utils/auth-storage";
import secureFetch from "@/utils/secure-fetch";
import { devLog } from "@/utils/devLogger";
import { authService } from "./authService";

const API_BASE_URL = "/api";

class ApiService {
  // Requête générique: ajoute headers (token, idempotency), gère erreurs et refresh
  /**
   * Requête HTTP générique pour le client frontend vers /api.
   * - Ajoute automatiquement Content-Type et Authorization si token présent
   * - Supporte idempotencyKey, secure-fetch avec fallback et retries
   * - Gère 401 en tentant un refresh puis en redirigeant vers /login si nécessaire
   * - Normalise les erreurs réseau pour une remontée utilisateur cohérente
   * @param endpoint Chemin relatif sur /api (ex: /dao)
   * @param options Options fetch (méthode, body, headers, idempotencyKey)
   * @returns Résultat JSON typé
   */
  private async request<T>(endpoint: string, options?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Récupère le token (stocké par onglet)
    const token = getToken();

    // Base headers JSON
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Fusionner d'éventuels headers fournis par l'appelant
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value: string, key: string) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]: [string, string]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    // Idempotency facultatif pour éviter doublons côté serveur
    if (options?.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
      delete options.idempotencyKey; // ne pas transmettre au fetch brut
    }

    // Authorization si token dispo
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      let response: Response | null = null;

      try {
        // Chemin privilégié: secureFetch + native fetch + retries + timeout
        response = await secureFetch.fetch(url, {
          ...options,
          headers,
          useNativeFetch: true,
          maxRetries: 2,
          timeout: 15000,
        } as any);
      } catch (secureErr) {
        // Fallback: fetch natif en cas d'échec du wrapper sécurité
        console.warn(
          "secure-fetch a échoué, bascule vers fetch natif :",
          secureErr,
        );
        response = await fetch(url, { ...(options || {}), headers });
      }

      // Gestion des statuts non-ok
      if (!response.ok) {
        // 401: tenter un refresh une fois puis rediriger login si échec
        if (response.status === 401) {
          try {
            const ok = await authService.tryRefresh();
            if (ok) {
              return this.request<T>(endpoint, options);
            }
          } catch {}
          authService.clearAuth();
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }

        // Autres erreurs: tenter d'extraire un message JSON sinon generique
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Erreur HTTP : statut ${response.status}`,
        );
      }

      // Succès: renvoyer JSON
      return await response.json();
    } catch (error) {
      // Uniformiser les erreurs réseau
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("Network request failed") ||
        msg.includes("SecureFetchError") ||
        msg.toLowerCase().includes("timeout") ||
        msg.toLowerCase().includes("abort")
      ) {
        throw new Error(
          "Erreur de connexion. Vérifiez votre connexion internet.",
        );
      }

      // Eviter le bruit pour not-found connus (géré côté appelant)
      const lower = msg.toLowerCase();
      if (lower.includes("dao not found") || lower.includes("404")) {
        try {
          devLog.warn(`API ${endpoint} returned not-found: ${msg}`);
        } catch {
          console.warn(`API ${endpoint} returned not-found: ${msg}`);
        }
        throw new Error(msg);
      }

      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // DAO operations — listage avec normalisation + cache en prod
  /**
   * Récupère tous les DAOs depuis l'API, avec normalisation pour les réponses
   * paginées ou enveloppées. En production, utilise un cache court.
   * @returns Liste des DAOs
   */
  async getAllDaos(): Promise<Dao[]> {
    // Fonction de fetch + normalisation des diverses formes possibles
    const fetchAndNormalize = async (): Promise<Dao[]> => {
      const res: any = await this.request<any>("/dao");
      if (Array.isArray(res)) return res; // réponse brute
      if (res && Array.isArray(res.items)) return res.items; // paginé
      if (res && Array.isArray(res.data)) return res.data; // data: []
      return [];
    };

    if (process.env.NODE_ENV !== "production") {
      const daos = await fetchAndNormalize();
      try {
        cacheService.delete("all-daos"); // éviter faux positifs en dev
      } catch {}
      return daos;
    }

    // En prod, mise en cache courte pour soulager le backend
    return cacheService.getOrSet("all-daos", fetchAndNormalize, 2 * 60 * 1000);
  }

  /**
   * Récupère un DAO par son identifiant avec mise en cache courte.
   * @param id Identifiant du DAO
   * @returns Objet Dao
   */
  async getDaoById(id: string): Promise<Dao> {
    return cacheService.getOrSet(
      `dao-${id}`,
      async () => {
        const result = await this.request<Dao>(`/dao/${id}`);
        return result;
      },
      3 * 60 * 1000,
    );
  }

  /**
   * Crée un nouveau DAO via POST /dao.
   * Supporte une clé d'idempotence optionnelle pour éviter les doublons.
   * Invalide le cache de la liste après création.
   * @param daoData Données du DAO (sans id/createdAt/updatedAt)
   * @param opts Options (idempotencyKey)
   * @returns Le DAO créé
   */
  async createDao(
    daoData: Omit<Dao, "id" | "createdAt" | "updatedAt">,
    opts?: { idempotencyKey?: string },
  ): Promise<Dao> {
    const headers: Record<string, string> = {};
    if (opts?.idempotencyKey)
      headers["x-idempotency-key"] = opts.idempotencyKey;
    const result = await this.request<Dao>("/dao", {
      method: "POST",
      body: JSON.stringify(daoData),
      headers,
    });

    // Invalidation cache liste après création
    cacheService.delete("all-daos");

    return result;
  }

  /**
   * Met à jour un DAO existant via PUT /dao/:id.
   * - Par défaut invalide le cache global et le cache du DAO mis à jour
   * - Si skipCacheInvalidation=true on réécrit seulement le cache local
   * @param id Identifiant du DAO
   * @param updates Champs partiels à mettre à jour
   * @param skipCacheInvalidation Si true, éviter l'invalidation globale
   * @returns Le DAO mis à jour
   */
  async updateDao(
    id: string,
    updates: Partial<Dao>,
    skipCacheInvalidation = false,
  ): Promise<Dao> {
    const result = await this.request<Dao>(`/dao/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    if (!skipCacheInvalidation) {
      // Cas généraux: invalider les caches
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${id}`);
    } else {
      // Mises à jour fréquentes: on réécrit le cache ponctuellement
      cacheService.set(`dao-${id}`, result, 3 * 60 * 1000);
    }

    return result;
  }

  /**
   * Supprime un DAO via DELETE /dao/:id et purge les caches associés.
   * @param id Identifiant du DAO à supprimer
   */
  async deleteDao(id: string): Promise<void> {
    const result = await this.request<void>(`/dao/${id}`, {
      method: "DELETE",
    });

    // Purger les caches liés
    cacheService.delete("all-daos");
    cacheService.delete(`dao-${id}`);

    return result;
  }

  /**
   * Récupère le prochain numéro de DAO disponible via l'API.
   * @returns Chaîne représentant le prochain numéro
   */
  async getNextDaoNumber(): Promise<string> {
    const response = await this.request<{ nextNumber: string }>(
      "/dao/next-number",
    );
    return response.nextNumber;
  }

  /**
   * Supprime le dernier DAO (endpoint admin) après vérification par mot de passe.
   * Cette action est sensible et doit être protégée côté serveur.
   * @param opts Objet contenant le mot de passe admin et optionnellement idempotencyKey
   * @returns Informations sur le DAO supprimé
   */
  async deleteLastDao(opts: {
    idempotencyKey?: string;
    password: string;
  }): Promise<{ deletedId: string; numeroListe: string }> {
    // Action sensible: nécessite vérification server-side du mot de passe admin
    return await this.request<{ deletedId: string; numeroListe: string }>(
      "/admin/delete-last-dao",
      {
        method: "DELETE",
        idempotencyKey: opts?.idempotencyKey,
        body: JSON.stringify({ password: opts.password }),
      },
    );
  }

  /**
   * Récupère le dernier DAO créé en interrogeant la liste triée par date.
   * Utile lorsque l'accès direct admin n'est pas souhaité.
   * @returns Objet contenant id, numeroListe et createdAt du dernier DAO
   */
  async getLastDao(): Promise<{
    id: string;
    numeroListe: string;
    createdAt: string;
  }> {
    // Récupérer le dernier DAO via la liste triée (évite route admin-only)
    const res: any = await this.request<any>(
      "/dao?sort=createdAt&order=desc&page=1&pageSize=1",
    );
    const items: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.items)
        ? res.items
        : [];
    if (items.length === 0) throw new Error("Aucun DAO disponible");
    const d = items[0];
    return { id: d.id, numeroListe: d.numeroListe, createdAt: d.createdAt };
  }
}

export const apiService = new ApiService();
