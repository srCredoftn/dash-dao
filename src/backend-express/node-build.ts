/**
Rôle: Entrée/Bootstrap backend — src/backend-express/node-build.ts
Domaine: Backend/Core
Dépendances: path, ./index, express
*/
import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

// En production : servir les fichiers SPA construits
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Servir les fichiers statiques
app.use(express.static(distPath));

// Gérer React Router — renvoyer index.html pour toutes les routes non-API
app.get("*", (req, res) => {
  // Ne pas servir index.html pour les routes API
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res
      .status(404)
      .json({ error: "Point de terminaison API introuvable" });
  }

  return res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Arrêt gracieux
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
