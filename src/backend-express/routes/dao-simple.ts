/**
Rôle: Route API Express — src/backend-express/routes/dao-simple.ts
Domaine: Backend/Routes
Exports: default
Dépendances: express, zod, ../utils/devLog, @shared/dao, ../services/daoService, ../utils/logger, ../services/txEmail
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurit��: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
/*
  Route principale REST pour les opérations CRUD sur les DAO.
  - express fournit le routeur et le middleware http minimaliste
  - ce fichier applique validation (zod), authentification/middlewares, et orchestration
    des services métier (DaoService, NotificationService, CommentService)
  Les commentaires ci-dessous expliquent le flux: validation → sanitize → update → notify
*/
import express from "express";
import { z } from "zod";
import {
  authenticate,
  requireAdmin,
  auditLog,
  sensitiveOperationLimit,
  requireDaoLeaderOrAdmin,
} from "../middleware/auth";
import { devLog } from "../utils/devLog";
import { DEFAULT_TASKS } from "@shared/dao";
import type { Dao } from "@shared/dao";
import { DaoService } from "../services/daoService";
import { AuthService } from "../services/authService";
import { recordAutoUserEvent } from "../services/autoUserAudit";
import { logger } from "../utils/logger";
import { NotificationService } from "../services/notificationService";
import {
  tplDaoCreated,
  tplDaoUpdated,
  tplDaoDeleted,
  tplTaskNotification,
} from "../services/notificationTemplates";
import { daoStorage } from "../data/daoStorage";
import { CommentService } from "../services/commentService";

const router = express.Router();

// Schémas de validation
const teamMemberSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(["chef_equipe", "membre_equipe"]),
  email: z.string().email().optional(),
});

const taskSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1).max(200).trim(),
  progress: z.number().min(0).max(100).nullable(),
  comment: z.string().max(1000).optional(),
  isApplicable: z.boolean(),
  assignedTo: z.array(z.string().max(50)).optional(),
  lastUpdatedBy: z.string().max(50).optional(),
  lastUpdatedAt: z.string().optional(),
});

const createDaoSchema = z.object({
  numeroListe: z.string().min(1).max(50).trim(),
  objetDossier: z.string().min(1).max(500).trim(),
  reference: z.string().min(1).max(200).trim(),
  autoriteContractante: z.string().min(1).max(200).trim(),
  dateDepot: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Format de date invalide"),
  equipe: z.array(teamMemberSchema).min(1).max(20),
  tasks: z.array(taskSchema).max(50).optional(),
});

const updateDaoSchema = createDaoSchema.partial();

const taskUpdateSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  comment: z.string().max(1000).optional(),
  isApplicable: z.boolean().optional(),
  assignedTo: z.array(z.string().max(50)).optional(),
});

/**
 * Nettoie une chaîne utilisateur:
 * - retire balises <script>/<style>
 * - supprime toutes balises HTML restantes
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
 * GET /api/dao
 * Liste les DAO avec filtres/tri/pagination côté serveur.
 * Query: search, autorite, sort, order (asc|desc), page, pageSize
 * Retour: { items, total, page, pageSize }
 */
router.get("/", authenticate, auditLog("VIEW_ALL_DAOS"), async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const autorite =
      typeof req.query.autorite === "string" ? req.query.autorite : undefined;
    const sort =
      typeof req.query.sort === "string" ? req.query.sort : undefined;
    const order = req.query.order === "asc" ? "asc" : "desc";
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize || "20"), 10) || 20),
    );

    const result = await DaoService.getDaos({
      search,
      autorite,
      sort,
      order: order as any,
      page,
      pageSize,
    });

    devLog.info(
      `Service de ${result.items.length}/${result.total} DAO(s) pour ${req.user?.email} (${req.user?.role})`,
    );

    res.json({ items: result.items, total: result.total, page, pageSize });
  } catch (error) {
    devLog.error("Erreur dans GET /api/dao:", error);
    return void res.status(500).json({
      error: "Échec de récupération des DAO",
      code: "FETCH_ERROR",
    });
  }
});

