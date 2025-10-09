/**
Rôle: Service métier côté serveur — src/backend-express/services/notificationService.ts
Domaine: Backend/Services
Exports: NotificationType, ServerNotification, NotificationService
Liens: appels /api, utils de fetch, types @shared/*
*/
import { emailAllUsers, sendEmail } from "./txEmail";
import { AuthService } from "./authService";
import { logger } from "../utils/logger";
import { isValidEmail, normalizeEmail, partitionEmails } from "../utils/email";
import { MongoNotificationRepository } from "../repositories/mongoNotificationRepository";
import { MemoryNotificationRepository } from "../repositories/memoryNotificationRepository";
import { DaoService } from "./daoService";

export type NotificationType =
  | "role_update"
  | "task_notification"
  | "dao_created"
  | "dao_updated"
  | "dao_deleted"
  | "user_created"
  | "system";

export interface ServerNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  recipients: "all" | string[];
  readBy: Set<string>;
  createdAt: string;
}

interface ClientNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdAt: string;
  read: boolean;
}

// Helper: tenter d'obtenir un dépôt de notifications persistant (mongo ou en mémoire)
async function getNotificationRepo() {
  try {
    if ((process.env.USE_MONGO || "").toLowerCase() === "true") {
      return new MongoNotificationRepository();
    }
  } catch {}
  try {
    return new MemoryNotificationRepository();
  } catch {}
  return null;
}

async function resolveRecipientEmails(recipientIds: string[]) {
  const emails = new Set<string>();
  const invalid: string[] = [];
  const missing: string[] = [];

  for (const id of recipientIds) {
    if (!id) continue;
    try {
      const user = await AuthService.getUserById(id);
      if (!user) {
        missing.push(id);
        continue;
      }
      const normalized = normalizeEmail(user.email);
      if (!normalized || !isValidEmail(normalized)) {
        invalid.push(user.email);
        continue;
      }
      emails.add(normalized);
    } catch (error) {
      logger.warn("Impossible de résoudre l'email du destinataire", "MAIL", {
        error: String((error as Error)?.message || error),
        userId: id,
      });
    }
  }

  return {
    emails: Array.from(emails),
    invalid,
    missing,
  };
}

const EMAIL_ERROR_NOTIFY_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.EMAIL_ERROR_NOTIFY_INTERVAL_MS || 10 * 60 * 1000),
);
let lastEmailErrorNotificationAt = 0;
let lastEmailErrorNotificationCode: string | null = null;

function shouldNotifyEmailError(code: string): boolean {
  const now = Date.now();
  if (
    lastEmailErrorNotificationCode === code &&
    now - lastEmailErrorNotificationAt < EMAIL_ERROR_NOTIFY_INTERVAL_MS
  ) {
    return false;
  }
  lastEmailErrorNotificationAt = now;
  lastEmailErrorNotificationCode = code;
  return true;
}

class InMemoryNotificationService {
  private notifications: ServerNotification[] = [];
  private MAX_ITEMS = 1000;

  private isRecipient(userId: string, n: ServerNotification): boolean {
    return (
      n.recipients === "all" ||
      (Array.isArray(n.recipients) && n.recipients.includes(userId))
    );
  }

