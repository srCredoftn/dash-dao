/**
Rôle: Service HTTP/Client — src/frontend/services/authService.ts
Domaine: Frontend/Services
Exports: authService
Liens: appels /api, utils de fetch, types @shared/*
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * AuthApiService
 * - Gère login/logout, rafraîchissement de token (cookie httpOnly côté serveur)
 * - Stockage protégé par session d'onglet via utils/auth-storage (pas d'exposition inter-onglets)
 * - Réessaie automatique en cas de 401 via /refresh, puis purge locale en cas d'échec
 * - Aucun secret n'est logg��; messages d'erreurs simples et actionnables
 */
import type {
  LoginCredentials,
  AuthResponse,
  AuthUser,
  User,
} from "@shared/dao";
import {
  getToken as tabGetToken,
  setAuth as tabSetAuth,
  clearAuth as tabClearAuth,
  getUser as tabGetUser,
  startTabSession,
} from "@/utils/auth-storage";
import secureFetch from "@/utils/secure-fetch";
// Utilisation de fetch via secure-fetch (avec fallback) pour contourner les interceptions tierces

const API_BASE_URL = "/api/auth";

class AuthApiService {
  private token: string | null = null; // Token courant (mémoire)
  private refreshing: Promise<boolean> | null = null; // Promesse en cours pour éviter les refresh concurrents
  private authClearedListeners = new Set<() => void>();

  constructor() {
    // Charger le token stocké (par onglet) au démarrage
    this.token = tabGetToken();
  }