/**
 * GET /api/dao/next-number
 * Calcule (sans créer) le prochain numéro de DAO.
 * Sécurité: utilisateur authentifié.
 * Retour: { nextNumber }
 */
router.get("/next-number", authenticate, async (req, res) => {
  try {
    const next = await DaoService.peekNextDaoNumber();

    logger.audit("Lecture du prochain numéro de DAO", req.user?.id, req.ip);
    res.json({ nextNumber: next });
  } catch (error) {
    logger.error(
      "Erreur lors de la génération du prochain numéro de DAO",
      "DAO_NEXT_NUMBER",
      {
        message: String((error as Error)?.message),
      },
    );
    res.status(500).json({
      error: "Échec de génération du prochain numéro de DAO",
      code: "GENERATION_ERROR",
    });
  }
});

/**
 * GET /api/dao/:id
 * Récupère un DAO par identifiant.
 * Sécurité: utilisateur authentifié.
 * Erreurs: 400 (ID invalide), 404 (DAO introuvable)
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    logger.audit("Requête de récupération d'un DAO", req.user?.id, req.ip);

    if (!id || id.length > 100) {
      logger.warn("ID de DAO invalide", "DAO_FETCH");
      return void res.status(400).json({
        error: "ID de DAO invalide",
        code: "INVALID_ID",
      });
    }

    const dao = await DaoService.getDaoById(id);
    if (!dao) {
      logger.warn("DAO introuvable", "DAO_FETCH");
      return void res.status(404).json({
        error: "DAO introuvable",
        code: "DAO_NOT_FOUND",
      });
    }

    logger.audit("DAO renvoyé", req.user?.id, req.ip);
    return void res.json(dao);
  } catch (error) {
    logger.error("Erreur lors de la récupération du DAO", "DAO_FETCH", {
      message: String((error as Error)?.message),
    });
    return void res.status(500).json({
      error: "Échec de récupération du DAO",
      code: "FETCH_ERROR",
    });
  }
});

// Stockage idempotence simple en mémoire pour éviter les créations en double dues à des doubles-clics rapides
const IDEMP_TTL_MS = 15_000;
const idempotencyCache = new Map<string, { expires: number; dao: Dao }>();

/**
 * POST /api/dao
 * Crée un nouveau DAO (réservé admin).
 * Corps: { numeroListe, objetDossier, reference, autoriteContractante, dateDepot, equipe[], tasks?[] }
 * Sécurité: admin + limitation sensitiveOperationLimit.
 * Idempotence: en-tête x-idempotency-key pour éviter les doublons.
 * Effets: notifications de création à tous les utilisateurs.
 */
