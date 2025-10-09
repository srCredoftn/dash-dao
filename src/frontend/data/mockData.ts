/**
Rôle: Module TypeScript — src/frontend/data/mockData.ts
Domaine: Général
Exports: mockDaos
Dépendances: @shared/dao
*/
import { Dao, DEFAULT_TASKS, TeamMember } from "@shared/dao";

const sampleTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Marie Dubois",
    role: "chef_equipe",
    email: "marie.dubois@2snd.fr",
  },
  {
    id: "2",
    name: "Pierre Martin",
    role: "membre_equipe",
    email: "pierre.martin@2snd.fr",
  },
  {
    id: "3",
    name: "Sophie Laurent",
    role: "membre_equipe",
    email: "sophie.laurent@2snd.fr",
  },
  {
    id: "4",
    name: "Jean Moreau",
    role: "chef_equipe",
    email: "jean.moreau@2snd.fr",
  },
];

export const mockDaos: Dao[] = [
  {
    id: "1",
    numeroListe: "DAO-2025-001",
    objetDossier: "Modernisation du système informatique municipal",
    reference: "AMI-2025-SYSINFO",
    autoriteContractante: "Mairie de Lyon",
    dateDepot: "2025-08-20",
    equipe: [sampleTeamMembers[0], sampleTeamMembers[1]],
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      progress:
        task.id <= 8
          ? task.id === 1
            ? 100 // 100% -> GRIS
            : task.id === 2
              ? 75 // 75% avec 7j -> VERT
              : task.id === 3
                ? 50 // 50% avec 7j -> VERT
                : task.id === 4
                  ? 25 // 25% avec 7j -> VERT
                  : Math.floor(Math.random() * 90) + 10 // Autres entre 10-99%
          : null,
      comment: task.id <= 3 ? "En cours de finalisation" : undefined,
      assignedTo:
        task.id <= 8
          ? [sampleTeamMembers[Math.floor(Math.random() * 2)].id]
          : undefined,
    })),
    createdAt: "2024-12-15T10:00:00Z",
    updatedAt: "2024-12-20T15:30:00Z",
  },
  {
    id: "2",
    numeroListe: "DAO-2025-002",
    objetDossier: "Construction d'un centre de données régional",
    reference: "AO-2025-DATACENTER",
    autoriteContractante: "Conseil Régional Auvergne-Rhône-Alpes",
    dateDepot: "2025-08-10", // Date dépassée -> ROUGE
    equipe: [sampleTeamMembers[3], sampleTeamMembers[2]],
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      progress:
        task.id <= 12
          ? task.id === 1
            ? 100 // 100% -> GRIS (même si date dépassée)
            : task.id === 2
              ? 80 // 80% avec date dépassée -> ROUGE
              : task.id === 3
                ? 60 // 60% avec date dépassée -> ROUGE
                : task.id === 4
                  ? 40 // 40% avec date dépassée -> ROUGE
                  : Math.floor(Math.random() * 80) + 20 // Autres entre 20-99%
          : null,
      comment: task.id === 5 ? "Attente validation juridique" : undefined,
      assignedTo:
        task.id <= 12
          ? [sampleTeamMembers[Math.floor(Math.random() * 2) + 2].id]
          : undefined,
    })),
    createdAt: "2024-12-10T09:00:00Z",
    updatedAt: "2024-12-21T11:45:00Z",
  },
  {
    id: "3",
    numeroListe: "DAO-2025-003",
    objetDossier: "Mise en place d'un réseau fibre optique intercommunal",
    reference: "AMI-2025-FIBRE",
    autoriteContractante: "Communauté de Communes du Pays de Gex",
    dateDepot: "2025-08-25",
    equipe: [sampleTeamMembers[0], sampleTeamMembers[2]],
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      progress:
        task.id <= 5
          ? task.id === 1
            ? 100 // 100% -> GRIS
            : task.id === 2
              ? 85 // 85% avec 5j -> VERT
              : task.id === 3
                ? 65 // 65% avec 5j -> VERT
                : task.id === 4
                  ? 45 // 45% avec 5j -> VERT
                  : task.id === 5
                    ? 25 // 25% avec 5j -> VERT
                    : Math.floor(Math.random() * 90) + 10
          : null,
      comment: task.id === 2 ? "Documentation en cours de collecte" : undefined,
      assignedTo: task.id <= 5 ? [sampleTeamMembers[0].id] : undefined,
    })),
    createdAt: "2024-12-18T14:20:00Z",
    updatedAt: "2024-12-20T16:10:00Z",
  },
  {
    id: "4",
    numeroListe: "DAO-2025-004",
    objetDossier: "Développement d'une plateforme e-administration",
    reference: "AO-2025-EADMIN",
    autoriteContractante: "Préfecture du Rhône",
    dateDepot: "2025-08-17", // Dans 4 jours -> BLEU
    equipe: [sampleTeamMembers[1]],
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      progress:
        task.id <= 15
          ? task.id <= 10
            ? 100 // Premières 10 tâches à 100% -> GRIS
            : task.id === 11
              ? 90 // 90% avec 4j -> BLEU
              : task.id === 12
                ? 70 // 70% avec 4j -> BLEU
                : task.id === 13
                  ? 50 // 50% avec 4j -> BLEU
                  : task.id === 14
                    ? 30 // 30% avec 4j -> BLEU
                    : task.id === 15
                      ? 10 // 10% avec 4j -> BLEU
                      : 100
          : null,
      comment: task.id === 15 ? "Dossier en cours" : undefined,
      assignedTo: task.id <= 15 ? [sampleTeamMembers[1].id] : undefined,
    })),
    createdAt: "2024-11-25T08:00:00Z",
    updatedAt: "2024-12-16T17:00:00Z",
  },
];
