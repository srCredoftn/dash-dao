/**
Rôle: Utilitaires Frontend — src/frontend/utils/permissions.ts
Domaine: Frontend/Utils
Exports: isTeamLead, canManageDao
Dépendances: @shared/dao
*/
import type { AuthUser, Dao } from "@shared/dao";

export function isTeamLead(
  dao: Dao,
  user: AuthUser | null | undefined,
): boolean {
  if (!dao || !user) return false;
  return dao.equipe.some((m) => m.id === user.id && m.role === "chef_equipe");
}

export function canManageDao(
  dao: Dao,
  user: AuthUser | null | undefined,
): boolean {
  if (!user) return false;
  return user.role === "admin" || isTeamLead(dao, user);
}