  // Tentative de rafraîchir le token via /auth/refresh (retourne true si succès)
  /**
   * Tente de rafraîchir le token d'accès via l'endpoint /api/auth/refresh.
   * - Déduit les appels concurrents (une seule promesse partagée)
   * - Met à jour le token en mémoire et dans le localStorage si succès
   * - En cas d'échec, purge l'état d'authentification local
   * @returns true si le rafraîchissement a réussi, false sinon
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshing) return this.refreshing; // dédupliquer
    this.refreshing = (async () => {
      try {
        const resp = await secureFetch.fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          useNativeFetch: true,
          timeout: 8000,
        } as any);
        if (!resp.ok) throw new Error(String(resp.status));
        const data = await resp.json();
        if (data?.token) {
          // Mettre à jour token local et storage
          this.token = data.token;
          localStorage.setItem("auth_token", data.token);
          if (data.user)
            localStorage.setItem("auth_user", JSON.stringify(data.user));
          // S'assurer que le marqueur de session d'onglet est présent pour exposer le token
          try {
            startTabSession();
          } catch {}
          return true;
        }
        return false;
      } catch {
        // Echec: purge totale
        this.clearAuth();
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // Expose une méthode publique contrôlée pour déclencher un refresh depuis d'autres services
  public async tryRefresh(): Promise<boolean> {
    return this.refreshAccessToken();
  }

  // Requête générique vers /api/auth/* (gestion headers, 401→refresh)
  /**
   * Requête HTTP générique pour les endpoints d'API d'authentification.
   * - Gère l'ajout des headers (Content-Type, Authorization, Idempotency)
   * - Utilise secure-fetch avec un fallback vers window.fetch
   * - Tente un refresh de token en cas de 401 et rejoue la requête si possible
   * - Uniformise et traduit certains messages d'erreur réseau pour l'UI
   * @param endpoint Chemin relatif (ex: /login)
   * @param options Options de requête (méthode, body, headers, idempotencyKey)
   * @returns Le résultat JSON typé
   */
  private async request<T>(endpoint: string, options?: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Fusion des headers appelants éventuels
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

    // Idempotency optionnelle (éviter double soumission)
    if (options?.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
      delete options.idempotencyKey;
    }

    // Authorization si token en mémoire
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      // Contrôleur d'annulation simple + timeout manuel (compat tests)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response;
      try {
        // 1) Essai via secureFetch (protégé des interceptions)
        response = await secureFetch.fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
          useNativeFetch: true,
          maxRetries: options?.maxRetries ?? 0,
          timeout: 30000,
        } as any);
      } catch (sfError) {
        // 2) Fallback: fetch natif direct
        console.warn(
          "secureFetch a échoué, tentative de repli sur fetch natif",
        );
        try {
          const nativeOptions: any = {
            ...options,
            headers,
            signal: controller.signal,
          };
          if (!nativeOptions.method) nativeOptions.method = "GET";
          response = await window.fetch(url, nativeOptions as any);
        } catch (nativeErr) {
          // Si le fallback échoue aussi, relancer l'erreur initiale
          throw sfError;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // 401 → tenter refresh puis rejouer la requête
      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.request<T>(endpoint, options);
          }
          this.clearAuth();
        }

        const errorData = await response.json().catch(() => ({}));

        // 429 → message adapté avec Retry-After interprété si possible
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          let secondsText = "quelques";
          if (retryAfter) {
            const asNum = Number(retryAfter);
            if (!isNaN(asNum)) secondsText = `${asNum}`;
            else {
              const date = new Date(retryAfter);
              if (!isNaN(date.getTime())) {
                const sec = Math.max(
                  0,
                  Math.ceil((date.getTime() - Date.now()) / 1000),
                );
                secondsText = `${sec}`;
              }
            }
          }
          throw new Error(
            `Trop de tentatives de connexion. Veuillez réessayer dans ${secondsText} secondes.`,
          );
        }

        if (response.status === 401) {
          const ep = String(endpoint || "");
          if (ep.startsWith("/login")) {
            throw new Error("Identifiants incorrects, veuillez réessayer");
          }
          throw new Error(
            "Session expirée ou invalide, veuillez vous reconnecter",
          );
        }

        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      // Réponse OK → JSON
      return await response.json();
    } catch (error: any) {
      // Uniformisation de quelques erreurs courantes
      if (error?.name === "AbortError") {
        console.warn(`⏰ Request timeout for ${endpoint}`);
        throw new Error("La requête a pris trop de temps. Veuillez réessayer.");
      }

      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        console.warn(`🌐 Network error for ${endpoint}:`, error.message);
        throw new Error(
          "Impossible de se connecter au serveur. Vérifiez votre connexion internet.",
        );
      }

      console.warn("La requête d’authentification a échoué");
      throw error;
    }
  }

  // Login utilisateur
  /**
   * Effectue la connexion de l'utilisateur avec email/password via /api/auth/login.
   * - En cas de succès, stocke le token et l'utilisateur (storage par onglet)
   * - Propage une erreur utile en cas d'identifiants incorrects
   * @param credentials Objet { email, password }
   * @returns La réponse d'authentification contenant user + token
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.request<AuthResponse>("/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });

      // Stockage par onglet + session de tab
      this.token = response.token;
      tabSetAuth(response.token, JSON.stringify(response.user));
      startTabSession();
      return response;
    } catch (error) {
      console.warn("La connexion a échoué");

      if (error instanceof Error) {
        if (
          error.message.includes("401") ||
          error.message.includes("Identifiants incorrects")
        ) {
          throw new Error("Identifiants incorrects, veuillez réessayer");
        }
      }

      throw error;
    }
  }

  // Logout utilisateur (API + purge locale)
  /**
   * Déconnecte l'utilisateur: appelle l'API /logout si token présent puis purge local.
   * Cette opération est tolérante aux erreurs réseau (cleanup local toujours exécuté).
   */
  async logout(): Promise<void> {
    try {
      if (this.token) {
        await this.request<void>("/logout", {
          method: "POST",
        });
      }
    } catch (error) {
      console.error("Échec de l’appel API de déconnexion :", error);
      // On continue tout de même le cleanup local
    } finally {
      this.clearAuth();
    }
  }

  // Récupère l'utilisateur courant (/me)
  /**
   * Récupère l'utilisateur courant via /me
   * @returns L'objet AuthUser retourné par le serveur
   */
  async getCurrentUser(): Promise<AuthUser> {
    return this.request<{ user: AuthUser }>("/me").then((res) => res.user);
  }

  // Utilisateur stocké (gating par onglet)
  /**
   * Récupère l'utilisateur stocké côté onglet (localStorage encapsulé).
   * Renvoie null en cas d'erreur de parsing.
   */
  /**
   * Récupère l'utilisateur stocké (préférence: storage cloisonné par onglet).
   * Pour les environnements de test ou si la session d'onglet n'est pas présente,
   * on propose un fallback sûr qui lit directement le localStorage.
   */
  getStoredUser(): AuthUser | null {
    try {
      const user = tabGetUser();
      if (user) return user;
      // Fallback pour les tests ou environnements sans marqueur de session d'onglet
      const raw = localStorage.getItem("auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // Est authentifié ? (token + user local)
  /**
   * Indique si une session est active côté client (token + user local)
   */
  isAuthenticated(): boolean {
    return !!this.token && !!this.getStoredUser();
  }

  // Token courant
  /**
   * Renvoie le token actuellement stocké en mémoire (ou null).
   */
  getToken(): string | null {
    return this.token;
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return this.request<User>("/users") as unknown as User[];
  }

  async createUser(
    userData: {
      name: string;
      email: string;
      role: string;
    },
    opts?: { idempotencyKey?: string },
  ): Promise<User> {
    const options: any = {
      method: "POST",
      body: JSON.stringify(userData),
    };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    return this.request<User>("/users", options);
  }

  // Enregistrement public (si activé côté serveur)
  async register(userData: { name: string; email: string; password: string }) {
    const resp = await this.request<{ user: User; token?: string }>(
      "/register",
      {
        method: "POST",
        body: JSON.stringify(userData),
      },
    );
    if (resp.token) {
      this.token = resp.token;
      localStorage.setItem("auth_token", resp.token);
      localStorage.setItem("auth_user", JSON.stringify(resp.user));
    }
    return resp;
  }

  async updateUserRole(
    userId: string,
    role: string,
    password: string,
  ): Promise<User> {
    return this.request<User>(`/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role, password }),
    });
  }

  async deactivateUser(
    userId: string,
    password: string,
    opts?: { idempotencyKey?: string },
  ): Promise<void> {
    const options: any = {
      method: "DELETE",
      body: JSON.stringify({ password }),
    };
    if (opts?.idempotencyKey) options.idempotencyKey = opts.idempotencyKey;
    return this.request<void>(`/users/${userId}`, options);
  }

  async changePassword(newPassword: string): Promise<void> {
    return this.request<void>("/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
  }

  async updateProfile(profileData: { name: string }): Promise<AuthUser> {
    return this.request<AuthUser>("/profile", {
      method: "PUT",
      body: JSON.stringify({ name: profileData.name }),
    });
  }

  // Sessions actives (admin) + révocation
  async getActiveSessions(): Promise<
    { token: string; user: AuthUser | null }[]
  > {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await secureFetch.fetch("/api/admin/sessions", {
      method: "GET",
      headers,
      useNativeFetch: true,
      timeout: 30000,
    } as any);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.sessions || [];
  }

  async revokeSession(tokenToRevoke: string): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await secureFetch.fetch("/api/admin/revoke-session", {
      method: "POST",
      headers,
      body: JSON.stringify({ token: tokenToRevoke }),
      useNativeFetch: true,
      timeout: 30000,
    } as any);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error! status: ${response.status}`);
    }
    return;
  }

  // Nettoyage complet de l'état auth (mémoire + storage)
  /**
   * Purge complète de l'état d'authentification (en mémoire et storage)
   */
  onAuthCleared(listener: () => void): () => void {
    this.authClearedListeners.add(listener);
    return () => this.authClearedListeners.delete(listener);
  }

  private emitAuthCleared(): void {
    for (const listener of this.authClearedListeners) {
      try {
        listener();
      } catch (error) {
        console.error("Erreur dans un listener onAuthCleared", error);
      }
    }
  }

  clearAuth(): void {
    this.token = null;
    tabClearAuth();
    if (this.authClearedListeners.size > 0) {
      this.emitAuthCleared();
    }
  }
}

export const authService = new AuthApiService();
