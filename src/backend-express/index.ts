/**
Rôle: Entrée/Bootstrap backend — src/backend-express/index.ts
Domaine: Backend/Core
Exports: createServer
Dépendances: express, cors, helmet, ./utils/logger, ./routes/demo, ./routes/dao-simple
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, configuration CORS
Performance: cache/partitionnement/bundling optimisés
*/
/**
 * Express app: sécurité (helmet, CORS), routes API, boot/reset, logs, gestion d'erreurs.
 * Utilisé par server.ts pour démarrer le backend.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { logger, requestLogger } from "./utils/logger";
import { retryMiddleware } from "./middleware/retry";
import { handleDemo } from "./routes/demo";
import daoRoutes from "./routes/dao-simple";
import authRoutes from "./routes/auth";
import commentRoutes from "./routes/comments";
import taskRoutes from "./routes/tasks";
import createAdminRoutes from "./routes/admin";
import notificationsRoutes from "./routes/notifications";

// Import statiques pour réduire les imports dynamiques et éviter duplication de chunks
import { assertDbConnectivityIfRequired } from "./config/runtime";
import { AuthService } from "./services/authService";
import { DaoService } from "./services/daoService";
import { getEmailDiagnostics } from "./services/txEmail";
import { daoStorage } from "./data/daoStorage";

export function createServer(): express.Application {
  const app = express();

  // Vérification optionnelle de la connectivité DB selon les flags runtime
  (async () => {
    try {
      await assertDbConnectivityIfRequired();
    } catch (e) {
      logger.error("Startup DB check failed", "SERVER");
      if (
        (process.env.STRICT_DB_MODE || "false").toLowerCase() === "true" &&
        (process.env.FALLBACK_ON_DB_ERROR || "true").toLowerCase() !== "true"
      ) {
        setTimeout(() => process.exit(1), 10);
      }
    }
  })();

  // Identifiant de boot runtime (peut être tourné sans redémarrer)
  let runtimeBootId = process.env.TOKEN_BOOT_ID || `dev-${Date.now()}`;
  /**
   * Met à jour l'identifiant de boot runtime utilisé pour forcer
   * la purge du stockage local côté client lorsqu'une réinitialisation
   * contrôlée est effectuée sans redémarrage du serveur.
   * @param id Nouvel identifiant de boot
   * @returns L'identifiant de boot mis à jour
   */
  function setRuntimeBootId(id: string) {
    runtimeBootId = id;
    return runtimeBootId;
  }

  // Middleware de sécurité
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Autoriser l’intégration (embedding) en développement
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Configuration CORS — restrictive en production, permissive en développement (autorise l’origine de prévisualisation Builder)
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Autoriser les outils non-navigateur ou les requêtes same-origin (absence d'origin)
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV === "production") {
        const allowed = process.env.FRONTEND_URL;
        return callback(null, origin === allowed);
      }
      // En développement, autoriser n’importe quelle origine (utile pour les environnements de preview)
      return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
  app.use(cors(corsOptions));

  // Middleware d’analyse du corps avec limites de taille
  app.use(
    express.json({
      limit: "10mb",
      verify: (_req, _res, buf, encoding) => {
        // Validation basique de la structure JSON
        if (buf && buf.length) {
          try {
            JSON.parse(buf.toString((encoding as BufferEncoding) || "utf8"));
          } catch (err) {
            // Créer une erreur HTTP typee au lieu d'utiliser any
            interface HttpError extends Error {
              status: number;
            }
            const error = new Error("Invalid JSON") as HttpError;
            error.status = 400;
            throw error;
          }
        }
      },
    }),
  );

  // Exposer le bootId courant aux clients via un header sur toutes les réponses afin que
  // le frontend puisse purger automatiquement le stockage local obsolète sans intervention manuelle
  app.use((_req, res, next) => {
    try {
      res.setHeader("X-Boot-Id", runtimeBootId);
    } catch (_) {}
    next();
  });
  app.use(
    express.urlencoded({
      extended: true,
      limit: "10mb",
    }),
  );

  // En-têtes de sécurité
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });

  // Request logging avec le nouveau système
  app.use(requestLogger());

  // Middleware d’aide au retry (ajoute req.retry)
  app.use(retryMiddleware(3, 200));

  // Endpoint de vérification de santé
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Endpoint d’informations de démarrage utilisé par le frontend pour invalider le stockage local entre les déploiements
  app.get("/api/boot", (_req, res) => {
    const shouldSeed =
      process.env.SEED_DAOS === "1" || process.env.SEED_DAOS === "true";
    res.json({
      bootId: runtimeBootId,
      seedDaos: shouldSeed,
      serverTime: new Date().toISOString(),
    });
  });

  app.get("/api/system/mail/diagnostics", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production") {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Interdit : jeton manquant" });
        }
        const token = authHeader.substring(7);
        const verified = await AuthService.verifyToken(token);
        if (!verified || verified.role !== "admin") {
          return res.status(403).json({ error: "Interdit : jeton invalide" });
        }
      }
      const diag = getEmailDiagnostics();
      return res.json({ ok: true, ...diag });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: String((error as Error)?.message || error),
      });
    }
  });

  // Effectuer une réinitialisation runtime SÛRE UNIQUEMENT lorsque TRIGGER_RESET est explicitement activé
  // Tente d'abord de vider les DAO persistés en BD, en se rabattant sur le stockage en mémoire en cas d'échec.
  const shouldRuntimeReset =
    process.env.TRIGGER_RESET === "1" || process.env.TRIGGER_RESET === "true";
  if (shouldRuntimeReset) {
    (async () => {
      try {
        logger.info("Runtime reset requested", "BOOT");
        // Tenter d'effacer d'abord le stockage persistant (BD)
        try {
          await DaoService.clearAll();
          logger.info("DAOs cleared", "BOOT");
        } catch (dbErr) {
          // Repli : vidage du stockage en mémoire
          try {
            daoStorage.clearAll(false);
            logger.info("DAOs cleared (in-memory fallback)", "BOOT");
          } catch (fallbackErr) {
            logger.error("Échec du vidage des DAO", "BOOT", {
              message: String((fallbackErr as Error)?.message),
            });
          }
        }

        // Effacer les sessions et réinitialiser les utilisateurs selon l’environnement
        await AuthService.clearAllSessions();
        await AuthService.reinitializeUsers();

        // Rotation du boot id runtime pour forcer les clients frontend à purger le stockage local
        const newBoot = `boot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        setRuntimeBootId(newBoot);
        logger.info("BootId rotated", "BOOT");

        logger.info("Runtime reset complete", "BOOT");
      } catch (err) {
        logger.error("Runtime reset failed", "BOOT", {
          message: String((err as Error)?.message),
        });
      }
    })();
  } else {
    logger.info("Runtime reset skipped", "BOOT");
  }

  // Exemples de routes API
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong - secure";
    res.json({ message: ping, timestamp: new Date().toISOString() });
  });

  app.get("/api/demo", handleDemo);

  // Routes API
  app.use("/api/dao", daoRoutes);
  app.use("/api/dao", taskRoutes); // Task routes are nested under /api/dao
  app.use("/api/auth", authRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/notifications", notificationsRoutes);

  // Routes admin (réinitialisation du runtime sans redémarrage)
  try {
    const adminRouter = createAdminRoutes(setRuntimeBootId);
    app.use("/api/admin", adminRouter);
  } catch (e) {
    console.warn("Échec d'enregistrement des routes admin :", e);
  }

  // Gestionnaire 404
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Route introuvable",
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Gestionnaire d’erreurs global
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error(
        "Erreur non gérée",
        "ERROR_HANDLER",
        {
          message: String(err?.message || err),
          url: req.originalUrl,
          method: req.method,
        },
        (req as any).user?.id,
        req.ip,
      );

      const status = Number(err?.status) || 500;
      const generic = status >= 500;
      res.status(status).json({
        error: generic
          ? "Erreur interne du serveur"
          : String(err?.message || "Erreur"),
        timestamp: new Date().toISOString(),
      });
    },
  );

  return app;
}
