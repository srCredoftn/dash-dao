import { describe, it, expect } from "vitest";
import { tplDaoUpdated } from "../services/notificationTemplates";
import type { Dao, DaoTask } from "@shared/dao";

const makeDao = (overrides?: Partial<Dao>): Dao => ({
  id: "dao-1",
  numeroListe: "DAO-2025-001",
  objetDossier: "Test DAO",
  reference: "REF-001",
  autoriteContractante: "ASIN",
  dateDepot: new Date().toISOString(),
  equipe: [
    { id: "u1", name: "Alice", role: "chef_equipe" },
    { id: "u2", name: "Bob", role: "membre_equipe" },
  ],
  tasks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeTask = (overrides?: Partial<DaoTask>): DaoTask => ({
  id: 1,
  name: "Tâche Exemple",
  progress: 0,
  isApplicable: true,
  assignedTo: [],
  lastUpdatedAt: new Date().toISOString(),
  ...overrides,
});

describe("tplDaoUpdated", () => {
  it("returns plain message and html with task changes", () => {
    const before = makeDao({
      tasks: [makeTask({ id: 1, name: "Tâche A", progress: 10 })],
    });
    const after = makeDao({
      tasks: [makeTask({ id: 1, name: "Tâche A", progress: 30 })],
    });

    const result = tplDaoUpdated({
      before,
      after,
      changedFields: ["objetDossier"],
      teamChanges: ["Alice: chef_equipe → membre_equipe"],
      taskChanges: [
        { id: 1, name: "Tâche A", changes: ["Progression 10% → 30%"] },
      ],
    } as any);

    expect(result).toBeDefined();
    expect(result.title).toContain("Mise à jour d’un DAO");
    expect(result.message).toContain("Numéro de liste");
    // html exists in return data
    expect((result as any).data?.html).toBeTruthy();
    const html: string = (result as any).data?.html;
    expect(html).toContain("Tâche A");
    expect(html).toContain("Progression 10% → 30%");
    expect(html).toContain(before.numeroListe);
  });
});
