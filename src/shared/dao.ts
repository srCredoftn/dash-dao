/**
Rôle: Types & contrats partagés — src/shared/dao.ts
Domaine: Shared
Exports: TeamMember, DaoTask, Dao, DaoStats, TaskGlobalProgress, DaoFilters, DaoStatus, UserRole
Liens: importé par frontend et backend
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
/**
 * Types et helpers partagés côté DAO/tâches/utilisateurs.
 * Importés par le frontend et le backend via @shared/dao.
 */
export interface TeamMember {
  id: string;
  name: string;
  role: "chef_equipe" | "membre_equipe";
  email?: string;
}

export interface DaoTask {
  id: number;
  name: string;
  progress: number | null; // null pour N/A
  comment?: string; // Ancien commentaire unique
  comments?: TaskComment[]; // Nouveau système de commentaires
  isApplicable: boolean;
  assignedTo?: string[]; // Identifiants des membres assignés à cette tâche (assignations multiples)
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export interface Dao {
  id: string;
  numeroListe: string;
  objetDossier: string;
  reference: string;
  autoriteContractante: string;
  dateDepot: string; // chaîne ISO
  equipe: TeamMember[];
  tasks: DaoTask[];
  createdAt: string;
  updatedAt: string;
}

export interface DaoStats {
  totalDaos: number;
  daoEnCours: number;
  daoTermines: number;
  daoArisque: number; // < 3 jours avant l’échéance
  progressionGlobale: number; // Progression moyenne de tous les DAO actifs
}

export interface TaskGlobalProgress {
  taskId: number;
  taskName: string;
  globalProgress: number;
  applicableDaosCount: number;
}

export interface DaoFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  autoriteContractante?: string;
  statut?: "en_cours" | "termine" | "a_risque";
  equipe?: string;
}

export type DaoStatus = "completed" | "urgent" | "safe" | "default";

// Rôles utilisateur et authentification
export type UserRole = "admin" | "user" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
}

// Système de commentaires
export interface TaskComment {
  id: string;
  taskId: number;
  daoId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

// Contexte d’authentification
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string; // photo de profil optionnelle côté client ou fournie par le backend
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export const DEFAULT_TASKS: Omit<
  DaoTask,
  "progress" | "comment" | "assignedTo"
>[] = [
  {
    id: 1,
    name: "Résumé sommaire DAO et Création du drive",
    isApplicable: true,
  },
  { id: 2, name: "Demande de caution et garanties", isApplicable: true },
  {
    id: 3,
    name: "Identification et renseignement des profils dans le drive",
    isApplicable: true,
  },
  {
    id: 4,
    name: "Identification et renseignement des ABE dans le drive",
    isApplicable: true,
  },
  {
    id: 5,
    name: "Légalisation des ABE, diplômes, certificats, attestations et pièces administratives requis",
    isApplicable: true,
  },
  {
    id: 6,
    name: "Indication directive d'élaboration de l'offre financier",
    isApplicable: true,
  },
  { id: 7, name: "Elaboration de la méthodologie", isApplicable: true },
  { id: 8, name: "Planification prévisionnelle", isApplicable: true },
  {
    id: 9,
    name: "Identification des références précises des équipements et matériels",
    isApplicable: true,
  },
  { id: 10, name: "Demande de cotation", isApplicable: true },
  { id: 11, name: "Elaboration du squelette des offres", isApplicable: true },
  { id: 12, name: "Rédaction du contenu des OF et OT", isApplicable: true },
  { id: 13, name: "Contrôle et validation des offres", isApplicable: true },
  {
    id: 14,
    name: "Impression et présentation des offres (Valider l'étiquette)",
    isApplicable: true,
  },
  { id: 15, name: "Dépôt des offres et clôture", isApplicable: true },
];

export function calculateDaoStatus(
  dateDepot: string,
  progress: number,
): DaoStatus {
  const today = new Date();
  const depotDate = new Date(dateDepot);
  const daysDiff = Math.ceil(
    (depotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Logique de priorité telle que spécifiée
  if (progress >= 100) return "completed";
  if (daysDiff >= 5) return "safe";
  if (daysDiff <= 3) return "urgent";
  return "default";
}

export function calculateDaoProgress(tasks: DaoTask[]): number {
  // Ne considérer que les tâches applicables
  const applicableTasks = tasks.filter((task) => task.isApplicable);
  if (applicableTasks.length === 0) return 0;

  // Somme de toutes les progressions (null est traité comme 0)
  const totalProgress = applicableTasks.reduce((sum, task) => {
    return sum + (task.progress ?? 0);
  }, 0);

  // Calculer la moyenne et arrondir à l’entier le plus proche
  const averageProgress = totalProgress / applicableTasks.length;
  return Math.round(averageProgress);
}
