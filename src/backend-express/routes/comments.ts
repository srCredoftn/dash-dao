/**
Rôle: Route API Express — src/backend-express/routes/comments.ts
Domaine: Backend/Routes
Exports: default
Dépendances: express, ../services/commentService, ../middleware/auth, ../utils/idempotency, ../utils/logger, ../services/daoService, ../services/txEmail
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/*
  Routes CRUD pour les commentaires associés aux DAO/tâches
  - Fournissent endpoints GET/POST/PUT/DELETE pour gérer les TaskComments
  - Gèrent l'idempotence (x-idempotency-key), l'option silencieuse (x-no-notify) et
    la notification via NotificationService sauf si le header demande le silence
  - Les commentaires ci-dessous expliquent chaque route et son comportement attendu
*/
import express from "express";
import { CommentService } from "../services/commentService";
import { authenticate } from "../middleware/auth";
import { getIdempotency, setIdempotency } from "../utils/idempotency";
import { logger } from "../utils/logger";
import { DaoService } from "../services/daoService";
import { NotificationService } from "../services/notificationService";
import { tplTaskNotification } from "../services/notificationTemplates";

const router = express.Router();

/**
 * Initialise des commentaires d'exemple (développement/démonstration).
 */
CommentService.initializeSampleComments();

/**
 * GET /api/comments/dao/:daoId
 * Liste tous les commentaires d'un DAO.
 */
router.get("/dao/:daoId", authenticate, async (req, res) => {
  try {
    const { daoId } = req.params;
    const comments = await CommentService.getDaoComments(daoId);
    return res.json(comments);
  } catch (error) {
    logger.error(
      "Erreur lors de la récupération des commentaires du DAO",
      "COMMENTS",
    );
    return res
      .status(500)
      .json({ error: "Échec de la récupération des commentaires" });
  }
});

/**
 * GET /api/comments/dao/:daoId/task/:taskId
 * Liste les commentaires d'une tâche donnée.
 */
router.get("/dao/:daoId/task/:taskId", authenticate, async (req, res) => {
  try {
    const { daoId, taskId } = req.params;
    const comments = await CommentService.getTaskComments(
      daoId,
      parseInt(taskId),
    );
    return res.json(comments);
  } catch (error) {
    logger.error(
      "Erreur lors de la récupération des commentaires de la tâche",
      "COMMENTS",
    );
    return res
      .status(500)
      .json({ error: "Échec de la récupération des commentaires de la tâche" });
  }
});

/**
 * POST /api/comments
 * Ajoute un nouveau commentaire.
 * Corps: { daoId, taskId, content }
 * Idempotence: x-idempotency-key supporté.
 * Effets: notification (type comment) vers tous.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const idempKey = (req.header("x-idempotency-key") || "").trim();
    const noNotify =
      String(req.header("x-no-notify") || "").toLowerCase() === "true";
    if (idempKey) {
      const cached = getIdempotency(idempKey);
      if (cached) return res.status(201).json(cached);
    }

    const { daoId, taskId, content } = req.body;

    if (!daoId || taskId === undefined || !content?.trim()) {
      return res
        .status(400)
        .json({ error: "ID du DAO, ID de la tâche et contenu requis" });
    }

    const commentData = {
      daoId,
      taskId: parseInt(taskId),
      userId: req.user!.id,
      userName: req.user!.name,
      content: content.trim(),
    };

    const newComment = await CommentService.addComment(commentData);

    if (idempKey) setIdempotency(idempKey, newComment);

    // Diffuser une notification à tous les utilisateurs + Bus de mail (sauf en mode silencieux)
    if (!noNotify) {
      try {
        const dao = await DaoService.getDaoById(newComment.daoId);
        if (dao) {
          const task = dao.tasks.find((t) => t.id === newComment.taskId);
          if (task) {
            const notif = tplTaskNotification({
              dao,
              previous: task,
              current: task,
              changeType: "comment",
              comment: newComment.content,
            });
            NotificationService.broadcast(
              notif.type,
              notif.title,
              notif.message,
              notif.data,
            );
          }
        }
      } catch (_) {}
    }

    return res.status(201).json(newComment);
  } catch (error) {
    logger.error("Erreur lors de l'ajout du commentaire", "COMMENTS");
    return res.status(500).json({ error: "Échec de l'ajout du commentaire" });
  }
});

/**
 * PUT /api/comments/:id
 * Met à jour un commentaire (auteur uniquement).
 * Effets: notification (type comment) vers tous.
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Le contenu est requis" });
    }

    const updatedComment = await CommentService.updateComment(
      id,
      req.user!.id,
      content.trim(),
    );

    if (!updatedComment) {
      return res.status(404).json({ error: "Commentaire introuvable" });
    }

    // Diffuser une notification à tous les utilisateurs + Bus de mail
    try {
      const dao = await DaoService.getDaoById(updatedComment.daoId);
      if (dao) {
        const task = dao.tasks.find((t) => t.id === updatedComment.taskId);
        if (task) {
          const notif = tplTaskNotification({
            dao,
            previous: task,
            current: task,
            changeType: "comment",
            comment: updatedComment.content,
          });
          NotificationService.broadcast(
            notif.type,
            notif.title,
            notif.message,
            notif.data,
          );
        }
      }
    } catch (_) {}

    return res.json(updatedComment);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du commentaire", "COMMENTS");
    if ((error as Error).message.toLowerCase().includes("unauthorized")) {
      return res.status(403).json({ error: (error as Error).message });
    }
    return res
      .status(500)
      .json({ error: "Échec de la mise à jour du commentaire" });
  }
});

/**
 * DELETE /api/comments/:id
 * Supprime un commentaire (auteur ou admin).
 * Effets: notification (type comment) vers tous.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le commentaire avant suppression pour le contexte
    const comment = await CommentService.getCommentById(id);

    const isAdmin = req.user?.role === "admin";
    const deleted = await CommentService.deleteComment(
      id,
      req.user!.id,
      Boolean(isAdmin),
    );

    if (!deleted) {
      return res.status(404).json({ error: "Commentaire introuvable" });
    }

    // Diffuser une notification à tous les utilisateurs + Bus de mail
    if (comment) {
      try {
        const dao = await DaoService.getDaoById(comment.daoId);
        if (dao) {
          const task = dao.tasks.find((t) => t.id === comment.taskId);
          if (task) {
            const notif = tplTaskNotification({
              dao,
              previous: task,
              current: task,
              changeType: "comment",
              comment: comment.content,
            });
            NotificationService.broadcast(
              notif.type,
              notif.title,
              notif.message,
              notif.data,
            );
          }
        }
      } catch (_) {}
    }

    return res.json({ message: "Commentaire supprimé avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression du commentaire", "COMMENTS");
    if ((error as Error).message.toLowerCase().includes("unauthorized")) {
      return res.status(403).json({ error: (error as Error).message });
    }
    return res
      .status(500)
      .json({ error: "Échec de la suppression du commentaire" });
  }
});

/**
 * GET /api/comments/recent
 * Liste les commentaires récents toutes DAO confondues.
 * Query: limit (par défaut 10)
 */
router.get("/recent", authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const comments = await CommentService.getRecentComments(limit);
    return res.json(comments);
  } catch (error) {
    logger.error(
      "Erreur lors de la récupération des commentaires récents",
      "COMMENTS",
    );
    return res
      .status(500)
      .json({ error: "Échec de la récupération des commentaires récents" });
  }
});

export default router;
