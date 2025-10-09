/**
Rôle: Utilitaires Frontend — src/frontend/utils/auth-storage.ts
Domaine: Frontend/Utils
Exports: startTabSession, setAuth, clearAuth, getToken, getUser
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
/**
 * Stockage d'authentification centralisé avec cloisonnement par onglet
 * - Expose token/user uniquement si un marqueur de session d'onglet est présent
 * - Limite les fuites entre onglets et réduit l'impact des captures locales
 */

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const TAB_MARKER = "tab_session_active_v1";

function hasTabSession(): boolean {
  try {
    return sessionStorage.getItem(TAB_MARKER) === "1";
  } catch {
    return false;
  }
}

export function startTabSession(): void {
  try {
    sessionStorage.setItem(TAB_MARKER, "1");
  } catch {}
}

export function setAuth(token: string, userJson: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, userJson);
    startTabSession();
  } catch {}
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // NE PAS supprimer TAB_MARKER pour garder cet onglet contrôlé ; il sera recréé à la prochaine connexion
  } catch {}
}

export function getToken(): string | null {
  try {
    if (!hasTabSession()) return null;
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): any | null {
  try {
    if (!hasTabSession()) return null;
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
