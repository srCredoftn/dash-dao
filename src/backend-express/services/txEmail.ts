/**
Rôle: Service métier côté serveur — src/backend-express/services/txEmail.ts
Domaine: Backend/Services
Exports: MailType, computeDaoProgress, Templates
Dépendances: ../utils/logger, @shared/dao
Liens: appels /api, utils de fetch, types @shared/*
S��curité: veille à la validation d���entrée, gestion JWT/refresh, envoi mail robuste
Performance: cache/partitionnement/bundling optimisés
*/
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import nodemailer from "nodemailer";
import { logger } from "../utils/logger";
import { normalizeEmail, partitionEmails } from "../utils/email";
import type { Dao, DaoTask } from "@shared/dao";
import { AuthService } from "./authService";

type EmailBatchFailure = {
  code: string;
  message: string;
  recipients: string[];
};

type EmailDeliverySummary = {
  subject: string;
  attempted: number;
  sent: number;
  failed: number;
  errors: EmailBatchFailure[];
};

export type MailType =
  | "USER_CREATED"
  | "USER_DELETED_USER"
  | "USER_DELETED_ADMIN"
  | "DAO_CREATED"
  | "DAO_UPDATED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_ASSIGNED"
  | "TASK_REASSIGNED"
  | "TASK_COMMENTED"
  | "AUTH_PASSWORD_RESET"
  | "AUTH_PASSWORD_CHANGED"
  | "SYSTEM_TEST";

class EmailSendError extends Error {
  code?: string;
  permanent: boolean;
  summary?: EmailDeliverySummary;

  constructor(
    message: string,
    code?: string,
    permanent: boolean = false,
    summary?: EmailDeliverySummary,
  ) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    this.permanent = permanent;
    this.summary = summary;
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type EmailJob = {
  id: string;
  recipients: string[];
  subject: string;
  body: string;
  type?: MailType;
  resolve: (summary: EmailDeliverySummary) => void;
  reject: (error: EmailSendError) => void;
};

type SerializedEmailJob = {
  id: string;
  recipients: string[];
  subject: string;
  body: string;
  type?: MailType;
  enqueuedAt: string;
};

const emailQueue: EmailJob[] = [];
let isProcessingQueue = false;
const QUEUE_INTERVAL_MS = Math.max(
  0,
  Number(process.env.SMTP_QUEUE_INTERVAL_MS || 200),
);
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.SMTP_MAX_CONCURRENT || 3),
);
const MAX_RETRY = Math.max(1, Number(process.env.SMTP_MAX_RETRY || 3));
const RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.SMTP_RETRY_DELAY_MS || 2000),
);
const QUEUE_PERSIST_PATH =
  (process.env.SMTP_QUEUE_PATH && process.env.SMTP_QUEUE_PATH.trim()) ||
  "/tmp/emailQueue.json";

const persistedQueue: SerializedEmailJob[] = [];
let persistQueueChain: Promise<void> = Promise.resolve();

const deliveryStats = {
  totalSent: 0,
  totalFailed: 0,
};

// Diagnostics (mémoire) pour aider au debug des emails
const emailEvents: Array<{
  ts: string;
  subject: string;
  toCount: number;
  success: boolean;
  error?: string;
}> = [];
let lastTransportError: string | null = null;

// Helpers

