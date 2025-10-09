/**
Rôle: Middleware Express — src/backend-express/middleware/auth.ts
Domaine: Backend/Middleware
Exports: authorize, requireAdmin, requireDaoLeaderOrAdmin, requireUser, requireAuth, requireOwnership, auditLog, sensitiveOperationLimit
Dépendances: express, ../services/authService, ../services/daoService, ../utils/logger, @shared/dao
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
/**
 * Middlewares d'authentification/autorisation backend
 * - authenticate: vérifie le JWT et peuple req.user (pas de PII dans les logs)
 * - authorize/requireAdmin/requireUser: contrôle fin par rôle
 * - requireDaoLeaderOrAdmin/requireOwnership: protections métier supplémentaires
 */
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { DaoService } from "../services/daoService";
import { logger } from "../utils/logger";
import type { AuthUser, UserRole } from "@shared/dao";

// Étend le type Request pour inclure user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentifie la requête via le JWT (Authorization: Bearer ...).
 * - Valide le token, charge l'utilisateur, peuple req.user
 * - 401 si token absent/invalidé/expiré
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.security("Accès refusé : jeton manquant", undefined, req.ip, {
        method: req.method,
        url: req.originalUrl,
      });
      return void res.status(401).json({
        error: "Jeton d’accès requis",
        code: "NO_TOKEN",
      });
    }

    const token = authHeader.substring(7); // Retirer le préfixe 'Bearer '

    if (!token) {
      logger.security("Accès refusé : jeton vide", undefined, req.ip, {
        method: req.method,
        url: req.originalUrl,
      });
      return void res.status(401).json({
        error: "Jeton d’accès requis",
        code: "EMPTY_TOKEN",
      });
    }

    const user = await AuthService.verifyToken(token);

    if (!user) {
      logger.security(
        "Accès refusé : jeton invalide ou expiré",
        undefined,
        req.ip,
        {
          method: req.method,
          url: req.originalUrl,
        },
      );
      return void res.status(401).json({
        error: "Jeton invalide ou expiré",
        code: "INVALID_TOKEN",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(
      "Erreur d’authentification",
      "AUTH_MIDDLEWARE",
      { message: (error as Error)?.message },
      undefined,
      req.ip,
    );
    return void res.status(401).json({
      error: "Échec de l’authentification",
      code: "AUTH_ERROR",
    });
  }
}

/**
 * Fabrique un middleware d'autorisation par rôle.
 * - Autorise si req.user.role ∈ roles, sinon 403
 */
export function authorize(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.security(
        "Accès refusé : contexte utilisateur manquant",
        undefined,
        req.ip,
        {
          method: req.method,
          url: req.originalUrl,
        },
      );
      return void res.status(401).json({
        error: "Authentification requise",
        code: "NO_USER_CONTEXT",
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.security(
        "Accès refusé : permissions insuffisantes",
        req.user.id,
        req.ip,
        {
          method: req.method,
          url: req.originalUrl,
          role: req.user.role,
        },
      );
      return void res.status(403).json({
        error: "Permissions insuffisantes",
        required: roles,
        current: req.user.role,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
}

// Middleware réservé aux admins
export const requireAdmin = authorize(["admin"]);

/**
 * Autorise l'accès aux admins ou au chef d'équipe du DAO.
 * - paramKey: nom du param contenant l'ID du DAO (ex: "id")
 * - 403 si non admin et non chef sur ce DAO
 */
export function requireDaoLeaderOrAdmin(paramKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ error: "Authentification requise", code: "NO_USER_CONTEXT" });
      }
      // L'admin passe immédiatement
      if (req.user.role === "admin") return next();

      const daoId = req.params[paramKey];
      if (!daoId) {
        return res
          .status(400)
          .json({ error: "ID du DAO manquant", code: "MISSING_DAO_ID" });
      }

      const dao = await DaoService.getDaoById(daoId);
      if (!dao) {
        return res
          .status(404)
          .json({ error: "DAO introuvable", code: "DAO_NOT_FOUND" });
      }

      const isLeader = dao.equipe.some(
        (m) => m.id === req.user!.id && m.role === "chef_equipe",
      );

      if (!isLeader) {
        return res
          .status(403)
          .json({ error: "Permissions insuffisantes", code: "NOT_LEADER" });
      }

      next();
    } catch (error) {
      logger.error(
        "Échec de la vérification d’autorisation",
        "AUTHZ_MIDDLEWARE",
        { message: (error as Error)?.message },
        req.user?.id,
        req.ip,
      );
      return res.status(500).json({
        error: "Échec de la vérification d’autorisation",
        code: "AUTHZ_ERROR",
      });
    }
  };
}

