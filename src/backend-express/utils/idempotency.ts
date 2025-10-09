/**
Rôle: Utilitaires Backend — src/backend-express/utils/idempotency.ts
Domaine: Backend/Utils
Exports: cleanupIdempotency, getIdempotency, setIdempotency, hasIdempotency
Performance: cache/partitionnement/bundling optimisés
*/
// Helper idempotence en mémoire simple
const IDEMP_TTL_MS = 30_000; // 30s par défaut

type CachedEntry = { expires: number; payload: any };

const store = new Map<string, CachedEntry>();

/**
 * Supprime les entrées idempotentes périmées du magasin en mémoire.
 * Utilisé pour éviter la croissance illimitée de la Map et libérer les ressources.
 */
export function cleanupIdempotency() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
}

/**
 * Récupère une entrée idempotente si elle existe et n'est pas expirée.
 * Effectue un nettoyage préalable des entrées expirées.
 * @param key Clé d'idempotence
 * @returns La charge utile stockée ou null si absente/expirée
 */
export function getIdempotency(key: string) {
  cleanupIdempotency();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.payload;
}

/**
 * Enregistre une entrée idempotente en mémoire avec un TTL.
 * @param key Clé d'idempotence
 * @param payload Données associées
 * @param ttl Durée de vie en millisecondes (par défaut IDEMP_TTL_MS)
 */
export function setIdempotency(key: string, payload: any, ttl = IDEMP_TTL_MS) {
  store.set(key, { expires: Date.now() + ttl, payload });
}

/**
 * Vérifie l'existence d'une entrée idempotente non expirée.
 * @param key Clé d'idempotence
 * @returns true si une entrée valide existe, false sinon
 */
export function hasIdempotency(key: string) {
  return getIdempotency(key) !== null;
}
