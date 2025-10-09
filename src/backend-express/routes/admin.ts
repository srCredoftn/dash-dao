/**
Rôle: Route API Express — src/backend-express/routes/admin.ts
Domaine: Backend/Routes
Exports: createAdminRoutes
Dépendances: express, ../data/daoStorage, ../services/notificationService, ../services/authService, ../utils/idempotency
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import express from "express";
import { daoStorage } from "../data/daoStorage";
import { NotificationService } from "../services/notificationService";
import { AuthService } from "../services/authService";
import { DaoService } from "../services/daoService";
import { tplDaoDeleted } from "../services/notificationTemplates";
import {
  sendEmail,
  emailAllUsers,
  getEmailDiagnostics,
  clearEmailDiagnostics,
} from "../services/txEmail";
import { getIdempotency, setIdempotency } from "../utils/idempotency";

/**
 * Fabrique de routes admin recevant un setter du bootId runtime.
 * Permet de régénérer un identifiant côté serveur pour forcer le purge côté client.
 */
export default function createAdminRoutes(setBootId: (id: string) => string) {
  const router = express.Router();

  /**
   * POST /api/admin/reset-app
   * Réinitialise l'application (données + sessions), optionnellement fait tourner le bootId.
   * Body: { rotateBootId?: boolean, seedDaos?: boolean }
   * Sécurité: en prod, requiert un JWT admin (Authorization: Bearer ...).
   */
  // Body: { rotateBootId?: boolean, seedDaos?: boolean }
  router.post("/reset-app", async (req, res) => {
    try {
      // En production, exiger un jeton admin. En développement, autoriser des réinitialisations locales sans authentification.
      if (process.env.NODE_ENV === "production") {
        // Exige l’en-tête Authorization
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

      const { rotateBootId = true, seedDaos = false } = req.body || {};

      // Nettoyer les données côté serveur (BD ou mémoire)
      try {
        await DaoService.clearAll();
      } catch (e) {
        // Repli vers daoStorage.clear() si l’effacement via DaoService échoue
        try {
          daoStorage.clearAll(Boolean(seedDaos));
        } catch (_) {}
      }

      NotificationService.clearAll();

      // Réinitialiser les utilisateurs et sessions d’auth par défaut
      await AuthService.reinitializeUsers();
      await AuthService.clearAllSessions();

      // Rotation optionnelle du bootId pour forcer les clients à purger le stockage local
      let newBootId: string | null = null;
      if (rotateBootId) {
        const generated = Math.random().toString(36).slice(2, 14);
        newBootId = setBootId(generated);
      }

      return res.json({ ok: true, bootId: newBootId });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  /**
   * GET /api/admin/sessions
   * Liste les sessions actives.
   * Dev: sans auth. Prod: JWT admin requis.
   */
  router.get("/sessions", async (req, res) => {
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

      const sessions = await AuthService.listActiveSessions();
      return res.json({ sessions, count: sessions.length });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  /**
   * POST /api/admin/revoke-session
   * Révoque un token d'accès précis.
   * Prod: JWT admin requis.
   */
  router.post("/revoke-session", async (req, res) => {
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

      const { token: tokenToRevoke } = req.body || {};
      if (!tokenToRevoke || typeof tokenToRevoke !== "string") {
        return res
          .status(400)
          .json({ error: "Le jeton est requis dans le corps de la requête" });
      }

      await AuthService.logout(tokenToRevoke);
      return res.json({ ok: true, revoked: tokenToRevoke });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  /**
   * POST /api/admin/send-test-email
   * Envoie une notification système et un email de test (destinataire(s) optionnels).
   * Body: { to?: string | string[], message?: string }
   * Prod: JWT admin requis.
   */
  // Body: { to?: string | string[], message?: string }
  router.post("/send-test-email", async (req, res) => {
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

      const { to, message } = req.body || {};
      const text =
        typeof message === "string" && message.trim()
          ? message.trim()
          : "Test de notification et d'email depuis la plateforme";

      // Créer une notification (diffusion globale ou ciblée)
      // Créer une notification sans miroir email pour éviter le double envoi
      const notif = await NotificationService.broadcast(
        "system",
        "Test d\u2019envoi",
        text,
        { test: true, skipEmailMirror: true },
      );

      // Envoi d’e-mail : si "to" est fourni, envoi direct ; sinon diffusion à tous les utilisateurs
      let emailResult: any = { sent: false };
      try {
        if (to) {
          if (Array.isArray(to)) {
            await sendEmail(
              to,
              "Gestion des DAOs 2SND - Test",
              text,
              "SYSTEM_TEST",
            );
          } else {
            await sendEmail(
              String(to),
              "Gestion des DAOs 2SND - Test",
              text,
              "SYSTEM_TEST",
            );
          }
          emailResult.sent = true;
        } else {
          await emailAllUsers(
            "Gestion des DAOs 2SND - Test",
            text,
            "SYSTEM_TEST",
          );
          emailResult.sent = true;
        }
      } catch (e) {
        emailResult.error = String((e as Error)?.message || e);
      }

      return res.json({
        ok: true,
        notif: notif?.id || null,
        email: emailResult,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  /**
   * DELETE /api/admin/delete-last-dao
   * Supprime le DAO le plus récent.
   * Sécurité: JWT admin + mot de passe du super admin dans le corps.
   * Idempotence: x-idempotency-key supporté.
   */
  router.delete("/delete-last-dao", async (req, res) => {
    try {
      const idempKey = (req.header("x-idempotency-key") || "").trim();
      if (idempKey) {
        const cached = getIdempotency(idempKey);
        if (cached) return res.json(cached);
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ error: "Interdit : jeton manquant" });
      }
      const token = authHeader.substring(7);
      const verified = await AuthService.verifyToken(token);
      if (!verified || verified.role !== "admin") {
        return res.status(403).json({ error: "Interdit : jeton invalide" });
      }

      // Exiger le mot de passe du super administrateur pour l’action destructive
      const pwd = (req.body?.password || "").toString();
      if (!pwd) {
        return res.status(400).json({ error: "Le mot de passe est requis" });
      }
      const superAdmin = AuthService.getSuperAdmin();
      if (!superAdmin) {
        return res
          .status(403)
          .json({ error: "Aucun super administrateur configuré" });
      }
      const valid = await AuthService.verifyPasswordById(superAdmin.id, pwd);
      if (!valid) {
        return res
          .status(403)
          .json({ error: "Mot de passe invalide", code: "INVALID_PASSWORD" });
      }

      const last = await DaoService.getLastCreatedDao();
      if (!last) {
        return res
          .status(404)
          .json({ error: "Aucun DAO à supprimer", code: "NO_DAO" });
      }

      const ok = await DaoService.deleteDao(last.id);
      if (!ok) {
        return res
          .status(404)
          .json({ error: "DAO introuvable", code: "DAO_NOT_FOUND" });
      }

      try {
        const t = tplDaoDeleted(last);
        NotificationService.broadcast(t.type, t.title, t.message, t.data);
        // Système d’e-mail centralisé utilisé ; aucune invocation de l’ancien EmailService
      } catch (_) {}

      const response = { deletedId: last.id, numeroListe: last.numeroListe };
      if (idempKey) setIdempotency(idempKey, response);

      return res.json(response);
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  // GET /api/admin/mail-diagnostics — état SMTP et derniers envois
  router.get("/mail-diagnostics", async (req, res) => {
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
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  router.post("/mail-diagnostics/clear", async (req, res) => {
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
      clearEmailDiagnostics();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  // GET /api/admin/auto-user-audit - list recent auto-created/reactivated accounts
  router.get("/auto-user-audit", async (req, res) => {
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
      const limit = Number(req.query.limit || 50);
      const { listAutoUserEvents } = await import("../services/autoUserAudit");
      const events = listAutoUserEvents(Math.max(1, Math.min(200, limit)));
      return res.json({ ok: true, events });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  router.post("/auto-user-audit/clear", async (req, res) => {
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
      const { clearAutoUserEvents } = await import("../services/autoUserAudit");
      clearAutoUserEvents();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  return router;
}