  private toClient(userId: string, n: ServerNotification): ClientNotification {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      createdAt: n.createdAt,
      read: n.readBy.has(userId),
    };
  }

  /**
   * Liste les notifications visibles par un utilisateur, triées desc et limitées.
   */
  async listForUser(userId: string): Promise<ClientNotification[]> {
    const list = this.notifications
      .filter((n) => this.isRecipient(userId, n))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 200)
      .map((n) => this.toClient(userId, n));
    return list;
  }

  /**
   * Persiste une notification si un dépôt est disponible (best-effort), sinon reste mémoire.
   */
  private async persistNotification(item: ServerNotification) {
    try {
      const repo = await getNotificationRepo();
      if (!repo) return;
      const persisted = {
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        data: item.data,
        recipients: item.recipients,
        readBy: Array.from(item.readBy),
        createdAt: item.createdAt,
      } as any;
      await repo.add(persisted);
      logger.info("Notification persistée", "NOTIF", { type: item.type });
    } catch (e) {
      logger.warn(
        "Échec de persistance de la notification (continuation en mémoire)",
        "NOTIF",
        {
          message: String((e as Error)?.message),
        },
      );
    }
  }

  /**
   * Miroir email robuste avec retries et logs sûrs.
   * - Diffusion à tous ou ciblée selon recipients
   * - En cas d'échec, génère une notification système (sans re-mirroring)
   */
  private async mirrorEmail(item: ServerNotification) {
    // Ignorer le mirroring pour les notifications internes/réservées au système
    if (item?.data && (item as any).data?.skipEmailMirror) return;

    const subject = item.title || "Notification";

    // Prefer HTML body if present in notification data
    const body =
      item?.data && typeof (item as any).data.html === "string"
        ? (item as any).data.html
        : String(item.message || "");

    // Helper retry
    const retryAsync = async (fn: () => Promise<void>, attempts = 3) => {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          await fn();
          return;
        } catch (e) {
          lastErr = e;
          const permanentFailure = Boolean((e as any)?.permanent);
          if (permanentFailure || i === attempts - 1) {
            throw lastErr;
          }
          const wait = Math.min(200 * Math.pow(2, i), 2000);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
      throw lastErr;
    };

    // Collect team emails for DAO-related notifications when daoId is provided
    const collectTeamEmails = async (): Promise<string[]> => {
      try {
        const daoId = (item as any)?.data?.daoId as string | undefined;
        if (!daoId) return [];
        const dao = await DaoService.getDaoById(daoId);
        if (!dao || !Array.isArray(dao.equipe)) return [];
        const emails = dao.equipe
          .map((m) => normalizeEmail((m as any).email))
          .filter((e): e is string => Boolean(e) && isValidEmail(e));
        return Array.from(new Set(emails));
      } catch {
        return [];
      }
    };

    try {
      if (item.recipients === "all") {
        const [teamEmails, users] = await Promise.all([
          collectTeamEmails(),
          AuthService.getAllUsers().catch(() => [] as any[]),
        ]);
        const userEmails = (users || [])
          .map((u: any) => normalizeEmail(u.email))
          .filter((e: any): e is string => Boolean(e) && isValidEmail(e));
        const admin = normalizeEmail(process.env.ADMIN_EMAIL || "");
        const combined = new Set<string>([...userEmails, ...teamEmails]);
        if (admin && isValidEmail(admin)) combined.add(admin);
        const recipients = Array.from(combined);
        if (recipients.length === 0) {
          logger.info(
            "Miroir email : aucun destinataire e-mail valide (skip)",
            "MAIL",
            { type: item.type },
          );
          return;
        }
        await retryAsync(() => sendEmail(recipients, subject, body, undefined), 3);
        logger.info("Miroir email (diffusion+équipe) envoyé avec succès", "MAIL", {
          type: item.type,
          count: recipients.length,
        });
        return;
      }

      if (!Array.isArray(item.recipients)) return;
      const { emails, invalid, missing } = await resolveRecipientEmails(
        item.recipients,
      );

      const teamEmails = await collectTeamEmails();
      const merged = Array.from(new Set([...(emails || []), ...teamEmails]));
      const { valid } = partitionEmails(merged);

      if (invalid.length > 0) {
        logger.warn("Miroir email : adresses invalides ignorées", "MAIL", {
          type: item.type,
          invalid,
        });
      }
      if (missing.length > 0) {
        logger.warn("Miroir email : utilisateurs introuvables", "MAIL", {
          type: item.type,
          missing,
        });
      }

      if (valid.length === 0) {
        logger.info(
          "Miroir email : aucun destinataire e-mail valide (skip)",
          "MAIL",
          {
            type: item.type,
          },
        );
        return;
      }

      await retryAsync(() => sendEmail(valid, subject, body, undefined), 3);
      logger.info("Miroir email envoyé avec succès", "MAIL", {
        type: item.type,
      });
    } catch (e) {
      const err: any = e;
      const code =
        err?.responseCode || err?.code || (err as any)?.code || "unknown";
      const message = String((e as Error)?.message || "");
      const is504 = String(code) === "504" || /\b504\b/.test(message);
      const isQuota =
        String(code) === "554" ||
        /limit on the number of allowed outgoing messages/i.test(message);
      const summary = (err as any)?.summary as
        | {
            attempted: number;
            sent: number;
            failed: number;
            errors?: Array<{ code?: string }>;
          }
        | undefined;

      logger.error("Échec du mirroring des emails après tentatives", "MAIL", {
        message,
        code,
        type: item.type,
      });

      if (summary) {
        logger.error("Détails échec envoi email", "MAIL", {
          attempted: summary.attempted,
          sent: summary.sent,
          failed: summary.failed,
          codes: Array.isArray(summary.errors)
            ? summary.errors
                .map((entry) => entry?.code)
                .filter((value): value is string => Boolean(value))
            : [],
        });
      }

      const safeMsg = isQuota
        ? "Envoi d'e-mails temporairement bloqué (quota atteint). Réessayez plus tard."
        : is504
          ? "Erreur d'envoi d'email (504 Gateway Timeout). Réessayer plus tard."
          : "Erreur d'envoi d'email. Réessayer plus tard.";

      const notifyCode = String(code || "unknown");
      if (!shouldNotifyEmailError(notifyCode)) {
        logger.info("Notification d'erreur email ignorée (cooldown)", "MAIL", {
          type: item.type,
          code: notifyCode,
        });
        return;
      }

      await this.add({
        type: "system",
        title: "Erreur d'envoi d'email",
        message: safeMsg,
        data: {
          skipEmailMirror: true,
          emailError: true,
          code: notifyCode,
          ...(summary
            ? {
                attempted: summary.attempted,
                failed: summary.failed,
              }
            : {}),
        },
        recipients: "all",
      });
    }
  }

  /**
   * Ajoute une notification (mémoire + tentative de persistance + miroir email).
   */
  async add(n: Omit<ServerNotification, "id" | "readBy" | "createdAt">) {
    // Option de diffusion globale via variable d'environnement
    const broadcastAll =
      String(process.env.EMAIL_BROADCAST_ALL || "false").toLowerCase() ===
      "true";

    const item: ServerNotification = {
      ...n,
      recipients: broadcastAll ? "all" : n.recipients,
      id: `srv_notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      readBy: new Set<string>(),
      createdAt: new Date().toISOString(),
    };

    // add to in-memory store
    this.notifications.unshift(item);
    if (this.notifications.length > this.MAX_ITEMS) {
      this.notifications = this.notifications.slice(0, this.MAX_ITEMS);
    }

    // Best-effort persist + email mirror asynchronously
    (async () => {
      await this.persistNotification(item).catch(() => {});
      await this.mirrorEmail(item).catch(() => {});
    })();

    return item;
  }

  /**
   * Diffuse une notification à tous les utilisateurs.
   */
  broadcast(
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
  ) {
    return this.add({ type, title, message, data, recipients: "all" });
  }

  /**
   * Marque une notification comme lue pour un utilisateur et persiste si possible.
   */
  markRead(userId: string, notifId: string) {
    const n = this.notifications.find((n) => n.id === notifId);
    if (!n) return false;
    if (!this.isRecipient(userId, n)) return false;
    n.readBy.add(userId);

    // update persisted store if possible (best-effort)
    (async () => {
      try {
        const repo = await getNotificationRepo();
        if (!repo) return;
        await repo.markRead(userId, notifId);
      } catch (e) {
        logger.warn("Échec de persistance du marquage comme lu", "NOTIF", {
          message: String((e as Error)?.message),
        });
      }
    })();

    return true;
  }

  /**
   * Marque toutes les notifications visibles par l'utilisateur comme lues.
   */
  markAllRead(userId: string) {
    let count = 0;
    for (const n of this.notifications) {
      if (this.isRecipient(userId, n) && !n.readBy.has(userId)) {
        n.readBy.add(userId);
        count++;
      }
    }

    (async () => {
      try {
        const repo = await getNotificationRepo();
        if (!repo) return;
        await repo.markAllRead(userId);
      } catch (e) {
        logger.warn(
          "Échec de persistance du marquage de toutes comme lues",
          "NOTIF",
          {
            message: String((e as Error)?.message),
          },
        );
      }
    })();

    return count;
  }

  /**
   * Vide toutes les notifications (mémoire et dépôt si dispo).
   */
  clearAll() {
    this.notifications = [];

    (async () => {
      try {
        const repo = await getNotificationRepo();
        if (!repo) return;
        await repo.clearAll();
      } catch (e) {
        logger.warn(
          "Échec de persistance lors du vidage des notifications",
          "NOTIF",
          {
            message: String((e as Error)?.message),
          },
        );
      }
    })();
  }
}

export const NotificationService = new InMemoryNotificationService();