router.post(
  "/",
  authenticate,
  requireAdmin,
  auditLog("CREATE_DAO"),
  sensitiveOperationLimit(),
  async (req, res) => {
    try {
      // Nettoyer les entrées expirées
      const nowTs = Date.now();
      for (const [k, v] of idempotencyCache) {
        if (v.expires <= nowTs) idempotencyCache.delete(k);
      }

      // Gestion de l’idempotence
      const idempKeyRaw = req.header("x-idempotency-key");
      const idempKey = (idempKeyRaw || "").trim();
      if (idempKey && idempotencyCache.has(idempKey)) {
        const cached = idempotencyCache.get(idempKey)!;
        if (cached.expires > nowTs) {
          return void res.status(201).json(cached.dao);
        }
        idempotencyCache.delete(idempKey);
      }

      const validatedData = createDaoSchema.parse(req.body);

      // Nettoyer les champs de type chaîne
      const sanitizedData = {
        ...validatedData,
        numeroListe: sanitizeString(validatedData.numeroListe),
        objetDossier: sanitizeString(validatedData.objetDossier),
        reference: sanitizeString(validatedData.reference),
        autoriteContractante: sanitizeString(
          validatedData.autoriteContractante,
        ),
        equipe: validatedData.equipe.map((member) => ({
          ...member,
          name: sanitizeString(member.name),
        })),
      };

      const now = new Date().toISOString();
      const tasks = (
        validatedData.tasks && validatedData.tasks.length
          ? validatedData.tasks
          : DEFAULT_TASKS.map((task) => ({
              ...task,
              progress: null,
              comment: "",
            }))
      ).map((t: any, idx: number) => ({
        id: typeof t.id === "number" ? t.id : idx + 1,
        name: sanitizeString(t.name),
        progress: t.isApplicable ? (t.progress ?? null) : null,
        comment: t.comment ? sanitizeString(t.comment) : undefined,
        isApplicable: t.isApplicable,
        assignedTo: Array.isArray(t.assignedTo)
          ? t.assignedTo.map((s: string) => sanitizeString(s))
          : [],
        lastUpdatedBy: req.user!.id,
        lastUpdatedAt: now,
      }));

      const newDao = await DaoService.createDao({
        numeroListe: sanitizedData.numeroListe,
        objetDossier: sanitizedData.objetDossier,
        reference: sanitizedData.reference,
        autoriteContractante: sanitizedData.autoriteContractante,
        dateDepot: sanitizedData.dateDepot,
        equipe: sanitizedData.equipe,
        tasks,
      });

      if (idempKey) {
        idempotencyCache.set(idempKey, {
          expires: Date.now() + IDEMP_TTL_MS,
          dao: newDao,
        });
      }

      logger.audit("DAO créé avec succès", req.user?.id, req.ip);

      // Notifier la plateforme et envoyer un e-mail à tous les utilisateurs
      try {
        const t = tplDaoCreated(newDao);
        NotificationService.broadcast(t.type, t.title, t.message, t.data);
      } catch (_) {}

      res.status(201).json(newDao);
    } catch (error: any) {
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
      if (error?.code === 11000) {
        return void res.status(400).json({
          error: "Numéro de DAO déjà existant",
          code: "DUPLICATE_NUMBER",
        });
      }

      logger.error("Échec de création du DAO", "DAO_CREATE", {
        message: (error as Error)?.message,
      });
      res.status(500).json({
        error: "Échec de création du DAO",
        code: "CREATE_ERROR",
      });
    }
  },
);

/**
 * PUT /api/dao/:id
 * Met à jour un DAO (chef d'équipe ou admin).
 * Règles:
 *  - Les admins non-chefs ne peuvent PAS modifier progression/applicabilité/assignations en masse.
 *  - Chaînes nettoyées pour éviter l'injection HTML.
 * Effets: notification de mise à jour (clés changées), marquage des changements d'équipe.
 */