// Middleware pour admin ou utilisateur (exclut les lecteurs s’ils existent)
export const requireUser = authorize(["admin", "user"]);

// Tout utilisateur authentifié
export const requireAuth = authenticate;

/**
 * Authentification optionnelle.
 * - Tente de décoder le token si présent mais ne bloque pas en cas d'échec
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      if (token) {
        const user = await AuthService.verifyToken(token);
        if (user) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // Ne pas échouer pour l’auth optionnelle, continuer simplement sans utilisateur
    logger.warn(
      "Authentification optionnelle échouée, poursuite sans utilisateur",
      "AUTH_OPTIONAL",
      { message: (error as Error)?.message },
      undefined,
      req.ip,
    );
    next();
  }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'une ressource.
 * - getUserIdFromRequest: fonction pour extraire l'ID propriétaire de la requête
 * - Admin bypass
 */
export function requireOwnership(
  getUserIdFromRequest: (req: Request) => string,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return void res.status(401).json({
        error: "Authentification requise",
        code: "NO_USER_CONTEXT",
      });
    }

    // L'administrateur peut accéder à tout
    if (req.user.role === "admin") {
      return next();
    }

    const resourceUserId = getUserIdFromRequest(req);

    if (req.user.id !== resourceUserId) {
      logger.security("Violation de propriété", req.user.id, req.ip, {
        method: req.method,
        url: req.originalUrl,
      });
      return void res.status(403).json({
        error: "Vous ne pouvez accéder qu’à vos propres ressources",
        code: "OWNERSHIP_VIOLATION",
      });
    }

    next();
  };
}

/**
 * Journal d'audit post-réponse.
 * - Log SUCCESS/FAILED selon statusCode
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (body) {
      // Journaliser l'action après la réponse
      const statusCode = res.statusCode;
      const success = statusCode < 400;

      if (success) {
        logger.audit(`${action} - SUCCÈS`, req.user?.id, req.ip);
      } else {
        logger.audit(`${action} - ÉCHEC`, req.user?.id, req.ip, {
          method: req.method,
          url: req.originalUrl,
          statusCode,
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Limiteur de tentatives pour opérations sensibles (ex: création).
 * - Fenêtre courte, seuil plus permissif en dev
 */
export function sensitiveOperationLimit() {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  const MAX_ATTEMPTS = process.env.NODE_ENV === "production" ? 5 : 20; // Plus permissif en dev
  const WINDOW_MS =
    process.env.NODE_ENV === "production" ? 60 * 1000 : 30 * 1000; // Fenêtre plus courte en dev

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.user?.id || "anonymous"}`;
    const now = Date.now();
    const userAttempts = attempts.get(key);

    if (!userAttempts || now > userAttempts.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
      return next();
    }

    if (userAttempts.count >= MAX_ATTEMPTS) {
      logger.security(
        "Limite de tentatives dépassée pour une opération sensible",
        req.user?.id,
        req.ip,
      );
      return void res.status(429).json({
        error: "Trop de tentatives, veuillez réessayer plus tard",
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
        code: "RATE_LIMITED",
      });
    }

    userAttempts.count++;
    next();
  };
}
