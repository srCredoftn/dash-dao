/**
Rôle: Utilitaires Backend — src/backend-express/utils/logger.ts
Domaine: Backend/Utils
Exports: LogLevel, logger, requestLogger
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
// Système de logging JSON avec masquage automatique des données sensibles
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel | string;
  message: string;
  context?: string;
  data?: any;
  userId?: string;
  ip?: string;
}

/**
 * Masque de manière sûre les valeurs sensibles pour les logs.
 * - masque les adresses e-mail
 * - remplace les tokens longs par des étoiles
 * - délègue le masquage des objets à maskSensitive
 * @param value Valeur à nettoyer
 * @returns Valeur masquée
 */
function redactValue(value: any): any {
  if (typeof value === "string") {
    // Masquer emails
    const maskedEmail = value.replace(
      /([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.[a-zA-Z]{2,}/g,
      (_m) => "***@***",
    );
    // Masquer tokens longs
    const maskedTokens = maskedEmail.replace(/[A-Za-z0-9-_]{20,}/g, "***");
    return maskedTokens;
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v));
  if (value && typeof value === "object") return maskSensitive(value);
  return value;
}

/**
 * Parcourt un objet et masque automatiquement les champs sensibles connus.
 * Conserve la structure d'origine (objet ou tableau) et applique redactValue
 * de manière récursive pour nettoyer les valeurs.
 * @param obj Objet à nettoyer
 * @returns Objet nettoyé avec champs sensibles masqués
 */
function maskSensitive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const SENSITIVE_KEYS = [
    "password",
    "pwd",
    "pass",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "email",
    "x-api-key",
    "apiKey",
    "secret",
  ];
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
      out[k] = "***";
    } else {
      out[k] = redactValue(v);
    }
  }
  return out;
}

/**
 * Retourne le nom lisible d'un niveau de log.
 * @param level Niveau de log numérique
 * @returns Chaîne représentant le niveau
 */
function levelName(level: LogLevel): string {
  return ["ERROR", "WARN", "INFO", "DEBUG"][level] || String(level);
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any,
    userId?: string,
    ip?: string,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: levelName(level),
      message,
      context,
      data: data != null ? maskSensitive(data) : undefined,
      userId,
      ip,
    };
  }

  private log(entry: LogEntry): void {
    const shouldLog =
      typeof entry.level === "string"
        ? LogLevel[entry.level as keyof typeof LogLevel] <= this.logLevel
        : (entry.level as any) <= this.logLevel;

    if (!shouldLog) return;

    const json = JSON.stringify(entry);

    switch (entry.level) {
      case "ERROR":
        console.error(json);
        break;
      case "WARN":
        console.warn(json);
        break;
      case "INFO":
        console.info(json);
        break;
      case "DEBUG":
        console.log(json);
        break;
      default:
        console.log(json);
    }
  }

  error(
    message: string,
    context?: string,
    data?: any,
    userId?: string,
    ip?: string,
  ): void {
    this.log(
      this.createLogEntry(LogLevel.ERROR, message, context, data, userId, ip),
    );
  }

  warn(
    message: string,
    context?: string,
    data?: any,
    userId?: string,
    ip?: string,
  ): void {
    this.log(
      this.createLogEntry(LogLevel.WARN, message, context, data, userId, ip),
    );
  }

  info(
    message: string,
    context?: string,
    data?: any,
    userId?: string,
    ip?: string,
  ): void {
    this.log(
      this.createLogEntry(LogLevel.INFO, message, context, data, userId, ip),
    );
  }

  debug(
    message: string,
    context?: string,
    data?: any,
    userId?: string,
    ip?: string,
  ): void {
    this.log(
      this.createLogEntry(LogLevel.DEBUG, message, context, data, userId, ip),
    );
  }

  auth(message: string, userId?: string, ip?: string, data?: any): void {
    this.info(message, "AUTH", data, userId, ip);
  }

  api(message: string, userId?: string, ip?: string, data?: any): void {
    this.info(message, "API", data, userId, ip);
  }

  security(message: string, userId?: string, ip?: string, data?: any): void {
    this.warn(message, "SECURITY", data, userId, ip);
  }

  audit(message: string, userId?: string, ip?: string, data?: any): void {
    this.info(message, "AUDIT", data, userId, ip);
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

export const logger = new Logger();

/**
 * Middleware Express qui journalise chaque requête HTTP à la fin de son traitement.
 * Calcule la durée, collecte des métadonnées et utilise différents niveaux
 * de log selon le code de statut (INFO/WARN/ERROR). Respecte la confidentialité
 * en ne loggant pas directement les champs sensibles grâce au système de masque.
 * @returns Middleware Express (req, res, next)
 */
export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const data = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        userAgent: req.get?.("User-Agent"),
      };

      if (res.statusCode >= 500) {
        logger.error("HTTP request", "HTTP", data, req.user?.id, req.ip);
      } else if (res.statusCode >= 400) {
        logger.warn("HTTP request", "HTTP", data, req.user?.id, req.ip);
      } else {
        logger.info("HTTP request", "HTTP", data, req.user?.id, req.ip);
      }

      if (res.statusCode >= 400) {
        logger.security(
          `Failed request: ${req.method} ${req.originalUrl}`,
          req.user?.id,
          req.ip,
          { statusCode: res.statusCode, userAgent: req.get?.("User-Agent") },
        );
      }
    });

    next();
  };
}
