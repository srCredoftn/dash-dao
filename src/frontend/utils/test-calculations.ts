/**
Rôle: Utilitaires Frontend — src/frontend/utils/test-calculations.ts
Domaine: Frontend/Utils
Exports: testProgressCalculations
Dépendances: @shared/dao
Performance: cache/partitionnement/bundling optimisés
*/
import { calculateDaoProgress, calculateDaoStatus } from "@shared/dao";
import type { DaoTask } from "@shared/dao";

// Données de test
const testTasks: DaoTask[] = [
  { id: 1, name: "Task 1", progress: 100, isApplicable: true },
  { id: 2, name: "Task 2", progress: 50, isApplicable: true },
  { id: 3, name: "Task 3", progress: null, isApplicable: true },
  { id: 4, name: "Task 4", progress: 75, isApplicable: false }, // Non applicable
  { id: 5, name: "Task 5", progress: 0, isApplicable: true },
];

// Fonctions de test
export function testProgressCalculations() {
  console.log("🧪 Testing DAO progress calculations...\n");

  // Test 1 : Calcul de progression avec un mélange de tâches
  const progress1 = calculateDaoProgress(testTasks);
  const expectedProgress1 = Math.round((100 + 50 + 0 + 0) / 4); // Uniquement les tâches applicables : 150/4 = 37.5 → 38
  console.log(
    `✅ Test 1 - Mixed tasks: ${progress1}% (expected: ${expectedProgress1}%)`,
  );
  console.assert(
    progress1 === expectedProgress1,
    `❌ Test 1 failed: got ${progress1}, expected ${expectedProgress1}`,
  );

  // Test 2 : Toutes les tâches complétées
  const completedTasks: DaoTask[] = [
    { id: 1, name: "Task 1", progress: 100, isApplicable: true },
    { id: 2, name: "Task 2", progress: 100, isApplicable: true },
    { id: 3, name: "Task 3", progress: 100, isApplicable: true },
  ];
  const progress2 = calculateDaoProgress(completedTasks);
  console.log(`✅ Test 2 - All completed: ${progress2}% (expected: 100%)`);
  console.assert(
    progress2 === 100,
    `❌ Test 2 failed: got ${progress2}, expected 100`,
  );

  // Test 3 : Aucune tâche applicable
  const noApplicableTasks: DaoTask[] = [
    { id: 1, name: "Task 1", progress: 100, isApplicable: false },
    { id: 2, name: "Task 2", progress: 50, isApplicable: false },
  ];
  const progress3 = calculateDaoProgress(noApplicableTasks);
  console.log(`✅ Test 3 - No applicable tasks: ${progress3}% (expected: 0%)`);
  console.assert(
    progress3 === 0,
    `❌ Test 3 failed: got ${progress3}, expected 0`,
  );

  // Test 4 : Toutes les progressions sont nulles
  const nullProgressTasks: DaoTask[] = [
    { id: 1, name: "Task 1", progress: null, isApplicable: true },
    { id: 2, name: "Task 2", progress: null, isApplicable: true },
  ];
  const progress4 = calculateDaoProgress(nullProgressTasks);
  console.log(`✅ Test 4 - All null progress: ${progress4}% (expected: 0%)`);
  console.assert(
    progress4 === 0,
    `❌ Test 4 failed: got ${progress4}, expected 0`,
  );

  console.log("\n🎯 Testing DAO status calculations...\n");

  // Test 5 : Calculs de dates
  const today = new Date();

  // Date future (7 jours) - devrait être safe/vert
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 7);
  const status5 = calculateDaoStatus(
    futureDate.toISOString().split("T")[0],
    50,
  );
  console.log(`✅ Test 5 - Future date (7 days): ${status5} (expected: safe)`);
  console.assert(
    status5 === "safe",
    `❌ Test 5 failed: got ${status5}, expected safe`,
  );

  // Date passée - devrait être urgente/rouge
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 1);
  const status6 = calculateDaoStatus(pastDate.toISOString().split("T")[0], 50);
  console.log(`✅ Test 6 - Past date: ${status6} (expected: urgent)`);
  console.assert(
    status6 === "urgent",
    `❌ Test 6 failed: got ${status6}, expected urgent`,
  );

  // Proche futur (2 jours) - devrait être urgent/rouge
  const nearDate = new Date(today);
  nearDate.setDate(today.getDate() + 2);
  const status7 = calculateDaoStatus(nearDate.toISOString().split("T")[0], 50);
  console.log(`✅ Test 7 - Near date (2 days): ${status7} (expected: urgent)`);
  console.assert(
    status7 === "urgent",
    `❌ Test 7 failed: got ${status7}, expected urgent`,
  );

  // 100% complété - devrait toujours être 'completed' (gris)
  const status8 = calculateDaoStatus(pastDate.toISOString().split("T")[0], 100);
  console.log(
    `✅ Test 8 - 100% completed (past date): ${status8} (expected: completed)`,
  );
  console.assert(
    status8 === "completed",
    `❌ Test 8 failed: got ${status8}, expected completed`,
  );

  console.log("\n✅ All tests completed!");
}

// Run tests automatically when imported
if (typeof window !== "undefined") {
  // Ne s'exécute que dans un environnement navigateur
  setTimeout(() => {
    testProgressCalculations();
  }, 1000);
}
