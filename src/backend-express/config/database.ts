/**
Rôle: Configuration backend — src/backend-express/config/database.ts
Domaine: Backend/Config
Dépendances: mongoose, ../utils/logger.js
Performance: cache/partitionnement/bundling optimisés
*/
import mongoose, { type ConnectOptions } from "mongoose";
import { logger } from "../utils/logger.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/dao-management";

// Options fail-fast pour éviter de longs délais de démarrage lorsque MongoDB n'est pas disponible localement
// En développement, on garde des timeouts très courts pour basculer immédiatement vers le stockage en mémoire
const isProduction = process.env.NODE_ENV === "production";
const FAST_FAIL = process.env.MONGODB_FAST_FAIL !== "0"; // default true
const connectOptions: ConnectOptions = {
  serverSelectionTimeoutMS: FAST_FAIL ? (isProduction ? 5000 : 800) : undefined,
  connectTimeoutMS: FAST_FAIL ? (isProduction ? 5000 : 800) : undefined,
  maxPoolSize: 5,
};

export async function connectToDatabase() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, connectOptions);
      logger.info("✅ Connecté à MongoDB", "DATABASE");
    }
    return mongoose.connection;
  } catch (error) {
    logger.error("❌ Erreur de connexion à MongoDB", "DATABASE", error);
    throw error;
  }
}

export async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    logger.info("🔌 Déconnecté de MongoDB", "DATABASE");
  } catch (error) {
    logger.error(
      "❌ Erreur lors de la déconnexion de MongoDB",
      "DATABASE",
      error,
    );
    throw error;
  }
}

// Gestion des événements de connexion
mongoose.connection.on("connected", () => {
  logger.info("🟢 Mongoose connecté à MongoDB", "DATABASE");
});

mongoose.connection.on("error", (err) => {
  logger.error("🔴 Erreur de connexion Mongoose", "DATABASE", err);
});

mongoose.connection.on("disconnected", () => {
  logger.info("🟡 Mongoose déconnecté de MongoDB", "DATABASE");
});

// Arrêt gracieux
process.on("SIGINT", async () => {
  await disconnectFromDatabase();
  process.exit(0);
});