router.put(
  "/:id",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("UPDATE_DAO"),
  async (req, res) => {
    try {
      const { id } = req.params;
      let teamChangeSummary: string[] = [];
      let taskChangeSummary: { id: number; name: string; changes: string[] }[] =
        [];

      if (!id || id.length > 100) {
        return void res.status(400).json({
          error: "ID de DAO invalide",
          code: "INVALID_ID",
        });
      }

      const validatedData = updateDaoSchema.parse(req.body);

      // Sanitize updates
      const updates: Partial<Dao> = {};
      if (validatedData.numeroListe)
        updates.numeroListe = sanitizeString(validatedData.numeroListe);
      if (validatedData.objetDossier)
        updates.objetDossier = sanitizeString(validatedData.objetDossier);
      if (validatedData.reference)
        updates.reference = sanitizeString(validatedData.reference);
      if (validatedData.autoriteContractante)
        updates.autoriteContractante = sanitizeString(
          validatedData.autoriteContractante,
        );
      if (validatedData.equipe)
        updates.equipe = validatedData.equipe.map((m) => ({
          ...m,
          name: sanitizeString(m.name),
        }));
      if (validatedData.tasks) updates.tasks = validatedData.tasks as any;

      const before = await DaoService.getDaoById(id);

      // Restreindre l’admin (non-chef) de changer la progression/l’applicabilité/les assignations des tâches via mise à jour de masse
      try {
        const isAdmin = req.user?.role === "admin";
        const isLeader = before?.equipe?.some(
          (m) => m.id === req.user!.id && m.role === "chef_equipe",
        );
        if (
          isAdmin &&
          !isLeader &&
          Array.isArray(validatedData.tasks) &&
          before
        ) {
          const beforeMap = new Map(before.tasks.map((t) => [t.id, t]));
          const forbiddenChange = (validatedData.tasks as any[]).some(
            (t: any) => {
              const prev = beforeMap.get(t.id);
              if (!prev) return false;
              const progChanged =
                typeof t.progress === "number" &&
                (prev.progress ?? 0) !== t.progress;
              const applChanged =
                typeof t.isApplicable === "boolean" &&
                prev.isApplicable !== t.isApplicable;
              const assignChanged =
                Array.isArray(t.assignedTo) &&
                JSON.stringify(prev.assignedTo || []) !==
                  JSON.stringify(t.assignedTo || []);
              return progChanged || applChanged || assignChanged;
            },
          );
          if (forbiddenChange) {
            return void res.status(403).json({
              error:
                "Seul le chef d'équipe peut modifier la progression, l'applicabilité ou l'assignation",
              code: "ADMIN_NOT_LEADER_FORBIDDEN",
            });
          }
        }
      } catch (_) {}

      const updated = await DaoService.updateDao(id, updates);
      if (!updated) {
        return void res
          .status(404)
          .json({ error: "DAO introuvable", code: "DAO_NOT_FOUND" });
      }

      // Ensure team emails correspond to active user accounts (auto-create/reactivate)
      try {
        const membersWithEmails = (updated.equipe || []).filter(
          (m) => m.email && String(m.email).trim(),
        );
        if (membersWithEmails.length > 0) {
          for (const member of membersWithEmails) {
            try {
              const res = await AuthService.ensureActiveUserByEmail(
                String(member.email).trim(),
                member.name || String(member.email),
                { allowCreate: false },
              );
              if (res && res.user) {
                // log successes in audit store
                recordAutoUserEvent({
                  action:
                    res.action === "created"
                      ? "created"
                      : res.action === "reactivated"
                        ? "reactivated"
                        : "already_active",
                  email: res.user.email,
                  daoId: updated.id,
                  memberName: member.name || null,
                  message: `Processed for DAO ${updated.id}`,
                });
                logger.audit(
                  `Auto-user ${res.action} for team member`,
                  req.user?.id,
                  req.ip,
                  {
                    email: "***@***",
                    daoId: updated.id,
                  },
                );
              } else {
                recordAutoUserEvent({
                  action: "error",
                  email: member.email,
                  daoId: updated.id,
                  memberName: member.name || null,
                  message: "Failed to ensure active user",
                });
                logger.warn(
                  "Failed to ensure active user for team member",
                  "DAO_TEAM_EMAIL",
                  {
                    email: "***@***",
                    daoId: updated.id,
                  },
                );
              }
            } catch (e) {
              recordAutoUserEvent({
                action: "error",
                email: member.email,
                daoId: updated.id,
                memberName: member.name || null,
                message: String((e as Error)?.message || e),
              });
              logger.warn(
                "Could not ensure active user for team member",
                "DAO_TEAM_EMAIL",
                {
                  email: "***@***",
                  err: String((e as Error)?.message || e),
                  daoId: updated.id,
                },
              );
            }
          }
        }
      } catch (_) {}

      // Notify on team role/member changes
      try {
        let hasTaskChanges = false;

        if (before && validatedData.equipe) {
          const beforeMap = new Map(before.equipe.map((m) => [m.id, m]));
          const afterMap = new Map(updated.equipe.map((m) => [m.id, m]));

          const changed: string[] = [];
          for (const [idKey, after] of afterMap) {
            const prev = beforeMap.get(idKey);
            if (!prev) changed.push(`${after.name} ajouté`);
            else if (prev.role !== after.role)
              changed.push(`${after.name}: ${prev.role} → ${after.role}`);
          }
          for (const [idKey, prev] of beforeMap) {
            if (!afterMap.has(idKey)) changed.push(`${prev.name} retiré`);
          }

          if (changed.length > 0) {
            // Flag team change for later template rendering
            (res as any).teamChanged = true;
            teamChangeSummary = changed;

            // Suppression de l'envoi intermédiaire pour éviter le doublon avec "Mise à jour d’un DAO".
            // Les changements d'équipe sont déjà intégrés dans la notification globale suivante via teamChangeSummary.
            // Aucun broadcast ici.

            // Email affected members when emails exist (handled elsewhere if needed)
          }
        }

        // Si les tâches ont changé via ce endpoint, ne FLAGGER que les changements (pas de broadcast ici)
        if (before && Array.isArray(validatedData.tasks)) {
          const byIdBefore = new Map(before.tasks.map((t) => [t.id, t]));
          const sameArray = (a?: string[], b?: string[]) => {
            const aa = [...(a || [])].sort();
            const bb = [...(b || [])].sort();
            if (aa.length !== bb.length) return false;
            for (let i = 0; i < aa.length; i++)
              if (aa[i] !== bb[i]) return false;
            return true;
          };
          const memberMap = new Map(updated.equipe.map((m) => [m.id, m.name]));
          const formatAssignees = (ids?: string[]) => {
            if (!ids || !ids.length) return "Aucun";
            return ids
              .map((id) => memberMap.get(id) || id)
              .sort((a, b) => a.localeCompare(b))
              .join(", ");
          };
          const formatBool = (value: boolean | undefined) =>
            value ? "Oui" : "Non";
          const truncate = (value: string) =>
            value.length > 80 ? `${value.slice(0, 77)}...` : value;
          for (const t of updated.tasks) {
            const prev = byIdBefore.get(t.id);
            if (!prev) continue;
            const diffs: string[] = [];
            const prevProgress = prev.progress ?? 0;
            const currProgress = t.progress ?? 0;
            if (prevProgress !== currProgress) {
              diffs.push(`Progression ${prevProgress}% → ${currProgress}%`);
            }
            if (prev.isApplicable !== t.isApplicable) {
              diffs.push(
                `Applicabilité ${formatBool(prev.isApplicable)} → ${formatBool(t.isApplicable)}`,
              );
            }
            if ((prev.comment || "") !== (t.comment || "")) {
              const oldComment = truncate(prev.comment?.trim() || "—");
              const newComment = truncate(t.comment?.trim() || "—");
              diffs.push(`Commentaire ${oldComment} → ${newComment}`);
            }
            if (!sameArray(prev.assignedTo, t.assignedTo)) {
              diffs.push(
                `Assignations ${formatAssignees(prev.assignedTo)} → ${formatAssignees(t.assignedTo)}`,
              );
            }
            if (diffs.length > 0) {
              hasTaskChanges = true;
              taskChangeSummary.push({
                id: t.id,
                name: t.name,
                changes: diffs,
              });
            }
          }

          // Injecter les commentaires existants par tâche pour enrichir le résumé
          try {
            const allComments = await CommentService.getDaoComments(updated.id);
            const byTaskId = new Map<
              number,
              { userName: string; content: string; createdAt?: string }[]
            >();
            for (const c of allComments) {
              const list = byTaskId.get(c.taskId) || [];
              list.push({
                userName: c.userName,
                content: c.content,
                createdAt: c.createdAt,
              });
              byTaskId.set(c.taskId, list);
            }
            // Enrichir les entrées existantes
            taskChangeSummary = taskChangeSummary.map((tc) => ({
              ...tc,
              comments: byTaskId.get(tc.id) || [],
            })) as any;
            // Ajouter des entrées pour les tâches ayant des commentaires mais aucun diff
            for (const [tid, comments] of byTaskId) {
              const exists = taskChangeSummary.some((t) => t.id === tid);
              if (!exists && comments.length > 0) {
                const name =
                  updated.tasks.find((t) => t.id === tid)?.name ||
                  `Tâche ${tid}`;
                taskChangeSummary.push({
                  id: tid,
                  name,
                  changes: [],
                  comments,
                } as any);
              }
            }
          } catch (_) {}
        }

        // Mark on res.locals to inform later step whether to broadcast generic update
        (res as any).hasTaskChanges =
          (res as any).hasTaskChanges || hasTaskChanges;
      } catch (_) {}

      // Always broadcast a general DAO update and email all users
      try {
        const changedKeys = new Set<string>();
        if (before && updated) {
          if (before.numeroListe !== updated.numeroListe)
            changedKeys.add("numeroListe");
          if (before.objetDossier !== updated.objetDossier)
            changedKeys.add("objetDossier");
          if (before.reference !== updated.reference)
            changedKeys.add("reference");
          if (before.autoriteContractante !== updated.autoriteContractante)
            changedKeys.add("autoriteContractante");
          if (before.dateDepot !== updated.dateDepot)
            changedKeys.add("dateDepot");
          if ((res as any).teamChanged === true) {
            changedKeys.add("chef");
            changedKeys.add("membres");
          }
        }

        const shouldBroadcast =
          !!before &&
          (changedKeys.size > 0 ||
            teamChangeSummary.length > 0 ||
            taskChangeSummary.length > 0 ||
            (res as any).hasTaskChanges !== true);

        if (shouldBroadcast && before) {
          const t = tplDaoUpdated({
            before,
            after: updated,
            changedFields: changedKeys,
            teamChanges: teamChangeSummary,
            taskChanges: taskChangeSummary as any,
          });
          const dataWithHtml = { ...(t.data || {}), html: (t as any).html };
          NotificationService.broadcast(
            t.type,
            t.title,
            t.message,
            dataWithHtml,
          );
        }
      } catch (_) {}

      logger.audit("DAO mis à jour avec succès", req.user?.id, req.ip);
      res.json(updated);
    } catch (error: any) {
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
      if (error?.code === 11000) {
        return void res.status(400).json({
          error: "Numéro de DAO déjà existant",
          code: "DUPLICATE_NUMBER",
        });
      }

      logger.error("Échec de mise à jour du DAO", "DAO_UPDATE", {
        message: (error as Error)?.message,
      });
      res.status(500).json({
        error: "Échec de mise à jour du DAO",
        code: "UPDATE_ERROR",
      });
    }
  },
);

