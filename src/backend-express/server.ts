#!/usr/bin/env tsx
/**
Rôle: Entrée/Bootstrap backend — src/backend-express/server.ts
Domaine: Backend/Core
Dépendances: ./index.js, ./utils/logger.js
Sécurité: veille à la validation d’entrée, gestion JWT/refresh
*/
/**
 * Bootstrap serveur: instancie l'app Express et démarre l'écoute, logs, arrêt gracieux.
 */
import { createServer } from "./index.js";
import { logger } from "./utils/logger.js";

const app = createServer();
const PORT = Number(process.env.BACKEND_PORT || 3001);

app.listen(PORT, () => {
  logger.info(
    `🚀 Serveur backend sécurisé démarré sur le port ${PORT}`,
    "SERVER",
  );
  logger.info(`🔐 Fonctionnalités de sécurité activées :`, "SERVER");
  logger.info(`  ✅ Hachage des mots de passe avec bcrypt`, "SERVER");
  logger.info(`  ✅ Jetons JWT avec expiration`, "SERVER");
  logger.info(`  ✅ Validation des entrées`, "SERVER");
  logger.info(`  ✅ Protection CORS`, "SERVER");
  logger.info(`  ✅ En-têtes de sécurité Helmet`, "SERVER");
  logger.info(`  ✅ Journalisation d'audit`, "SERVER");
  logger.info(
    `📡 Endpoints API disponibles sur http://localhost:${PORT}/api/`,
    "SERVER",
  );
});

// Arrêt gracieux
process.on("SIGTERM", () => {
  logger.info("🔄 SIGTERM reçu, arrêt gracieux en cours", "SERVER");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🔄 SIGINT reçu, arrêt gracieux en cours", "SERVER");
  process.exit(0);
});
