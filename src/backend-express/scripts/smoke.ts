/**
Rôle: Entrée/Bootstrap backend — src/backend-express/scripts/smoke.ts
Domaine: Backend/Core
Dépendances: ../services/authService, ../services/txEmail, ../data/daoStorage, ../services/notificationService
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { AuthService } from "../services/authService";
import { sendEmail } from "../services/txEmail";
import { daoStorage } from "../data/daoStorage";
import { NotificationService } from "../services/notificationService";

async function run() {
  try {
    console.log("Démarrage des tests smoke...");

    // S’assurer que AuthService est initialisé
    await AuthService.initialize();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.warn(
        "ADMIN_EMAIL ou ADMIN_PASSWORD non définis - tests d'auth ignorés",
      );
    } else {
      console.log("Tentative de connexion admin...");
      const authResp = await AuthService.login({
        email: adminEmail,
        password: adminPassword,
      });
      if (!authResp) throw new Error("Échec de la connexion");
      console.log("Connexion OK, longueur du token :", authResp.token.length);

      const verified = await AuthService.verifyToken(authResp.token);
      if (!verified) throw new Error("Échec de vérification du token");
      console.log("Token vérifié");

      // Test de /me via le service
      await AuthService.getCurrentUser(authResp.token);
      console.log("AuthService.getCurrentUser returned user context");

      // Utiliser l’admin pour lancer un reset via les services
      console.log("Exécution du nettoyage runtime via les services...");
      daoStorage.clearAll(false);
      NotificationService.clearAll();
      await AuthService.clearAllSessions();
      await AuthService.reinitializeUsers();
      console.log("Nettoyage runtime exécuté");
    }

    // Vérification du stockage DAO
    console.log("Taille du stockage DAO :", daoStorage.size());

    // Test d’email (non bloquant)
    try {
      await sendEmail(
        adminEmail || "no-reply@example.com",
        "Test de fumée",
        "Si vous recevez ceci, le chemin d'envoi d'email fonctionne.",
        "SYSTEM_TEST",
      );
      console.log("Tentative d'envoi d'email effectuée");
    } catch (e) {
      console.warn("Test d'email échoué :", (e as Error).message);
    }

    console.log("Tests smoke terminés avec succès");
    process.exit(0);
  } catch (e) {
    console.error("Échec des tests smoke :", (e as Error).message);
    process.exit(2);
  }
}

run();
