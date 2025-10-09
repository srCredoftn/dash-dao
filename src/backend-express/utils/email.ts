/**
Rôle: Utilitaires Backend — src/backend-express/utils/email.ts
Domaine: Backend/Utils
Exports: normalizeEmail, isValidEmail, partitionEmails
*/

const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function isValidEmail(value: string | null | undefined): boolean {
  const normalized = normalizeEmail(value);
  if (!normalized) return false;
  return EMAIL_REGEX.test(normalized);
}

export function partitionEmails(inputs: Array<string | null | undefined>): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const value of inputs) {
    const normalized = normalizeEmail(value);
    if (!normalized) {
      if (value) invalid.push(String(value).trim());
      continue;
    }
    if (EMAIL_REGEX.test(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(normalized);
    }
  }

  return { valid, invalid };
}
