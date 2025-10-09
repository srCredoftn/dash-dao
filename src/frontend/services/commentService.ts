/**
Rôle: Service HTTP/Client — src/frontend/services/commentService.ts
Domaine: Frontend/Services
Exports: commentService
Dépendances: @shared/dao
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/*
  Types partagées (TaskComment) importées depuis @shared/dao pour garantir la cohérence
  entre client et serveur: identifiants, structure du commentaire, métadonnées.
*/
import type { TaskComment } from "@shared/dao";

import secureFetch from "@/utils/secure-fetch";
import { authService } from "./authService";

const API_BASE_URL = "/api/comments";

// Cache mémoire simple pour limiter les rafales (par DAO)
const daoCommentsCache = new Map<string, { data: TaskComment[]; ts: number }>();
const inFlight = new Map<string, Promise<TaskComment[]>>(); // déduplique les appels en cours
const CACHE_TTL = 60 * 1000; // 1 min

class CommentApiService {
  // Requête générique avec Authorization + idempotency + gestion 401/redirect
  private async request<T>(endpoint: string, options?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const token = localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Fusion headers appelants
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value: string, key: string) => {
          headers[key] = value as string;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]: [string, string]) => {
          headers[key] = value as string;
        });
      } else {
        Object.assign(headers, options.headers as Record<string, string>);
      }
    }

    // Idempotency facultative
    if (options?.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
      delete options.idempotencyKey;
    }

    // Authorization si dispo
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await secureFetch.fetch(url, {
        ...options,
        headers,
        useNativeFetch: false, // laisse le wrapper gérer selon l'environnement
        maxRetries: 1,
        timeout: 15000,
      } as any);

      if (!response.ok) {
        if (response.status === 401) {
          // 401 → tenter refresh via authService, sinon purge et redirect
          try {
            const ok = await authService.tryRefresh();
            if (ok) {
              return this.request<T>(endpoint, options);
            }
          } catch {}
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as any).error || `HTTP error! status: ${response.status}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Erreurs réseau: log plus clair
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("Network request failed") ||
        msg.toLowerCase().includes("aborterror") ||
        msg.toLowerCase().includes("timeout")
      ) {
        console.error(`Comment API request failed for ${endpoint}:`, error);
      } else {
        console.error(`Comment API request failed for ${endpoint}:`, error);
      }

      // Ultime recours: fallback XHR (utile si fetch est intercepté/bloqué)
      try {
        const data = await new Promise<T>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open((options?.method || "GET").toUpperCase(), url, true);
            Object.entries(headers).forEach(([k, v]) =>
              xhr.setRequestHeader(k, v),
            );
            xhr.timeout = 15000;
            xhr.withCredentials = true;
            xhr.onreadystatechange = () => {
              if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const json = JSON.parse(xhr.responseText || "null");
                    resolve(json as T);
                  } catch (e) {
                    reject(e);
                  }
                } else if (xhr.status === 401) {
                  localStorage.removeItem("auth_token");
                  localStorage.removeItem("auth_user");
                  if (!window.location.pathname.includes("/login")) {
                    window.location.href = "/login";
                  }
                  reject(
                    new Error("Session expirée. Veuillez vous reconnecter."),
                  );
                } else {
                  reject(new Error(`HTTP error! status: ${xhr.status}`));
                }
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.ontimeout = () => reject(new Error("Request timeout"));
            xhr.send(
              options?.body
                ? typeof options.body === "string"
                  ? options.body
                  : JSON.stringify(options.body)
                : null,
            );
          } catch (e) {
            reject(e);
          }
        });

        return data;
      } catch (fallbackError) {
        console.error("XHR fallback failed:", fallbackError);
        throw error; // renvoyer l'erreur d'origine
      }
    }
  }

  // Récupère tous les commentaires d'un DAO (avec cache minute)
  async getDaoComments(daoId: string): Promise<TaskComment[]> {
    const cached = daoCommentsCache.get(daoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    // Déduplique les appels parallèles
    const existing = inFlight.get(daoId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const data = await this.request<TaskComment[]>(`/dao/${daoId}`);
        daoCommentsCache.set(daoId, { data, ts: Date.now() });
        return data;
      } catch (e) {
        // Fallback cache périmé si dispo
        const stale = daoCommentsCache.get(daoId);
        if (stale) return stale.data;
        throw e;
      } finally {
        inFlight.delete(daoId);
      }
    })();

    inFlight.set(daoId, promise);
    return promise;
  }

  // Filtre les commentaires d'une tâche spécifique
  async getTaskComments(daoId: string, taskId: number): Promise<TaskComment[]> {
    const daoComments = await this.getDaoComments(daoId);
    return daoComments.filter((c) => c.taskId === taskId);
  }

  // Ajoute un commentaire (invalide le cache DAO concerné)
  async addComment(
    daoId: string,
    taskId: number,
    content: string,
    opts?: { idempotencyKey?: string; silent?: boolean },
  ): Promise<TaskComment> {
    const options: any = {
      method: "POST",
      body: JSON.stringify({ daoId, taskId, content }),
      headers: {},
    };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    if (opts?.silent) {
      options.headers = { ...(options.headers || {}), "x-no-notify": "true" };
    }
    const result = await this.request<TaskComment>("/", options);
    daoCommentsCache.delete(daoId);
    inFlight.delete(daoId);
    return result;
  }

  // Met à jour un commentaire (invalide tout cache commentaires)
  async updateComment(
    commentId: string,
    content: string,
    opts?: { idempotencyKey?: string },
  ): Promise<TaskComment> {
    const options: any = { method: "PUT", body: JSON.stringify({ content }) };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const updated = await this.request<TaskComment>(`/${commentId}`, options);
    daoCommentsCache.clear();
    inFlight.clear();
    return updated;
  }

  // Supprime un commentaire (invalide tout cache commentaires)
  async deleteComment(
    commentId: string,
    opts?: { idempotencyKey?: string },
  ): Promise<void> {
    const options: any = { method: "DELETE" };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    await this.request<void>(`/${commentId}`, options);
    daoCommentsCache.clear();
    inFlight.clear();
  }

  // Récupère les commentaires récents (limite paramétrable)
  async getRecentComments(limit: number = 10): Promise<TaskComment[]> {
    return this.request<TaskComment[]>(`/recent?limit=${limit}`);
  }
}

export const commentService = new CommentApiService();
