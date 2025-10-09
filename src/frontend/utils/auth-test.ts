/**
Rôle: Utilitaires Frontend — src/frontend/utils/auth-test.ts
Domaine: Frontend/Utils
Exports: runAuthTest
Dépendances: @/services/authService
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
// Utilitaire de test pour vérifier l'authentification
import { authService } from "@/services/authService";

export async function testAuthRecovery() {
  console.log("🧪 Testing auth recovery after server restart...");

  try {
    // Vérifier si nous avons un token stocké
    const token = authService.getToken();
    console.log("🔑 Stored token exists:", !!token);

    if (!token) {
      console.log("❌ No token found, user needs to login");
      return { success: false, reason: "no_token" };
    }

    // Tester l'endpoint /me pour vérifier si le token est encore valide
    console.log("📡 Testing /me endpoint...");
    const userInfo = await authService.getCurrentUser();

    if (userInfo) {
      console.log("✅ Auth recovery successful!");
      console.log("👤 Current user: [redacted-email]");
      return { success: true, user: userInfo };
    } else {
      console.log("❌ Token invalid, user needs to re-login");
      return { success: false, reason: "invalid_token" };
    }
  } catch (error) {
    console.error("❌ Auth test failed:", error);
    return {
      success: false,
      reason: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fonction à appeler depuis la console du navigateur pour tester
export function runAuthTest() {
  testAuthRecovery().then((result) => {
    console.log("🔍 Auth test result:", {
      ...result,
      user:
        result && typeof result === "object" && "user" in result
          ? { ...(result as any).user, email: "[redacted-email]" }
          : undefined,
    });
  });
}

// Rendre disponible globalement pour les tests manuels
if (typeof window !== "undefined") {
  (window as any).testAuth = runAuthTest;
  (window as any).authService = authService;
}
