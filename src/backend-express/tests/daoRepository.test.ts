/**
Rôle: Entrée/Bootstrap backend — src/backend-express/tests/daoRepository.test.ts
Domaine: Backend/Core
Dépendances: vitest, @shared/dao, ../repositories/memoryDaoRepository
Performance: cache/partitionnement/bundling optimisés
*/
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Dao } from "@shared/dao";
import { MemoryDaoRepository } from "../repositories/memoryDaoRepository";

function sampleDao(overrides: Partial<Dao> = {}): Dao {
  const now = new Date().toISOString();
  return {
    id: String(Date.now() + Math.random()),
    numeroListe: "DAO-2099-001",
    objetDossier: "Test",
    reference: "REF-1",
    autoriteContractante: "Test Org",
    dateDepot: now,
    equipe: [],
    tasks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("MemoryDaoRepository", () => {
  let repo: MemoryDaoRepository;

  beforeEach(() => {
    repo = new MemoryDaoRepository();
  });

  it("creates, reads, updates and deletes DAOs", async () => {
    const created = await repo.insert(
      sampleDao({ numeroListe: "DAO-2099-010" }),
    );
    expect(created.id).toBeTruthy();

    const fetched = await repo.findById(created.id);
    expect(fetched?.numeroListe).toBe("DAO-2099-010");

    const updated = await repo.update(created.id, { objetDossier: "Updated" });
    expect(updated?.objetDossier).toBe("Updated");

    const all = await repo.findAll();
    expect(all.length).toBeGreaterThan(0);

    const ok = await repo.deleteById(created.id);
    expect(ok).toBe(true);
    const after = await repo.findById(created.id);
    expect(after).toBeNull();
  });

  it("paginates and filters", async () => {
    await repo.deleteAll();
    await repo.insert(
      sampleDao({ numeroListe: "DAO-2099-001", autoriteContractante: "A" }),
    );
    await repo.insert(
      sampleDao({ numeroListe: "DAO-2099-002", autoriteContractante: "B" }),
    );
    await repo.insert(
      sampleDao({ numeroListe: "DAO-2099-003", autoriteContractante: "A" }),
    );

    const { items, total } = await repo.findAndPaginate({
      autorite: "A",
      page: 1,
      pageSize: 10,
    });
    expect(total).toBe(2);
    expect(items.every((d) => d.autoriteContractante === "A")).toBe(true);
  });
});

describe("DaoService with USE_MONGO toggle", () => {
  it("uses in-memory when USE_MONGO=false", async () => {
    process.env.USE_MONGO = "false";
    const { DaoService } = await import("../services/daoService");

    const before = await DaoService.getAllDaos();
    const created = await DaoService.createDao({
      numeroListe: "SHOULD_BE_OVERRIDDEN",
      objetDossier: "OBJ",
      reference: "REF",
      autoriteContractante: "X",
      dateDepot: new Date().toISOString(),
      equipe: [],
      tasks: [],
    } as any);
    expect(created.numeroListe.startsWith("DAO-")).toBe(true);

    const after = await DaoService.getAllDaos();
    expect(after.length).toBeGreaterThanOrEqual(before.length + 1);
  });

  it("falls back to memory when USE_MONGO=true but connection fails", async () => {
    process.env.USE_MONGO = "true";
    vi.resetModules();
    vi.mock("../config/database", () => ({
      connectToDatabase: vi.fn(async () => {
        throw new Error("no mongo");
      }),
    }));

    const { DaoService } = await import("../services/daoService");

    const created = await DaoService.createDao({
      numeroListe: "SHOULD_BE_OVERRIDDEN",
      objetDossier: "OBJ",
      reference: "REF",
      autoriteContractante: "Y",
      dateDepot: new Date().toISOString(),
      equipe: [],
      tasks: [],
    } as any);
    expect(created.id).toBeTruthy();
  });
});
