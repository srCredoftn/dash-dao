/**
Rôle: Utilitaires Frontend — src/frontend/utils/fetch-test.ts
Domaine: Frontend/Utils
Dépendances: ./simple-fetch
*/
// Utilitaire de test pour la fonctionnalité fetch
import { simpleFetch } from "./simple-fetch";

export async function testFetchFunctionality() {
  console.log("🧪 Testing fetch functionality...");

  try {
    // Test GET simple
    console.log("📡 Testing GET request to /api/health...");
    const response = await simpleFetch.get("/api/health");

    if (response.ok) {
      console.log("✅ Fetch test successful!");
      const data = await response.json().catch(() => ({}));
      console.log("📋 Response data:", data);
      return { success: true, data };
    } else {
      console.log("⚠️ Fetch test returned non-OK status:", response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error("❌ Fetch test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Fonction de test à appeler depuis la console ou des composants
export async function runFetchDiagnostic() {
  console.log("🔍 Running fetch diagnostic...");

  // Test 1 : Fonctionnalité de fetch de base
  const basicTest = await testFetchFunctionality();

  // Test 2 : Vérifier la disponibilité de window.fetch
  const windowFetchAvailable =
    typeof window !== "undefined" && typeof window.fetch === "function";

  // Test 3 : Vérifier les signatures d'erreur
  const fetchString =
    typeof window !== "undefined" ? window.fetch.toString() : "N/A";
  const hasInterceptors =
    fetchString.toLowerCase().includes("fullstory") ||
    fetchString.toLowerCase().includes("sentry");

  const diagnostic = {
    basicFetchTest: basicTest,
    windowFetchAvailable,
    hasInterceptors,
    fetchSource: fetchString.substring(0, 100) + "...",
    timestamp: new Date().toISOString(),
  };

  console.log("📊 Fetch diagnostic results:", diagnostic);
  return diagnostic;
}

// Export pour un accès facile depuis la console du navigateur
if (typeof window !== "undefined") {
  (window as any).testFetch = testFetchFunctionality;
  (window as any).runFetchDiagnostic = runFetchDiagnostic;
}
