import { logger } from "../utils/logger";
import { DaoService } from "./daoService";
import { NotificationService } from "./notificationService";
import { sendEmail, computeDaoProgress } from "./txEmail";
import { normalizeEmail, isValidEmail } from "../utils/email";

const DEFAULT_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_REPEAT = 24 * 60 * 60 * 1000; // 24h

// In-memory map to avoid re-sending reminders too often. Keys: daoId -> timestamp of last reminder
const lastReminded: Map<string, number> = new Map();
let running = false;
let timer: NodeJS.Timeout | null = null;

export function startCriticalReminderService() {
  if (running) return;
  try {
    const enabled =
      String(process.env.CRITICAL_REMINDER_ENABLED || "true").toLowerCase() ===
      "true";
    if (!enabled) {
      logger.info("CriticalReminder: disabled via env", "CRITICAL_REMINDER");
      return;
    }

    const interval = Math.max(
      1000,
      Number(process.env.CRITICAL_REMINDER_INTERVAL_MS || DEFAULT_INTERVAL),
    );
    const repeatMs = Math.max(
      1000,
      Number(process.env.CRITICAL_REMINDER_REPEAT_MS || DEFAULT_REPEAT),
    );

    running = true;

    const tick = async () => {
      try {
        logger.info(
          "CriticalReminder: scanning DAOs for critical state",
          "CRITICAL_REMINDER",
        );
        const daos = await DaoService.getAllDaos();
        const now = Date.now();

        const daysThreshold = Math.max(
          0,
          Number(process.env.CRITICAL_DAYS_THRESHOLD || 7),
        );
        const progressThreshold = Math.max(
          0,
          Number(process.env.CRITICAL_PROGRESS_THRESHOLD || 20),
        );

        const mode = (process.env.CRITICAL_SEND_MODE || "team").toLowerCase(); // team | all | central

        for (const dao of daos) {
          try {
            // compute days until dateDepot
            let isCritical = false;
            try {
              const date = new Date(dao.dateDepot);
              const diffDays = Math.ceil(
                (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              if (diffDays <= daysThreshold) isCritical = true;
            } catch {}

            const progress = computeDaoProgress(dao);
            if (progress <= progressThreshold) isCritical = true;

            if (!isCritical) continue;

            const last = lastReminded.get(dao.id) || 0;
            if (now - last < repeatMs) continue; // skip if recently reminded

            lastReminded.set(dao.id, now);

            const title = `Rappel: DAO critique — ${dao.objetDossier}`;
            const message = `Le DAO ${dao.objetDossier} (${dao.reference}) est toujours critique. Date de dépôt: ${dao.dateDepot} — Progression: ${progress}%`;

            if (mode === "all") {
              await NotificationService.add({
                type: "dao_updated",
                title,
                message,
                data: { daoId: dao.id },
                recipients: "all",
              });
              logger.info(
                "CriticalReminder: notified all users for DAO",
                "CRITICAL_REMINDER",
                { daoId: dao.id },
              );
            } else if (mode === "central") {
              const central = normalizeEmail(
                process.env.SMTP_CENTRAL_ADDRESS || "",
              );
              if (central && isValidEmail(central)) {
                await sendEmail(central, title, message, "DAO_UPDATED");
                logger.info(
                  "CriticalReminder: sent central reminder",
                  "CRITICAL_REMINDER",
                  { daoId: dao.id, central },
                );
              } else {
                logger.warn(
                  "CriticalReminder: central mode enabled but SMTP_CENTRAL_ADDRESS not set or invalid",
                  "CRITICAL_REMINDER",
                );
              }
            } else {
              // team mode — notify team members
              const memberIds = Array.isArray(dao.equipe)
                ? dao.equipe.map((m) => String((m as any).id))
                : [];
              await NotificationService.add({
                type: "dao_updated",
                title,
                message,
                data: { daoId: dao.id },
                recipients: memberIds,
              });
              logger.info(
                "CriticalReminder: notified team for DAO",
                "CRITICAL_REMINDER",
                { daoId: dao.id },
              );
            }
          } catch (e) {
            logger.warn(
              "CriticalReminder: error handling DAO",
              "CRITICAL_REMINDER",
              {
                daoId: (dao as any).id,
                err: String((e as Error)?.message || e),
              },
            );
          }
        }
      } catch (err) {
        logger.warn(
          "CriticalReminder: unexpected error during scan",
          "CRITICAL_REMINDER",
          { message: String((err as Error)?.message || err) },
        );
      }
    };

    // Run once immediately, then schedule
    void tick();
    timer = setInterval(() => void tick(), interval);
    logger.info("CriticalReminder: started", "CRITICAL_REMINDER", { interval });
  } catch (err) {
    logger.warn("CriticalReminder: failed to start", "CRITICAL_REMINDER", {
      message: String((err as Error)?.message || err),
    });
  }
}

export function stopCriticalReminderService() {
  if (timer) clearInterval(timer);
  running = false;
  lastReminded.clear();
}
