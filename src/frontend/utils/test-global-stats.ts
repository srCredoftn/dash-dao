/**
Rôle: Utilitaires Frontend — src/frontend/utils/test-global-stats.ts
Domaine: Frontend/Utils
Exports: createTestDaos, testGlobalStatistics
Dépendances: @shared/dao
Performance: cache/partitionnement/bundling optimisés
*/
import { calculateDaoProgress, calculateDaoStatus } from "@shared/dao";
import type { Dao } from "@shared/dao";

// Créer des DAOs de test avec des valeurs de progression connues
export function createTestDaos(): Dao[] {
  const today = new Date();

  return [
    {
      id: "test-1",
      numeroListe: "TEST-2025-001",
      objetDossier: "Test DAO 1 - 100% completed",
      reference: "TEST-REF-1",
      autoriteContractante: "Test Authority 1",
      dateDepot: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 7 jours dans le futur
      equipe: [],
      tasks: [
        { id: 1, name: "Task 1", progress: 100, isApplicable: true },
        { id: 2, name: "Task 2", progress: 100, isApplicable: true },
        { id: 3, name: "Task 3", progress: 100, isApplicable: true },
        { id: 4, name: "Task 4", progress: 100, isApplicable: false }, // Non applicable
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "test-2",
      numeroListe: "TEST-2025-002",
      objetDossier: "Test DAO 2 - 50% completed",
      reference: "TEST-REF-2",
      autoriteContractante: "Test Authority 2",
      dateDepot: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 2 jours dans le futur (urgent)
      equipe: [],
      tasks: [
        { id: 1, name: "Task 1", progress: 100, isApplicable: true },
        { id: 2, name: "Task 2", progress: 0, isApplicable: true },
        { id: 3, name: "Task 3", progress: null, isApplicable: true },
        { id: 4, name: "Task 4", progress: 50, isApplicable: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "test-3",
      numeroListe: "TEST-2025-003",
      objetDossier: "Test DAO 3 - 25% completed",
      reference: "TEST-REF-3",
      autoriteContractante: "Test Authority 3",
      dateDepot: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 1 jour dans le passé (urgent)
      equipe: [],
      tasks: [
        { id: 1, name: "Task 1", progress: 50, isApplicable: true },
        { id: 2, name: "Task 2", progress: 0, isApplicable: true },
        { id: 3, name: "Task 3", progress: null, isApplicable: true },
        { id: 4, name: "Task 4", progress: null, isApplicable: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function testGlobalStatistics() {
  console.log("📊 Testing global statistics calculations...\n");

  const testDaos = createTestDaos();

  // Calculate individual progress for verification
  const dao1Progress = calculateDaoProgress(testDaos[0].tasks); // Attendu : 100%
  const dao2Progress = calculateDaoProgress(testDaos[1].tasks); // Attendu : (100+0+0+50)/4 = 37.5 → 38%
  const dao3Progress = calculateDaoProgress(testDaos[2].tasks); // Attendu : (50+0+0+0)/4 = 12.5 → 13%

  console.log(`DAO 1 progress: ${dao1Progress}% (expected: 100%)`);
  console.log(`DAO 2 progress: ${dao2Progress}% (expected: 38%)`);
  console.log(`DAO 3 progress: ${dao3Progress}% (expected: 13%)`);

  // Calculate statistics like in Index.tsx
  const activeDaos = testDaos.filter(
    (dao) => calculateDaoProgress(dao.tasks) < 100,
  );
  const completedDaos = testDaos.filter(
    (dao) => calculateDaoProgress(dao.tasks) >= 100,
  );
  const urgentDaos = testDaos.filter((dao) => {
    const status = calculateDaoStatus(
      dao.dateDepot,
      calculateDaoProgress(dao.tasks),
    );
    return status === "urgent";
  });

  const globalProgress =
    activeDaos.length > 0
      ? Math.round(
          activeDaos.reduce(
            (sum, dao) => sum + calculateDaoProgress(dao.tasks),
            0,
          ) / activeDaos.length,
        )
      : 0;

  console.log(`\nStatistics:`);
  console.log(`Total DAOs: ${testDaos.length} (expected: 3)`);
  console.log(`Active DAOs: ${activeDaos.length} (expected: 2)`);
  console.log(`Completed DAOs: ${completedDaos.length} (expected: 1)`);
  console.log(`Urgent DAOs: ${urgentDaos.length} (expected: 2)`);
  console.log(
    `Global Progress: ${globalProgress}% (expected: ${Math.round((38 + 13) / 2)}%)`,
  );

  // Verify statuses
  testDaos.forEach((dao, index) => {
    const progress = calculateDaoProgress(dao.tasks);
    const status = calculateDaoStatus(dao.dateDepot, progress);
    console.log(`DAO ${index + 1} status: ${status}`);
  });

  // Assertions
  console.assert(dao1Progress === 100, `❌ DAO 1 progress test failed`);
  console.assert(dao2Progress === 38, `❌ DAO 2 progress test failed`);
  console.assert(dao3Progress === 13, `❌ DAO 3 progress test failed`);
  console.assert(testDaos.length === 3, `❌ Total count test failed`);
  console.assert(activeDaos.length === 2, `❌ Active count test failed`);
  console.assert(completedDaos.length === 1, `❌ Completed count test failed`);
  console.assert(urgentDaos.length === 2, `❌ Urgent count test failed`);

  console.log("\n✅ Global statistics tests completed!");
}

// Export pour utilisation dans les composants
export { testGlobalStatistics as default };
