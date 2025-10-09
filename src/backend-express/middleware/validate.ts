/**
Rôle: Middleware Express — src/backend-express/middleware/validate.ts
Domaine: Backend/Middleware
Exports: validateBody
Dépendances: zod, express
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import type { ZodSchema } from "zod";
import type { RequestHandler } from "express";

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (err: any) {
      if (err?.issues) {
        res.status(400).json({
          error: "Erreur de validation",
          code: "VALIDATION_ERROR",
          details: err.issues.map((e: any) => ({
            field: e.path?.join(".") || "",
            message: e.message,
          })),
        });
        return;
      }
      return next(err);
    }
  };
}
