/**
 * Auto user audit store — records auto-created/reactivated users with non-sensitive info
 */

type AuditAction = "created" | "reactivated" | "already_active" | "error";

export type AutoUserAuditEntry = {
  ts: string; // ISO
  action: AuditAction;
  emailMasked: string; // masked, e.g. ***@***
  daoId?: string | null;
  memberName?: string | null; // not sensitive (kept as provided)
  message?: string | null; // short status or error message
};

const store: AutoUserAuditEntry[] = [];

function maskEmail(e?: string | null) {
  if (!e) return "***@***";
  try {
    const s = String(e).trim();
    // mask local part and domain for safety
    return s.replace(/^[^@]+/, "***");
  } catch {
    return "***@***";
  }
}

export function recordAutoUserEvent(entry: {
  action: AuditAction;
  email?: string | null;
  daoId?: string | null;
  memberName?: string | null;
  message?: string | null;
}) {
  const rec: AutoUserAuditEntry = {
    ts: new Date().toISOString(),
    action: entry.action,
    emailMasked: maskEmail(entry.email),
    daoId: entry.daoId || null,
    memberName: entry.memberName || null,
    message: entry.message || null,
  };
  // keep recent 200 entries to avoid memory growth
  store.unshift(rec);
  if (store.length > 200) store.length = 200;
}

export function listAutoUserEvents(limit = 50) {
  return store.slice(0, Math.max(1, Math.min(limit, 200)));
}

export function clearAutoUserEvents() {
  store.length = 0;
}
