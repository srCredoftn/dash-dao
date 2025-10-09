/**
Rôle: Service HTTP/Client — src/frontend/services/notificationsApi.ts
Domaine: Frontend/Services
Exports: ServerNotification, notificationsApi
Dépendances: @/utils/devLogger, ./authService, @/utils/secure-fetch
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { devLog } from "@/utils/devLogger";

export interface ServerNotification {
  id: string;
  type:
    | "role_update"
    | "dao_created"
    | "dao_updated"
    | "dao_deleted"
    | "user_created"
    | "task_notification"
    | "system";
  title: string;
  message: string;
  data?: any;
  createdAt: string;
  read: boolean;
}

import { authService } from "./authService";
import secureFetch from "@/utils/secure-fetch";

// Helper générique: ajoute headers (JSON + Authorization) et gère 401/refresh
async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = authService.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    // secureFetch pour éviter intercepteurs tiers (FullStory, etc.)
    const response = await secureFetch.fetch(
      typeof input === "string" ? input : input.toString(),
      {
        ...init,
        headers,
        credentials: "include",
        useNativeFetch: true,
        maxRetries: 2,
        timeout: 8000,
      } as any,
    );

    if (!response.ok) {
      if (response.status === 401) {
        try {
          const ok = await (authService as any)?.refreshAccessToken?.();
          if (ok) {
            return await api<T>(input, init); // rejouer la requête une fois
          }
        } catch {}
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    // Normaliser erreurs réseau
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Failed to fetch") ||
      message.includes("Network request failed")
    ) {
      throw new Error(
        "Réseau inaccessible : impossible de contacter le serveur",
      );
    }
    throw err;
  }
}

export const notificationsApi = {
  // Liste paginée/limitée côté serveur; en cas d'erreur réseau, renvoie []
  async list(): Promise<ServerNotification[]> {
    try {
      return await api<ServerNotification[]>("/api/notifications");
    } catch (e) {
      devLog.warn(
        "Échec de récupération des notifications (réseau/preview) :",
        (e as Error).message,
      );
      return [];
    }
  },
  // Marquer une notif comme lue
  async markRead(id: string): Promise<void> {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PUT" });
    } catch (e) {
      devLog.error("Échec du marquage de la notification comme lue", e);
    }
  },
  // Marquer toutes les notifs comme lues
  async markAllRead(): Promise<void> {
    try {
      await api(`/api/notifications/read-all`, { method: "PUT" });
    } catch (e) {
      devLog.error(
        "Échec du marquage de toutes les notifications comme lues",
        e,
      );
    }
  },
};
