/**
Rôle: Middleware Express — src/backend-express/middleware/retry.ts
Domaine: Backend/Middleware
Exports: RetryFn, retryMiddleware
Dépendances: express
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import type { Request, Response, NextFunction } from "express";

export type RetryFn<T> = () => Promise<T>;

export async function withRetries<T>(
  fn: RetryFn<T>,
  maxRetries = 3,
  delayMs = 200,
): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      // Ne réessayer que sur des erreurs probablement transitoires (timeouts réseau/DB)
      const transient =
        /ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|timeout|MongoNetworkError|MongoServerSelectionError/i.test(
          msg,
        );
      if (!transient || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function retryMiddleware(maxRetries = 3, delayMs = 200) {
  return (
    _req: Request & { retry?: typeof withRetries },
    _res: Response,
    next: NextFunction,
  ) => {
    (_req as any).retry = (fn: any, retries = maxRetries, delay = delayMs) =>
      withRetries(fn, retries, delay);
    next();
  };
}
