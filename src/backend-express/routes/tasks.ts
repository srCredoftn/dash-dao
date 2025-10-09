/**
Rôle: Route API Express — src/backend-express/routes/tasks.ts
Domaine: Backend/Routes
Exports: default
Dépendances: express, zod, ../middleware/auth, ../utils/idempotency, @shared/dao, ../services/daoService, ../services/txEmail
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import express from "express";
import { z } from "zod";
import { authenticate, requireAdmin, auditLog } from "../middleware/auth";
import { getIdempotency, setIdempotency } from "../utils/idempotency";
import type { DaoTask } from "@shared/dao";
import { DaoService } from "../services/daoService";
import { Templates, emailAllUsers, sendEmail } from "../services/txEmail";
import { logger } from "../utils/logger";

const router = express.Router();

// Schémas de validation
const createTaskSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  isApplicable: z.boolean(),
  progress: z.number().min(0).max(100).nullable(),
  comment: z.string().max(1000).optional(),
  assignedTo: z.array(z.string().max(50)).optional(),
});

const updateTaskNameSchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

/**
 * Nettoie une chaîne utilisateur:
 * - enlève <script>/<style>
 * - enlève les balises HTML restantes
 * - trim
 */
function sanitizeString(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * POST /api/dao/:daoId/tasks
 * Ajoute une nouvelle tâche au DAO.
 * Sécurité: admin (ou leader si la politique évolue).
 * Idempotence: x-idempotency-key supporté.
 * Effets: emails à tous + assignés.
 */
router.post(
  "/:daoId/tasks",
  authenticate,
  requireAdmin,
  auditLog("ADD_TASK"),
  async (req, res) => {
    try {
      const idempKey = (req.header("x-idempotency-key") || "").trim();
      if (idempKey) {
        const cached = getIdempotency(idempKey);
        if (cached) return res.status(201).json(cached);
      }

      const { daoId } = req.params;

      if (!daoId || daoId.length > 100) {
        return void res.status(400).json({
          error: "ID de DAO invalide",
          code: "INVALID_DAO_ID",
        });
      }

      const validatedData = createTaskSchema.parse(req.body);
      const dao = await DaoService.getDaoById(daoId);

      if (!dao) {
        return void res.status(404).json({
          error: "DAO introuvable",
          code: "DAO_NOT_FOUND",
        });
      }

      const existingIds = dao.tasks.map((t) => t.id);
      const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

      const newTask: DaoTask = {
        id: newId,
        name: sanitizeString(validatedData.name),
        progress: validatedData.isApplicable ? validatedData.progress : null,
        comment: validatedData.comment
          ? sanitizeString(validatedData.comment)
          : undefined,
        isApplicable: validatedData.isApplicable,
        assignedTo: validatedData.assignedTo || [],
        lastUpdatedBy: req.user!.id,
        lastUpdatedAt: new Date().toISOString(),
      } as DaoTask;

      const updated = await ((req as any).retry
        ? (req as any).retry(() =>
            DaoService.updateDao(daoId, { tasks: [...dao.tasks, newTask] }),
          )
        : DaoService.updateDao(daoId, { tasks: [...dao.tasks, newTask] }));

      if (idempKey) setIdempotency(idempKey, updated);

      logger.audit("Task created", req.user?.id, req.ip);

      // E-mails
      try {
        const daoFull = await DaoService.getDaoById(daoId);
        if (daoFull) {
          const tAll = Templates.task.created({ dao: daoFull, task: newTask });
          await emailAllUsers(tAll.subject, tAll.body, "TASK_CREATED");
          for (const mId of newTask.assignedTo || []) {
            const m = daoFull.equipe.find((x) => x.id === mId);
            if (m?.email) {
              const t = Templates.task.updated({
                dao: daoFull,
                previous: newTask,
                current: newTask,
                action: "Assignation",
                added: [m.id],
              });
              await sendEmail(m.email, t.subject, t.body, "TASK_ASSIGNED");
            }
          }
        }
      } catch (_) {}

      return void res.status(201).json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return void res.status(400).json({
          error: "Erreur de validation",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          code: "VALIDATION_ERROR",
        });
      }

      logger.error("Échec de l’ajout de la tâche", "TASK_CREATE", {
        message: String((error as Error)?.message),
      });
      return void res.status(500).json({
        error: "Échec de l’ajout de la tâche",
        code: "ADD_TASK_ERROR",
      });
    }
  },
);

/**
 * PUT /api/dao/:daoId/tasks/:taskId/name
 * Met à jour le nom d'une tâche.
 * Sécurité: admin (ou leader selon politique future).
 * Effets: emails d'information.
 */
router.put(
  "/:daoId/tasks/:taskId/name",
  authenticate,
  requireAdmin,
  auditLog("UPDATE_TASK_NAME"),
  async (req, res) => {
    try {
      const { daoId, taskId } = req.params;

      if (!daoId || daoId.length > 100) {
        return void res.status(400).json({
          error: "ID de DAO invalide",
          code: "INVALID_DAO_ID",
        });
      }

      const parsedTaskId = parseInt(taskId);
      if (isNaN(parsedTaskId) || parsedTaskId < 1) {
        return void res.status(400).json({
          error: "ID de tâche invalide",
          code: "INVALID_TASK_ID",
        });
      }

      const validatedData = updateTaskNameSchema.parse(req.body);
      const dao = await DaoService.getDaoById(daoId);

      if (!dao) {
        return void res.status(404).json({
          error: "DAO introuvable",
          code: "DAO_NOT_FOUND",
        });
      }

      const task = dao.tasks.find((t) => t.id === parsedTaskId);
      if (!task) {
        return void res.status(404).json({
          error: "Tâche introuvable",
          code: "TASK_NOT_FOUND",
        });
      }

      const previous = { ...task };
      task.name = sanitizeString(validatedData.name);
      task.lastUpdatedBy = req.user!.id;
      task.lastUpdatedAt = new Date().toISOString();

      const updated = await ((req as any).retry
        ? (req as any).retry(() =>
            DaoService.updateDao(daoId, { tasks: dao.tasks }),
          )
        : DaoService.updateDao(daoId, { tasks: dao.tasks }));

      // E-mails
      try {
        if (dao) {
          const t = Templates.task.updated({
            dao,
            previous,
            current: task,
            action: "Mise à jour",
          });
          await emailAllUsers(t.subject, t.body, "TASK_UPDATED");
        }
      } catch (_) {}

      logger.audit("Task name updated", req.user?.id, req.ip);
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return void res.status(400).json({
          error: "Erreur de validation",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          code: "VALIDATION_ERROR",
        });
      }

      logger.error(
        "Échec de la mise à jour du nom de la tâche",
        "TASK_RENAME",
        {
          message: String((error as Error)?.message),
        },
      );
      return void res.status(500).json({
        error: "Échec de la mise à jour du nom de la tâche",
        code: "UPDATE_TASK_NAME_ERROR",
      });
    }
  },
);

/**
 * DELETE /api/dao/:daoId/tasks/:taskId
 * Suppression des tâches désactivée (403).
 */
router.delete(
  "/:daoId/tasks/:taskId",
  authenticate,
  auditLog("DELETE_TASK_ATTEMPT"),
  async (_req, res) => {
    return res.status(403).json({
      error: "La suppression de tâches est désactivée",
      code: "TASK_DELETE_DISABLED",
    });
  },
);

export default router;
