/**
Rôle: Utilitaires Frontend — src/frontend/utils/auth-debug.ts
Domaine: Frontend/Utils
Exports: setupAuthDebug
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
// Outils de débogage de l'authentification
// Ces fonctions sont disponibles uniquement en développement

declare global {
  interface Window {
    clearAuth: () => void;
    showAuthDebug: () => void;
    forceLogin: () => void;
  }
}

export function setupAuthDebug() {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // Effacer toutes les données d'authentification
  window.clearAuth = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    console.log(
      "🧹 Auth data cleared. Reload the page to see the login screen.",
    );
  };

  // Afficher l'état d'authentification actuel
  window.showAuthDebug = () => {
    const token = localStorage.getItem("auth_token");
    const user = localStorage.getItem("auth_user");

    console.log("🔍 Auth Debug Info:");
    console.log("Token exists:", !!token);
    console.log(
      "Token (first 20 chars):",
      token?.substring(0, 20) + "..." || "none",
    );
    try {
      const parsed = user ? JSON.parse(user) : null;
      const safe = parsed ? { ...parsed, email: "[redacted-email]" } : "none";
      console.log("User data:", safe);
    } catch {
      console.log("User data: none");
    }

    if (token) {
      // Tenter de décoder le payload du JWT (sans vérification)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("Token expires:", new Date(payload.exp * 1000));
        console.log("Token expired:", Date.now() > payload.exp * 1000);
      } catch (e: any) {
        console.log("Could not decode token:", e?.message || e);
      }
    }
  };

  // Forcer la redirection vers la page de connexion
  window.forceLogin = () => {
    window.clearAuth();
    window.location.href = "/login";
  };

  console.log("🛠️ Auth debug utilities loaded:");
  console.log("  - clearAuth() - Clear all auth data");
  console.log("  - showAuthDebug() - Show current auth state");
  console.log("  - forceLogin() - Clear auth and go to login");
}