/**
 * DELETE /api/dao/:id
 * Suppression désactivée pour éviter la perte de données (toujours 403).
 */
router.delete(
  "/:id",
  authenticate,
  auditLog("DELETE_DAO_ATTEMPT"),
  async (_req, res) => {
    return res.status(403).json({
      error: "La suppression de DAO est désactivée",
      code: "DAO_DELETE_DISABLED",
    });
  },
);

/**
 * GET /api/dao/admin/verify-integrity
 * Vérifie l'intégrité du stockage et retourne un petit rapport.
 * Sécurité: admin.
 */
router.get(
  "/admin/verify-integrity",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      logger.audit("Integrity check requested", req.user?.id, req.ip);

      // Force integrity verification
      const isIntegrityOk = daoStorage.verifyIntegrity();

      const allDaos = await DaoService.getAllDaos();

      const report = {
        integrityCheck: isIntegrityOk ? "PASSÉ" : "ÉCHOUÉ",
        totalDaos: allDaos.length,
        daos: allDaos.map((dao) => ({
          id: dao.id,
          numeroListe: dao.numeroListe,
          objetDossier: dao.objetDossier.substring(0, 50) + "...",
        })),
        timestamp: new Date().toISOString(),
      };

      logger.audit("Rapport d'intégrité généré", req.user?.id, req.ip);
      res.json(report);
    } catch (error) {
      logger.error("Échec de la vérification d'intégrité", "DAO_INTEGRITY", {
        message: (error as Error)?.message,
      });
      res.status(500).json({
        error: "Échec de vérification de l'intégrit��",
        code: "INTEGRITY_CHECK_ERROR",
      });
    }
  },
);

