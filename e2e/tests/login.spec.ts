/**
Rôle: Module TypeScript — e2e/tests/login.spec.ts
Domaine: Général
Dépendances: @playwright/test
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@2snd.fr";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/");
  await expect(page).toHaveURL(/\/$/);
}

test("login and create DAO via API then verify in UI", async ({
  page,
  request,
}) => {
  await login(page);
  // Grab token from localStorage
  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  expect(token).toBeTruthy();

  // Create DAO via API
  const numero = `E2E-${Date.now()}`;
  const resp = await request.post("/api/dao", {
    data: {
      numeroListe: numero,
      objetDossier: "E2E Playwright",
      reference: "e2e-ref",
      autoriteContractante: "E2E",
      dateDepot: new Date().toISOString(),
      equipe: [],
      tasks: [],
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok()).toBeTruthy();

  // Go to home and verify DAO appears
  await page.goto("/");
  await expect(page.getByText(numero)).toBeVisible();
});