function toArray<T>(x: T | T[] | undefined | null): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function getMailLogoUrl(): string {
  const envUrl = (process.env.MAIL_LOGO_URL || "").trim();
  const fallback =
    "https://2sndtechnologies.com/wp-content/uploads/2023/09/Logo2snd.png";
  try {
    const url = envUrl || fallback;
    // Liste d’autorisation basique : seulement http/https
    if (!/^https?:\/\//i.test(url)) return fallback;
    return url;
  } catch {
    return fallback;
  }
}

function buildEmailHtml(subject: string, body: string): string {
  const logoUrl = getMailLogoUrl();
  const safeText = (body || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = safeText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style=\"margin:0 0 12px; line-height:1.5; color:#1f2937;\">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang=\"fr\">
  <head>
    <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>${(subject && subject.trim()) || "Gestion des DAOs 2SND"}</title>
  </head>
  <body style=\"margin:0; padding:0; background-color:#f3f4f6;\">
    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background-color:#f3f4f6; padding:24px 0;\">
      <tr>
        <td align=\"center\">
          <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width:640px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);\">
            <tr>
              <td align=\"center\" style=\"padding:24px 24px 8px;\">
                <img src=\"${logoUrl}\" alt=\"Logo\" width=\"160\" style=\"display:block; max-width:60%; height:auto; margin:0 auto;\" />
              </td>
            </tr>
            <tr>
              <td style=\"padding:8px 24px 0; text-align:center;\">
                <h1 style=\"font-size:18px; line-height:1.4; margin:0 0 8px; color:#111827;\">Gestion des DAOs 2SND</h1>
              </td>
            </tr>
            <tr>
              <td style=\"padding:8px 24px 24px;\">
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style=\"padding:16px 24px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px;\">
                Cet email a été envoyé automatiquement par la plateforme DAO.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isDryRunEnabled(): boolean {
  if ((process.env.NODE_ENV || "").toLowerCase() === "test") return true;
  return String(process.env.SMTP_DRY_RUN || "false").toLowerCase() === "true";
}

function isTemporarySmtpError(code: string, message: string): boolean {
  const normalizedCode = (code || "").toString().trim().toUpperCase();
  if (!normalizedCode) return /timeout|temporar|retry/i.test(message || "");
  const temporaryCodes = new Set([
    "ETIMEDOUT",
    "ESOCKETTIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ECONNABORTED",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EAI_AGAIN",
    "ETIMEOUT",
    "ETEMPFAIL",
    "ECONNECTION",
  ]);
  if (temporaryCodes.has(normalizedCode)) return true;
  if (/^4\d\d$/.test(normalizedCode)) return true;
  if (normalizedCode === "421") return true;
  return /temporary|timeout|try again|later|rate limit/i.test(message || "");
}

async function persistQueueSnapshot() {
  try {
    const dir = dirname(QUEUE_PERSIST_PATH);
    await mkdir(dir, { recursive: true });
    const payload = JSON.stringify(persistedQueue, null, 2);
    persistQueueChain = persistQueueChain
      .then(() => writeFile(QUEUE_PERSIST_PATH, payload, "utf8"))
      .catch((error) => {
        logger.warn("Échec persistence queue emails", "MAIL", {
          message: String((error as Error)?.message || error),
        });
      });
    await persistQueueChain;
  } catch (error) {
    logger.warn("Impossible de persister la queue email", "MAIL", {
      message: String((error as Error)?.message || error),
    });
  }
}

function addPersistedJob(job: SerializedEmailJob) {
  persistedQueue.push(job);
  void persistQueueSnapshot();
}

function removePersistedJob(id: string) {
  const idx = persistedQueue.findIndex((item) => item.id === id);
  if (idx >= 0) {
    persistedQueue.splice(idx, 1);
    void persistQueueSnapshot();
  }
}

async function loadPersistedQueue() {
  try {
    const raw = await readFile(QUEUE_PERSIST_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    persistedQueue.splice(0, persistedQueue.length, ...data);
    let updatedPersisted = false;
    data.forEach((item: SerializedEmailJob) => {
      if (!item || !Array.isArray(item.recipients) || !item.subject) return;
      const jobId = item.id || randomUUID();
      if (!item.id) {
        item.id = jobId;
        updatedPersisted = true;
      }
      const job: EmailJob = {
        id: jobId,
        recipients: item.recipients,
        subject: item.subject,
        body: item.body,
        type: item.type,
        resolve: (summary) => {
          logger.info("Job email restauré envoyé", "MAIL", {
            subject: summary.subject,
            sent: summary.sent,
            failed: summary.failed,
          });
        },
        reject: (error) => {
          logger.error("Job email restauré en erreur", "MAIL", {
            code: (error as EmailSendError)?.code,
            message: String((error as Error)?.message || error),
          });
        },
      };
      emailQueue.push(job);
    });
    if (updatedPersisted) {
      void persistQueueSnapshot();
    }
    if (emailQueue.length > 0) {
      void processQueue();
    }
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    logger.warn("Impossible de lire la queue email persistée", "MAIL", {
      message: String((error as Error)?.message || error),
    });
  }
}

void loadPersistedQueue();

async function getTransport(excludeHosts: string[] = []) {
  try {
    const disabled =
      String(process.env.SMTP_DISABLE || "false").toLowerCase() === "true";
    if (disabled) return null;

    // Build candidate transports (primary + optional fallbacks)
    const candidates: Array<{
      name: string;
      host: string | undefined;
      port: number;
      secure: boolean;
      user: string | undefined;
      pass: string | undefined;
    }> = [];

    // Primary
    candidates.push({
      name: "primary",
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure:
        String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    });

    // Fallback order can be configured via SMTP_FALLBACK_ORDER (comma separated: sendgrid,mailgun,ses)
    const fallbackOrder = (
      process.env.SMTP_FALLBACK_ORDER || "sendgrid,mailgun,ses"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const name of fallbackOrder) {
      if (name === "sendgrid") {
        candidates.push({
          name: "sendgrid",
          host:
            process.env.SENDGRID_SMTP_HOST ||
            process.env.SENDGRID_HOST ||
            "smtp.sendgrid.net",
          port: Number(
            process.env.SENDGRID_SMTP_PORT || process.env.SENDGRID_PORT || 587,
          ),
          secure:
            String(
              process.env.SENDGRID_SMTP_SECURE || "false",
            ).toLowerCase() === "true",
          user:
            process.env.SENDGRID_SMTP_USER ||
            process.env.SENDGRID_USER ||
            "apikey",
          pass: process.env.SENDGRID_SMTP_PASS || process.env.SENDGRID_PASS,
        });
      } else if (name === "mailgun") {
        candidates.push({
          name: "mailgun",
          host:
            process.env.MAILGUN_SMTP_HOST ||
            process.env.MAILGUN_HOST ||
            "smtp.mailgun.org",
          port: Number(
            process.env.MAILGUN_SMTP_PORT || process.env.MAILGUN_PORT || 587,
          ),
          secure:
            String(process.env.MAILGUN_SMTP_SECURE || "false").toLowerCase() ===
            "true",
          user: process.env.MAILGUN_SMTP_USER || process.env.MAILGUN_USER,
          pass: process.env.MAILGUN_SMTP_PASS || process.env.MAILGUN_PASS,
        });
      } else if (name === "ses") {
        candidates.push({
          name: "ses",
          host:
            process.env.SES_SMTP_HOST ||
            process.env.SES_HOST ||
            "email-smtp.us-east-1.amazonaws.com",
          port: Number(
            process.env.SES_SMTP_PORT || process.env.SES_PORT || 587,
          ),
          secure:
            String(process.env.SES_SMTP_SECURE || "false").toLowerCase() ===
            "true",
          user: process.env.SES_SMTP_USER || process.env.SES_USER,
          pass: process.env.SES_SMTP_PASS || process.env.SES_PASS,
        });
      }
    }

    // Helper to create transport and verify quickly
    async function tryTransport(cfg: (typeof candidates)[number]) {
      if (!cfg.host || !cfg.user || !cfg.pass) {
        throw new Error(`incomplete-config:${cfg.name}`);
      }
      if (excludeHosts.includes(cfg.host!))
        throw new Error(`excluded-host:${cfg.name}`);
      const transport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 15000,
        socketTimeout: 20000,
        tls: { rejectUnauthorized: false },
      } as any);
      await transport.verify();
      return { transport, host: cfg.host, name: cfg.name };
    }

    const errors: string[] = [];
    let firstTransport: any = null;

    for (const cfg of candidates) {
      try {
        // skip incomplete candidate but remember primary for fallback return
        if (!firstTransport && cfg.host && cfg.user && cfg.pass) {
          // create but don't verify primary until we try
          firstTransport = {
            transport: nodemailer.createTransport({
              host: cfg.host,
              port: cfg.port,
              secure: cfg.secure,
              auth: { user: cfg.user, pass: cfg.pass },
              connectionTimeout: 15000,
              socketTimeout: 20000,
              tls: { rejectUnauthorized: false },
            } as any),
            host: cfg.host,
            name: cfg.name,
          };
        }

        if (!cfg.host || !cfg.user || !cfg.pass) {
          errors.push(`${cfg.name}: incomplete`);
          continue;
        }

        const verified = await tryTransport(cfg);
        lastTransportError = null;
        // success
        logger.info(`SMTP transport verified (${cfg.name})`, "MAIL", {
          host: cfg.host,
          name: cfg.name,
        });
        return verified;
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        errors.push(`${cfg.name}: ${msg}`);
        logger.warn(`SMTP verify failed for ${cfg.name}`, "MAIL", {
          host: cfg.host,
          name: cfg.name,
          message: msg,
        });
        // continue to next candidate
      }
    }

    // If none verified, return the first transport (primary) if available (best-effort)
    if (firstTransport) {
      lastTransportError = errors.join(" | ");
      logger.warn(
        "Aucun transport SMTP vérifié, utilisation du transport principal en mode best-effort",
        "MAIL",
        {
          errors: errors.slice(0, 5),
        },
      );
      return firstTransport;
    }

    lastTransportError = errors.join(" | ");
    logger.warn("Aucun transport SMTP disponible", "MAIL", {
      errors: errors.slice(0, 5),
    });
    return null;
  } catch (e) {
    lastTransportError = String((e as Error)?.message || e);
    logger.warn("SMTP transport unavailable", "MAIL", {
      message: String((e as Error)?.message),
    });
    return null;
  }
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  try {
    while (emailQueue.length > 0) {
      const jobs = emailQueue.splice(0, MAX_CONCURRENT);
      const executions = jobs.map(async (job) => {
        try {
          const summary = await deliverWithRetry(job);
          job.resolve(summary);
        } catch (error) {
          const err =
            error instanceof EmailSendError
              ? error
              : new EmailSendError(
                  String((error as Error)?.message || error),
                  (error as any)?.code || (error as any)?.responseCode,
                );
          job.reject(err);
        } finally {
          removePersistedJob(job.id);
        }
      });
      await Promise.allSettled(executions);
      if (QUEUE_INTERVAL_MS > 0 && emailQueue.length > 0) {
        await sleep(QUEUE_INTERVAL_MS);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

function enqueueEmailJob(params: {
  recipients: string[];
  subject: string;
  body: string;
  type?: MailType;
}): Promise<EmailDeliverySummary> {
  return new Promise((resolve, reject) => {
    const jobId = randomUUID();
    const serialized: SerializedEmailJob = {
      id: jobId,
      recipients: params.recipients,
      subject: params.subject,
      body: params.body,
      type: params.type,
      enqueuedAt: new Date().toISOString(),
    };
    addPersistedJob(serialized);
    emailQueue.push({
      id: jobId,
      recipients: params.recipients,
      subject: params.subject,
      body: params.body,
      type: params.type,
      resolve,
      reject,
    });
    void processQueue();
  });
}

async function deliverWithRetry(
  job: EmailJob,
  attempt = 1,
): Promise<EmailDeliverySummary> {
  try {
    return await deliverEmailJob(
      job.recipients,
      job.subject,
      job.body,
      job.type,
    );
  } catch (error) {
    const err =
      error instanceof EmailSendError
        ? error
        : new EmailSendError(
            String((error as Error)?.message || error),
            (error as any)?.code || (error as any)?.responseCode,
          );
    if (attempt < MAX_RETRY && !err.permanent) {
      await sleep(RETRY_DELAY_MS * attempt);
      return deliverWithRetry(job, attempt + 1);
    }
    throw err;
  }
}

async function deliverEmailJob(
  recipients: string[],
  subject: string,
  body: string,
  type?: MailType,
): Promise<EmailDeliverySummary> {
  const summary: EmailDeliverySummary = {
    subject,
    attempted: recipients.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  const BATCH_SIZE = Math.max(1, Number(process.env.SMTP_BATCH_SIZE || 25));
  const BATCH_DELAY_MS = Math.max(
    0,
    Number(process.env.SMTP_BATCH_DELAY_MS || 150),
  );
  const fromAddress =
    process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";
  const from = `"Gestion des DAOs 2SND" <${fromAddress}>`;
  const replyTo = process.env.SMTP_REPLY_TO || fromAddress;
  const plainBody = body;
  // If caller provided an HTML body (starts with '<'), use it directly; otherwise build an HTML wrapper
  const html =
    typeof body === "string" && body.trim().startsWith("<")
      ? body
      : buildEmailHtml(subject, body);
  const dryRun = isDryRunEnabled();

  if (dryRun) {
    summary.sent = summary.attempted;
    deliveryStats.totalSent += summary.sent;
    emailEvents.unshift({
      ts: new Date().toISOString(),
      subject,
      toCount: recipients.length,
      success: true,
    });
    if (emailEvents.length > 50) emailEvents.length = 50;
    logger.info("Envoi SMTP en mode dry-run", "MAIL", {
      subject,
      recipients: recipients.length,
      type,
    });
    return summary;
  }

  const excludedHosts: string[] = [];
  let currentTransportMeta = await getTransport(excludedHosts);
  if (!currentTransportMeta) {
    const message = lastTransportError || "SMTP transport unavailable";
    summary.failed = summary.attempted;
    summary.errors.push({
      code: "transport_unavailable",
      message,
      recipients: [...recipients],
    });
    deliveryStats.totalFailed += summary.failed;
    emailEvents.unshift({
      ts: new Date().toISOString(),
      subject,
      toCount: recipients.length,
      success: false,
      error: message,
    });
    if (emailEvents.length > 50) emailEvents.length = 50;
    throw new EmailSendError(message, undefined, true, summary);
  }

  let hasErrors = false;
  let hasPermanentFailure = false;

  for (let index = 0; index < recipients.length; ) {
    const effectiveBatchSize = Math.min(BATCH_SIZE, recipients.length - index);
    const batch = recipients.slice(index, index + effectiveBatchSize);
    try {
      await currentTransportMeta.transport.sendMail({
        from,
        replyTo,
        to: fromAddress,
        bcc: batch.join(", "),
        subject,
        text: plainBody,
        html,
      });
      summary.sent += batch.length;
      emailEvents.unshift({
        ts: new Date().toISOString(),
        subject,
        toCount: batch.length,
        success: true,
      });
      if (emailEvents.length > 50) emailEvents.length = 50;
      index += effectiveBatchSize; // advance only on success
    } catch (error) {
      const err: any = error;
      const code = String(err?.responseCode || err?.code || "unknown");
      const message = String((error as Error)?.message || error);
      const temporary = isTemporarySmtpError(code, message);
      const permanent = !temporary;
      hasErrors = true;
      hasPermanentFailure = hasPermanentFailure || permanent;
      lastTransportError = message;
      summary.failed += batch.length;
      summary.errors.push({
        code,
        message,
        recipients: [...batch],
      });
      emailEvents.unshift({
        ts: new Date().toISOString(),
        subject,
        toCount: batch.length,
        success: false,
        error: `${code}: ${message}`,
      });
      if (emailEvents.length > 50) emailEvents.length = 50;
      logger.error("Échec envoi SMTP (batch)", "MAIL", {
        message,
        code,
        batchSize: batch.length,
        host: currentTransportMeta.host,
      });

      // If temporary throttling (eg 554 quota), try to exclude this host and get a new transport
      if (temporary) {
        logger.warn(
          "Temporary SMTP error detected, attempting fallback provider",
          "MAIL",
          { code, host: currentTransportMeta.host },
        );
        excludedHosts.push(currentTransportMeta.host);
        const nextTransportMeta = await getTransport(excludedHosts);
        if (
          nextTransportMeta &&
          nextTransportMeta.host !== currentTransportMeta.host
        ) {
          logger.info("Switched SMTP transport to fallback", "MAIL", {
            from: currentTransportMeta.host,
            to: nextTransportMeta.host,
          });
          currentTransportMeta = nextTransportMeta;
          // on fallback, reduce batch size for safety (handled by effectiveBatchSize logic)
          // adjust index remains same to retry this batch
          // small delay before retrying
          await sleep(1000);
          continue; // retry same index with new transport
        }
        // no fallback or same host, apply backoff before retrying
        await sleep(RETRY_DELAY_MS);
        continue; // retry same batch
      }

      // permanent error: skip these recipients and continue
      index += effectiveBatchSize;
    }

    if (BATCH_DELAY_MS > 0 && index < recipients.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  deliveryStats.totalSent += summary.sent;
  deliveryStats.totalFailed += summary.failed;

  if (hasErrors && summary.errors.length > 0) {
    const primary = summary.errors[0];
    throw new EmailSendError(
      primary?.message || "Échec partiel de l'envoi SMTP",
      primary?.code,
      hasPermanentFailure,
      summary,
    );
  }

  lastTransportError = null;
  logger.info("Envoi SMTP réussi", "MAIL", {
    subject,
    sent: summary.sent,
    type,
  });

  return summary;
}

// Envoi centralisé : fonction principale (HTML avec logo centré ; repli sécurisé)
export let sendEmail = async (
  to: string | string[],
  subject: string,
  body: string,
  type?: MailType,
): Promise<void> => {
  const { valid, invalid } = partitionEmails(toArray(to));
  const recipients = Array.from(new Set(valid));

  if (invalid.length > 0) {
    logger.warn("Adresses e-mail invalides ignorées pour l'envoi", "MAIL", {
      invalid: Array.from(new Set(invalid)),
    });
  }

  if (recipients.length === 0) {
    logger.warn("Envoi d'e-mail annulé : aucun destinataire valide", "MAIL", {
      subject,
    });
    return;
  }

  const smtpSubject = (subject && subject.trim()) || "Gestion des DAOs 2SND";
  const normalizedBody = body || "";

  try {
    const summary = await enqueueEmailJob({
      recipients,
      subject: smtpSubject,
      body: normalizedBody,
      type,
    });

    if (summary.failed === 0) {
      return;
    }

    if (summary.sent === 0) {
      const firstError = summary.errors[0];
      throw new EmailSendError(
        firstError?.message || "SMTP send failed",
        firstError?.code,
        firstError?.code === "transport_unavailable",
        summary,
      );
    }
  } catch (error) {
    if (error instanceof EmailSendError) {
      if (!error.summary) {
        error.summary = {
          subject: smtpSubject,
          attempted: recipients.length,
          sent: 0,
          failed: recipients.length,
          errors: [],
        };
      }
      throw error;
    }
    throw new EmailSendError(
      String((error as Error)?.message || error),
      (error as any)?.code || (error as any)?.responseCode,
      false,
      {
        subject: smtpSubject,
        attempted: recipients.length,
        sent: 0,
        failed: recipients.length,
        errors: [],
      },
    );
  }
};

async function getAllUserEmails(): Promise<string[]> {
  try {
    const users = await AuthService.getAllUsers();
    const { valid, invalid } = partitionEmails(users.map((u) => u.email));
    if (invalid.length > 0) {
      logger.warn("Emails utilisateurs invalides ignorés", "MAIL", {
        invalid: Array.from(new Set(invalid)),
      });
    }
    return Array.from(new Set(valid));
  } catch {
    return [];
  }
}

function frDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function teamLine(dao: Dao): { chef: string; membres: string } {
  const chef = dao.equipe.find((m) => m.role === "chef_equipe");
  const membres = dao.equipe.filter((m) => m.role !== "chef_equipe");
  const chefStr = chef ? chef.name : "Non défini";
  const membersStr = membres.map((m) => m.name).join(", ") || "Aucun";
  return { chef: chefStr, membres: membersStr };
}

export function computeDaoProgress(dao: Dao): number {
  const applicable = (dao.tasks || []).filter((t) => t.isApplicable);
  if (applicable.length === 0) return 0;
  const sum = applicable.reduce((acc, t) => acc + (t.progress ?? 0), 0);
  return Math.round(sum / applicable.length);
}

export const Templates = {
  user: {
    created(params: { name: string; email: string; password: string }) {
      const subject = "Votre compte a été créé sur la plateforme DAO";
      const body = [
        `Bonjour ${params.name},`,
        `Votre compte a été créé avec succès sur la plateforme DAO.`,
        `Identifiant : ${params.email}`,
        `Mot de passe : ${params.password}`,
        `Merci de vous connecter et de modifier votre mot de passe dès votre première connexion.`,
      ].join("\n\n");
      return { subject, body };
    },
    deletedUser(params: { name: string }) {
      const subject = "Suppression de votre compte";
      const body = [
        `Bonjour ${params.name},`,
        `Votre compte a été supprimé de la plateforme DAO.`,
      ].join("\n\n");
      return { subject, body };
    },
    deletedAdmin(params: { name: string; email: string }) {
      const subject = "Suppression d’un utilisateur";
      const body = [
        `Bonjour Admin,`,
        `L’utilisateur ${params.name} (${params.email}) a été supprimé.`,
      ].join("\n\n");
      return { subject, body };
    },
  },
  dao: {
    created(dao: Dao) {
      const subject = `Nouveau DAO créé - ${dao.objetDossier}`;
      const team = teamLine(dao);
      const body = [
        `Un nouveau DAO a été créé :`,
        `Nom : ${dao.objetDossier}`,
        `R��férence : ${dao.reference}`,
        `Objet : ${dao.objetDossier}`,
        `Autorité contractante : ${dao.autoriteContractante}`,
        `Date de dépôt : ${frDate(dao.dateDepot)}`,
        `Chef d’équipe : ${team.chef}`,
        `Membres : ${team.membres}`,
      ].join("\n");
      return { subject, body };
    },
    updated(ctx: {
      before: Dao;
      after: Dao;
      teamChanges?: string[];
      taskChanges?: Array<{ name: string; changes: string[] }>;
    }) {
      const { before, after, teamChanges, taskChanges } = ctx;
      const subject = `Mise à jour DAO - ${after.objetDossier}`;
      const lines: string[] = [
        "Mise à jour d’un DAO",
        `Numéro de liste : ${after.numeroListe}`,
        `Autorité contractante : ${after.autoriteContractante}`,
        `Date de dépôt : ${frDate(after.dateDepot)}`,
      ];

      const changeLines: string[] = [];
      if (before.numeroListe !== after.numeroListe) {
        changeLines.push(
          `Numéro de liste : ${before.numeroListe} → ${after.numeroListe}`,
        );
      }
      if (before.reference !== after.reference) {
        changeLines.push(
          `Référence : ${before.reference} → ${after.reference}`,
        );
      }
      if (before.objetDossier !== after.objetDossier) {
        changeLines.push(
          `Objet du dossier : ${before.objetDossier} → ${after.objetDossier}`,
        );
      }
      if (before.autoriteContractante !== after.autoriteContractante) {
        changeLines.push(
          `Autorité contractante : ${before.autoriteContractante} → ${after.autoriteContractante}`,
        );
      }
      if (before.dateDepot !== after.dateDepot) {
        changeLines.push(
          `Date de dépôt : ${frDate(before.dateDepot)} → ${frDate(after.dateDepot)}`,
        );
      }
      const beforeTeam = teamLine(before);
      const afterTeam = teamLine(after);
      if (beforeTeam.chef !== afterTeam.chef) {
        changeLines.push(
          `Chef d’équipe : ${beforeTeam.chef} → ${afterTeam.chef}`,
        );
      }
      if (beforeTeam.membres !== afterTeam.membres) {
        changeLines.push(
          `Membres : ${beforeTeam.membres} → ${afterTeam.membres}`,
        );
      }
      const prevProgress = computeDaoProgress(before);
      const currProgress = computeDaoProgress(after);
      if (prevProgress !== currProgress) {
        changeLines.push(`Progression : ${prevProgress}% → ${currProgress}%`);
      }

      if (changeLines.length) {
        lines.push("", ...changeLines);
      }

      if (teamChanges && teamChanges.length) {
        lines.push("", "Équipe :");
        teamChanges.forEach((change, index) => {
          lines.push(`${index + 1}. ${change}`);
        });
      }

      if (taskChanges && taskChanges.length) {
        lines.push("", "Tâches modifiées :");
        taskChanges.forEach((item, index) => {
          lines.push(`${index + 1}. ${item.name}`);
          item.changes.forEach((detail) => lines.push(`   • ${detail}`));
        });
      }

      return { subject, body: lines.join("\n") };
    },
  },
  task: {
    created(ctx: { dao: Dao; task: DaoTask }) {
      const subject = `Nouvelle tâche - ${ctx.dao.objetDossier}`;
      const body = [
        `DAO : ${ctx.dao.objetDossier} (${ctx.dao.reference})`,
        `Autorité contractante : ${ctx.dao.autoriteContractante}`,
        `Date de dépôt : ${frDate(ctx.dao.dateDepot)}`,
        ``,
        `Tâche : ${ctx.task.name}`,
        `Niveau de progression : ${ctx.task.progress ?? 0}%`,
        ``,
        `Action : Création`,
      ].join("\n");
      return { subject, body };
    },
    updated(ctx: {
      dao: Dao;
      previous: DaoTask;
      current: DaoTask;
      action?: string;
      added?: string[];
      removed?: string[];
      comment?: string;
    }) {
      const subject = `Mise à jour d’une tâche - ${ctx.dao.objetDossier}`;
      const header: string[] = [
        "Mise à jour d’une tâche",
        `Numéro de liste : ${ctx.dao.numeroListe}`,
        `Autorité contractante : ${ctx.dao.autoriteContractante}`,
        `Date de dépôt : ${frDate(ctx.dao.dateDepot)}`,
        "",
        `Nom de la Tâche : ${ctx.current.name}`,
        `Numéro de la Tâche : ${ctx.current.id}`,
        `Action : ${ctx.action || "Mise à jour"}`,
      ];

      const memberMap = new Map(ctx.dao.equipe.map((m) => [m.id, m.name]));
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
        value.length > 120 ? `${value.slice(0, 117)}...` : value;

      const details: string[] = [];
      const prevProgress = ctx.previous.progress ?? 0;
      const currProgress = ctx.current.progress ?? 0;
      if (prevProgress !== currProgress) {
        details.push(`Progression antérieure : ${prevProgress}%`);
        details.push(`Progression modifiée : ${currProgress}%`);
      }
      if (ctx.previous.isApplicable !== ctx.current.isApplicable) {
        details.push(
          `Applicabilité antérieure : ${formatBool(ctx.previous.isApplicable)}`,
        );
        details.push(
          `Applicabilité modifiée : ${formatBool(ctx.current.isApplicable)}`,
        );
      }
      if ((ctx.previous.comment || "") !== (ctx.current.comment || "")) {
        const oldComment = truncate(ctx.previous.comment?.trim() || "—");
        const newComment = truncate(ctx.current.comment?.trim() || "—");
        details.push(`Commentaire antérieur : ${oldComment}`);
        details.push(`Commentaire modifié : ${newComment}`);
      }
      if (
        JSON.stringify((ctx.previous.assignedTo || []).slice().sort()) !==
        JSON.stringify((ctx.current.assignedTo || []).slice().sort())
      ) {
        details.push(
          `Assignations antérieures : ${formatAssignees(ctx.previous.assignedTo)}`,
        );
        details.push(
          `Assignations modifiées : ${formatAssignees(ctx.current.assignedTo)}`,
        );
      }
      if (Array.isArray(ctx.added) && ctx.added.length) {
        details.push(`Assignations ajoutées : ${formatAssignees(ctx.added)}`);
      }
      if (Array.isArray(ctx.removed) && ctx.removed.length) {
        details.push(`Assignations retirées : ${formatAssignees(ctx.removed)}`);
      }
      if (ctx.comment && ctx.comment.trim()) {
        details.push(`Commentaire saisi : "${truncate(ctx.comment.trim())}"`);
      }

      const body = details.length
        ? [...header, "", ...details].join("\n")
        : header.join("\n");
      return { subject, body };
    },
    commented(ctx: { dao: Dao; task: DaoTask; comment: string }) {
      const subject = `Nouveau commentaire sur une tâche - ${ctx.dao.objetDossier}`;
      const body = [
        `DAO : ${ctx.dao.objetDossier} (${ctx.dao.reference})`,
        `Tâche : ${ctx.task.name}`,
        `Progression : ${ctx.task.progress ?? 0}%`,
        ``,
        `Action : Nouveau commentaire ajouté`,
        `Commentaire : "${ctx.comment}"`,
      ].join("\n");
      return { subject, body };
    },
  },
};

export async function emailAllUsers(
  subject: string,
  body: string,
  type?: MailType,
) {
  const recipients = await getAllUserEmails();
  const admin = normalizeEmail(process.env.ADMIN_EMAIL || "");
  const list = admin ? [...recipients, admin] : recipients;
  let sender = sendEmail;
  if ((process.env.NODE_ENV || "").toLowerCase() === "test") {
    try {
      const self = await import("./txEmail");
      if (typeof (self as any).sendEmail === "function") {
        sender = (self as any).sendEmail as typeof sendEmail;
      }
    } catch {}
  }
  await sender(list, subject, body, type);
}

// Diagnostics exposés
export function getEmailDiagnostics() {
  const cfg = {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    disabled:
      String(process.env.SMTP_DISABLE || "false").toLowerCase() === "true",
    dryRun: isDryRunEnabled(),
    lastTransportError,
  };
  const queue = {
    persisted: persistedQueue.length,
    inMemory: emailQueue.length,
    processing: isProcessingQueue,
    intervalMs: QUEUE_INTERVAL_MS,
    maxConcurrent: MAX_CONCURRENT,
    maxRetry: MAX_RETRY,
    persistPath: QUEUE_PERSIST_PATH,
    backlogPreview: persistedQueue.slice(0, 5).map((item) => ({
      subject: item.subject,
      recipients: Array.isArray(item.recipients) ? item.recipients.length : 0,
      enqueuedAt: item.enqueuedAt,
    })),
  };
  const stats = { ...deliveryStats };
  return {
    config: cfg,
    queue,
    stats,
    recent: emailEvents.slice(0, 20),
  };
}

export function clearEmailDiagnostics() {
  emailEvents.length = 0;
  deliveryStats.totalSent = 0;
  deliveryStats.totalFailed = 0;
}

export async function emailAdmin(
  subject: string,
  body: string,
  type?: MailType,
) {
  const admin = process.env.ADMIN_EMAIL;
  if (admin) await sendEmail(admin, subject, body, type);
}