/**
 * GET /api/dao/admin/last
 * Retourne le dernier DAO créé.
 * Sécurité: admin.
 */
router.get("/admin/last", authenticate, requireAdmin, async (_req, res) => {
  try {
    const last = await DaoService.getLastCreatedDao();
    if (!last)
      return void res.status(404).json({ error: "Aucun DAO", code: "NO_DAO" });
    return void res.json({
      id: last.id,
      numeroListe: last.numeroListe,
      createdAt: last.createdAt,
    });
  } catch (error) {
    logger.error("Error fetching last DAO", "DAO_ADMIN");
    return void res.status(500).json({
      error: "Échec de récupération du dernier DAO",
      code: "LAST_FETCH_ERROR",
    });
  }
});

/**
 * DELETE /api/dao/admin/delete-last
 * Supprime le dernier DAO créé et diffuse une notification.
 * Sécurité: admin.
 */
router.delete(
  "/admin/delete-last",
  authenticate,
  requireAdmin,
  auditLog("DELETE_LAST_DAO"),
  async (req, res) => {
    try {
      const last = await DaoService.getLastCreatedDao();
      if (!last) {
        return void res.status(404).json({
          error: "Aucun DAO à supprimer",
          code: "NO_DAO",
        });
      }

      const deleted = await DaoService.deleteDao(last.id);
      if (!deleted) {
        return void res
          .status(404)
          .json({ error: "DAO introuvable", code: "DAO_NOT_FOUND" });
      }

      try {
        const t = tplDaoDeleted(last);
        NotificationService.broadcast(t.type, t.title, t.message, t.data);
      } catch (_) {}

      logger.audit("Dernier DAO supprimé avec succès", req.user?.id, req.ip);
      return void res.json({
        deletedId: last.id,
        numeroListe: last.numeroListe,
      });
    } catch (error) {
      logger.error("Échec de suppression du dernier DAO", "DAO_DELETE_LAST", {
        message: (error as Error)?.message,
      });
      return void res.status(500).json({
        error: "Échec de suppression du dernier DAO",
        code: "DELETE_LAST_ERROR",
      });
    }
  },
);

