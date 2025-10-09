/**
Rôle: Module TypeScript — src/frontend/main.tsx
Domaine: Général
Dépendances: react-dom/client, ./App
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * Point d'entrée SPA (client): nettoyage stockage initial, vérification bootId (/api/boot), HMR et rendu App.
 */
import { createRoot } from "react-dom/client";
import App from "./App";
import secureFetch from "@/utils/secure-fetch";

// Masquer les données sensibles dans la console en production
(function secureConsole() {
  try {
    const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const bearerRe = /(Bearer\s+)[A-Za-z0-9-_.]+/gi;
    const tokenRe =
      /(["']?(?:auth_token|token|jwt)["']?\s*[:=]\s*["'])[A-Za-z0-9-_.]+(["'])/gi;
    const redact = (v: any): any => {
      if (typeof v === "string")
        return v
          .replace(emailRe, "[redacted-email]")
          .replace(bearerRe, "$1[redacted]")
          .replace(tokenRe, "$1[redacted]$2");
      if (v && typeof v === "object") {
        try {
          return JSON.parse(
            JSON.stringify(v, (_k, val) =>
              typeof val === "string"
                ? val.replace(emailRe, "[redacted-email]")
                : val,
            ),
          );
        } catch {
          return "[object]";
        }
      }
      return v;
    };
    const mute = true;
    ["log", "info", "warn", "debug"].forEach((m) => {
      const orig = (console as any)[m]?.bind(console);
      (console as any)[m] = mute
        ? () => {}
        : (...args: any[]) => orig(...args.map(redact));
    });
    (console as any)["error"] = () => {
      // Message d’erreur générique uniquement
      Function.prototype.call.call(
        console.log,
        console,
        "Une erreur est survenue",
      );
    };
  } catch {}
})();

// Vérifier que l'élément root existe
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Élément racine introuvable");
}

// Nettoyer le stockage local au premier lancement pour éviter des tokens/caches obsolètes
try {
  const FIRST_RUN_KEY = "app_initialized_v1";
  if (!localStorage.getItem(FIRST_RUN_KEY)) {
    // Clear auth
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");

    // Clear notifications and misc cached items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("notification") ||
          key.includes("cache") ||
          key.includes("dao") ||
          key.includes("DAO") ||
          key.startsWith("avatar_user_"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    localStorage.setItem(FIRST_RUN_KEY, new Date().toISOString());
    console.log("✨ Première exécution : stockage nettoyé");
  }
} catch (e) {
  console.warn("Nettoyage de première exécution ignoré :", e);
}

// Créer et gérer le root de manière sécurisée
let root: ReturnType<typeof createRoot> | null = null;

function renderApp() {
  if (!root) {
    root = createRoot(rootElement as HTMLElement);
  }
  root.render(<App />);
}

// Initialisation avec vérification du bootId serveur pour invalider les données locales
(async function init() {
  const BOOT_KEY = "boot_id_v1";
  try {
    const res = await secureFetch.fetch("/api/boot", {
      headers: { Accept: "application/json" },
      useNativeFetch: false,
      maxRetries: 1,
      timeout: 5000,
    } as any);
    if (res.ok) {
      const data: { bootId?: string } = await res.json();
      const serverBootId = String(data.bootId || "dev");
      const storedBootId = localStorage.getItem(BOOT_KEY);

      if (!storedBootId || storedBootId !== serverBootId) {
        // Nouveau déploiement/démarrage détecté -> nettoyer les données sensibles locales
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        localStorage.removeItem("notifications");
        localStorage.removeItem("notification_settings");

        // Nettoyer aussi les clés associées aux caches/dao
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.includes("notification") ||
              key.includes("cache") ||
              key.includes("dao") ||
              key.includes("DAO") ||
              key.startsWith("avatar_user_"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Sauvegarder le nouveau bootId
        localStorage.setItem(BOOT_KEY, serverBootId);
        console.log(
          "🔐 Nouveau bootId détecté, nettoyage du stockage local effectué",
        );
      }
    }
  } catch (e) {
    console.warn(
      "Échec de la vérification du démarrage, poursuite sans nettoyage :",
      e,
    );
  }

  // Rendu initial
  renderApp();
})();

// Hot Module Replacement (HMR) pour le développement
if (import.meta.hot) {
  import.meta.hot.accept("./App", () => {
    console.log("🔄 HMR : composant App mis à jour");
    renderApp();
  });

  import.meta.hot.accept("./components/AppContent", () => {
    console.log("🔄 HMR : composant AppContent mis à jour");
    renderApp();
  });
}
