/**
Rôle: Utilitaires Frontend — src/frontend/utils/auth-cleanup.ts
Domaine: Frontend/Utils
Exports: clearAuthenticationData, checkAuthState, forceCleanRestart
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
/**
 * Utilitaire pour nettoyer les données d'authentification
 * Utile lorsque les jetons deviennent invalides après un redémarrage du serveur
 */

export function clearAuthenticationData() {
  try {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");

    // Clear any other auth-related data that might exist
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("auth") ||
          key.includes("token") ||
          key.includes("session"))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    console.log("🧹 Données d'authentification supprimées avec succès");
    console.log("🔄 Veuillez actualiser la page et vous reconnecter");

    return true;
  } catch (error) {
    console.error(
      "❌ Échec du nettoyage des données d'authentification :",
      error,
    );
    return false;
  }
}

/**
 * Vérifie si l'état d'authentification courant semble problématique
 */
export function checkAuthState() {
  const token = localStorage.getItem("auth_token");
  const user = localStorage.getItem("auth_user");

  console.log("🔍 État d'authentification actuel :");
  console.log("Jeton présent :", !!token);
  console.log("Données utilisateur présentes :", !!user);

  if (token && user) {
    try {
      const userData = JSON.parse(user);
      console.log("Utilisateur : [email masqué] Rôle :", userData.role);
    } catch (error) {
      console.warn("⚠️ Les données utilisateur semblent corrompues");
      return false;
    }
  }

  return true;
}

/**
 * Force a clean logout and page refresh
 */
export function forceCleanRestart() {
  clearAuthenticationData();

  // Wait a bit then refresh
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Make functions available globally for debugging
if (typeof window !== "undefined") {
  (window as any).authDebug = {
    clear: clearAuthenticationData,
    check: checkAuthState,
    restart: forceCleanRestart,
  };
}