/**
 * PUT /api/dao/:id/tasks/reorder
 * Réordonne les tâches d'un DAO selon un tableau d'IDs complet.
 * Règles: doit contenir tous les IDs existants, ordre libre.
 */
router.put(
  "/:id/tasks/reorder",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("REORDER_TASKS"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { taskIds } = req.body as { taskIds: number[] };

      if (!id || id.length > 100) {
        return void res.status(400).json({
          error: "ID de DAO invalide",
          code: "INVALID_DAO_ID",
        });
      }

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return void res.status(400).json({
          error: "Tableau d'IDs de tâches invalide",
          code: "INVALID_TASK_IDS",
        });
      }

      const dao = await DaoService.getDaoById(id);
      if (!dao) {
        return void res.status(404).json({
          error: "DAO introuvable",
          code: "DAO_NOT_FOUND",
        });
      }

      const existingTaskIds = dao.tasks.map((t) => t.id);
      const invalidIds = taskIds.filter(
        (tid) => !existingTaskIds.includes(tid),
      );
      if (invalidIds.length > 0) {
        return void res.status(400).json({
          error: "Certains IDs de tâches n'existent pas",
          code: "INVALID_TASK_IDS",
          invalidIds,
        });
      }

      if (
        taskIds.length !== dao.tasks.length ||
        !existingTaskIds.every((tid) => taskIds.includes(tid))
      ) {
        return void res.status(400).json({
          error:
            "La liste des IDs de tâches doit inclure toutes les tâches existantes",
          code: "INCOMPLETE_TASK_LIST",
        });
      }

      const reorderedTasks = taskIds.map(
        (taskId) => dao.tasks.find((task) => task.id === taskId)!,
      );

      const updated = await DaoService.updateDao(id, {
        tasks: reorderedTasks,
      });

      // Notify and email all users
      try {
        // Suppression de l'ancien broadcast de réorganisation des tâches
      } catch (_) {}

      logger.audit("Réordonnancement des tâches réussi", req.user?.id, req.ip);
      res.json(updated);
    } catch (error) {
      logger.error(
        "Échec du réordonnancement des tâches",
        "DAO_TASKS_REORDER",
        {
          message: (error as Error)?.message,
        },
      );
      res.status(500).json({
        error: "Échec du réordonnancement des tâches",
        code: "REORDER_ERROR",
      });
    }
  },
);

