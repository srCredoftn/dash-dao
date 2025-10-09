/**
Rôle: Service HTTP/Client — src/frontend/services/taskService.ts
Domaine: Frontend/Services
Exports: taskService
Dépendances: @shared/dao
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import type { Dao } from "@shared/dao";
import { cacheService } from "./cacheService";

// Import statiques pour éviter duplications de chunk
import { getToken } from "@/utils/auth-storage";
import secureFetch from "@/utils/secure-fetch";
import { authService } from "./authService";

const API_BASE_URL = "/api/dao";

class TaskService {
  // Requête générique vers /api/dao/* avec auth, idempotency et gestion réseau
  private async request<T>(endpoint: string, options?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Token stocké par onglet
    const token = getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Fusion des headers appelants
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

    // Idempotency facultative
    if (options?.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
      delete options.idempotencyKey;
    }

    // Auth si token dispo
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      let response: Response | null = null;
      try {
        response = await secureFetch.fetch(url, {
          ...options,
          headers,
          useNativeFetch: true,
          maxRetries: 2,
          timeout: 15000,
        } as any);
      } catch (secureErr) {
        // Fallback natif en cas d'échec du wrapper
        console.warn(
          "secure-fetch a échoué (taskService), repli sur fetch natif :",
          secureErr,
        );
        response = await fetch(url, { ...(options || {}), headers });
      }

      if (!response.ok) {
        // 401 → tenter refresh puis rejouer
        if (response.status === 401) {
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
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      // Normalisation erreurs réseau
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

      console.error(
        `Échec de la requête API des tâches pour ${endpoint} :`,
        error,
      );
      throw error;
    }
  }

  // Ajout d'une nouvelle tâche à un DAO
  async addTask(
    daoId: string,
    taskData: {
      name: string;
      isApplicable: boolean;
      progress?: number | null;
      comment?: string;
      assignedTo?: string[];
    },
    opts?: { idempotencyKey?: string },
  ): Promise<Dao> {
    const options: any = { method: "POST", body: JSON.stringify(taskData) };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const result = await this.request<Dao>(`/${daoId}/tasks`, options);
    try {
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${daoId}`);
    } catch {}
    return result;
  }

  // Mise à jour du nom de tâche
  async updateTaskName(
    daoId: string,
    taskId: number,
    name: string,
    opts?: { idempotencyKey?: string },
  ): Promise<Dao> {
    const options: any = { method: "PUT", body: JSON.stringify({ name }) };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const result = await this.request<Dao>(
      `/${daoId}/tasks/${taskId}/name`,
      options,
    );
    try {
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${daoId}`);
    } catch {}
    return result;
  }

  // Suppression d'une tâche
  async deleteTask(
    daoId: string,
    taskId: number,
    opts?: { idempotencyKey?: string },
  ): Promise<{ dao: Dao; message: string }> {
    const options: any = { method: "DELETE" };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const result = await this.request<{ dao: Dao; message: string }>(
      `/${daoId}/tasks/${taskId}`,
      options,
    );
    try {
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${daoId}`);
    } catch {}
    return result;
  }

  // Mise à jour d'une tâche (progress/comment/applicable/assignés)
  async updateTask(
    daoId: string,
    taskId: number,
    updates: {
      progress?: number;
      comment?: string;
      isApplicable?: boolean;
      assignedTo?: string[];
    },
    opts?: { idempotencyKey?: string },
  ): Promise<Dao> {
    const options: any = { method: "PUT", body: JSON.stringify(updates) };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const result = await this.request<Dao>(
      `/${daoId}/tasks/${taskId}`,
      options,
    );
    try {
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${daoId}`);
    } catch {}
    return result;
  }

  // Réordonner les tâches
  async reorderTasks(
    daoId: string,
    taskIds: number[],
    opts?: { idempotencyKey?: string },
  ): Promise<Dao> {
    const options: any = { method: "PUT", body: JSON.stringify({ taskIds }) };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    const result = await this.request<Dao>(`/${daoId}/tasks/reorder`, options);
    try {
      cacheService.delete("all-daos");
      cacheService.delete(`dao-${daoId}`);
    } catch {}
    return result;
  }
}

export const taskService = new TaskService();
