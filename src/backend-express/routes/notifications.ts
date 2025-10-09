/**
Rôle: Route API Express — src/backend-express/routes/notifications.ts
Domaine: Backend/Routes
Exports: default
Dépendances: express, ../middleware/auth, ../services/notificationService
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { NotificationService } from "../services/notificationService";

const router = express.Router();

/**
 * GET /api/notifications
 * Liste les notifications de l'utilisateur courant.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const list = await NotificationService.listForUser(req.user!.id);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marque une notification comme lue.
 */
router.put("/:id/read", authenticate, (req, res) => {
  const ok = NotificationService.markRead(req.user!.id, req.params.id);
  if (!ok) return res.status(404).json({ error: "Notification introuvable" });
  return res.json({ ok: true });
});

/**
 * PUT /api/notifications/read-all
 * Marque toutes les notifications de l'utilisateur comme lues.
 */
router.put("/read-all", authenticate, (req, res) => {
  const count = NotificationService.markAllRead(req.user!.id);
  return res.json({ ok: true, count });
});

/**
 * POST /api/notifications/test-email
 * Envoie un e-mail de test à l’administrateur pour vérifier la configuration SMTP.
 * Sécurité: admin uniquement.
 */
router.post("/test-email", authenticate, async (req, res) => {
  try {
    const { requireAdmin } = await import("../middleware/auth");
    // Exécuter le middleware requireAdmin manuellement ici
    await new Promise<void>((resolve, reject) => {
      (requireAdmin as any)(req, res, (err?: any) => (err ? reject(err) : resolve()));
    });

    const { sendEmail } = await import("../services/txEmail");
    const to = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (!to) {
      return res.status(400).json({ ok: false, error: "ADMIN_EMAIL manquant" });
    }
    await sendEmail(
      to,
      "[Test] Vérification de l’envoi d’e-mail",
      "Ceci est un e-mail de test généré par /api/notifications/test-email.",
      "SYSTEM_TEST",
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

export default router;