/**
 * PUT /api/dao/:id/tasks/:taskId
 * Met à jour une tâche précise (progression, commentaire, applicable, assignations).
 * Règles:
 *  - Admin non-chef interdit pour progression/applicabilité/assignations.
 * Effets: notification ciblée (type selon changement détecté).
 */
router.put(
  "/:id/tasks/:taskId",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("UPDATE_TASK"),
  async (req, res) => {
    try {
      const { id, taskId } = req.params;

      if (!id || id.length > 100) {
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

      const validatedData = taskUpdateSchema.parse(req.body);

      const dao = await DaoService.getDaoById(id);
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

      // Enforce rule: an admin who is not the team lead cannot change progression, applicability, or assignments
      const isAdmin = req.user?.role === "admin";
      const isLeader = dao.equipe.some(
        (m) => m.id === req.user!.id && m.role === "chef_equipe",
      );
      if (
        isAdmin &&
        !isLeader &&
        (Object.prototype.hasOwnProperty.call(validatedData, "progress") ||
          Object.prototype.hasOwnProperty.call(validatedData, "isApplicable") ||
          Object.prototype.hasOwnProperty.call(validatedData, "assignedTo"))
      ) {
        return void res.status(403).json({
          error:
            "Seul le chef d'équipe peut modifier la progression, l'applicabilité ou l'assignation",
          code: "ADMIN_NOT_LEADER_FORBIDDEN",
        });
      }

      const previous = { ...task };

      if (typeof validatedData.progress === "number") {
        task.progress = validatedData.progress;
      }
      if (typeof validatedData.comment === "string") {
        task.comment = sanitizeString(validatedData.comment);
      }
      if (typeof validatedData.isApplicable === "boolean") {
        task.isApplicable = validatedData.isApplicable;
      }
      if (Array.isArray(validatedData.assignedTo)) {
        task.assignedTo = validatedData.assignedTo.map((s) =>
          sanitizeString(s),
        );
      }

      task.lastUpdatedBy = req.user!.id;
      task.lastUpdatedAt = new Date().toISOString();

      const updated = await DaoService.updateDao(id, { tasks: dao.tasks });

      // Broadcast task notification to all users
      try {
        const prevSet = new Set(previous.assignedTo || []);
        const currSet = new Set(task.assignedTo || []);
        const added: string[] = [];
        const removed: string[] = [];
        for (const id of currSet) if (!prevSet.has(id)) added.push(id);
        for (const id of prevSet) if (!currSet.has(id)) removed.push(id);

        let changeType:
          | "progress"
          | "applicability"
          | "assignees"
          | "comment"
          | "general" = "general";
        if ((previous.progress ?? 0) !== (task.progress ?? 0))
          changeType = "progress";
        else if (previous.isApplicable !== task.isApplicable)
          changeType = "applicability";
        else if (added.length || removed.length) changeType = "assignees";
        else if (previous.comment !== task.comment) changeType = "comment";

        const notif = tplTaskNotification({
          dao,
          previous,
          current: task,
          changeType,
          added,
          removed,
          comment: previous.comment !== task.comment ? task.comment : undefined,
        });

        NotificationService.broadcast(
          notif.type,
          notif.title,
          notif.message,
          notif.data,
        );
      } catch (_) {}

      logger.audit("Tâche mise à jour avec succès", req.user?.id, req.ip);
      res.json(updated);
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

      logger.error("Échec de mise à jour de la tâche", "DAO_TASK_UPDATE", {
        message: (error as Error)?.message,
      });
      res.status(500).json({
        error: "Échec de mise à jour de la tâche",
        code: "TASK_UPDATE_ERROR",
      });
    }
  },
);

export default router;
