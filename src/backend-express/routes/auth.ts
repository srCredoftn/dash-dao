/**
Rôle: Route API Express — src/backend-express/routes/auth.ts
Domaine: Backend/Routes
Exports: default
Dépendances: express, zod, ../services/authService, ../services/notificationService, ../middleware/auth, ../utils/idempotency, ../utils/devLog, ../services/txEmail
Liens: services (métier), middleware (auth, validation), repositories (persistance)
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import express from "express"; // Importe le framework Express pour définir les routes HTTP
import { z } from "zod"; // Importe Zod pour valider les schémas d’entrées
import { AuthService } from "../services/authService"; // Service métier gérant l’authentification et les utilisateurs
import { NotificationService } from "../services/notificationService"; // Service de notifications internes (in-app/email)
import { authenticate, requireAdmin } from "../middleware/auth"; // Middleware pour vérifier l’authentification et le rôle administrateur
import { getIdempotency, setIdempotency } from "../utils/idempotency"; // Utilitaires pour mémoriser une requête idempotente
import { authLog, devLog } from "../utils/devLog"; // Journalisation spécifique à l’authentification et au debug
import { logger } from "../utils/logger"; // Logger centralisé pour audit/erreurs
import {
  tplLoginSuccess,
  tplNewLogin,
  tplUserDeleted,
} from "../services/notificationTemplates"; // Modèles de notifications préformatées
import type { LoginCredentials } from "@shared/dao"; // Type partagé décrivant les identifiants de connexion

const router = express.Router(); // Instancie un router Express dédié aux routes d’authentification

const loginSchema = z.object({
  email: z.string().email().max(200), // Contrainte: email valide de longueur maximale 200
  password: z.string().min(6).max(200), // Contrainte: mot de passe entre 6 et 200 caractères
});

/**
 * Analyse l'en-tête Cookie en un objet clé/valeur.
 * - Entrée: header Cookie sous forme de chaîne (peut être null/undefined)
 * - Sortie: dictionnaire { nomCookie: valeur }
 * - Note: ne gère pas les attributs (Path, HttpOnly, Secure), uniquement paires k=v
 */
function parseCookies(header?: string | null): Record<string, string> {
  const res: Record<string, string> = {}; // Prépare un objet vide pour stocker les cookies
  if (!header) return res; // Retourne immédiatement si aucun cookie n’est présent
  header.split(";").forEach((part) => {
    const idx = part.indexOf("="); // Cherche la position du séparateur clé/valeur
    if (idx > -1) {
      const k = part.slice(0, idx).trim(); // Extrait et nettoie le nom du cookie
      const v = decodeURIComponent(part.slice(idx + 1).trim()); // Décode la valeur associée
      res[k] = v; // Stocke la paire clé/valeur dans le dictionnaire
    }
  });
  return res; // Renvoie la structure clé/valeur obtenue
}

/**
 * Dépose le refresh_token dans un cookie httpOnly sécurisé.
 * - Cookie: refresh_token
 * - Secure: activé en production
 * - sameSite: strict (empêche CSRF via sites tiers)
 * - Path: limité à /api/auth/refresh
 * - maxAge: configurable via REFRESH_TTL_MS
 */
function setRefreshCookie(res: express.Response, token: string) {
  const isProd = (process.env.NODE_ENV || "development") === "production"; // Détermine si l’on tourne en production
  res.cookie("refresh_token", token, {
    httpOnly: true, // Empêche l’accès via JavaScript côté client
    secure: isProd, // Active le flag Secure en production uniquement
    sameSite: "strict", // Réduit les attaques CSRF en limitant les envois inter-sites
    path: "/api/auth/refresh", // Restreint l’utilisation du cookie à l’endpoint de rafraîchissement
    maxAge: Number(process.env.REFRESH_TTL_MS || 1000 * 60 * 60 * 24 * 7), // Définit la durée de vie du cookie (valeur env ou 7 jours)
  });
}

/**
 * Supprime le cookie httpOnly du refresh_token (rotation/fin de session).
 */
function clearRefreshCookie(res: express.Response) {
  res.cookie("refresh_token", "", {
    httpOnly: true, // Laisse le flag httpOnly pour la suppression côté client
    secure: (process.env.NODE_ENV || "development") === "production", // Conserve la même logique production
    sameSite: "strict", // Respecte les mêmes restrictions de contexte
    path: "/api/auth/refresh", // Vise le même chemin afin d’écraser le cookie
    maxAge: 0, // Définit l’expiration immédiate pour suppression
  });
}

// POST /api/auth/login - Connexion utilisateur
/**
 * POST /api/auth/login
 * Authentifie un utilisateur avec email/mot de passe.
 * Corps: { email, password }
 * Réponses:
 *  - 200: { user, token }
 *  - 400: format des identifiants invalide
 *  - 401: identifiants incorrects
 * Effets:
 *  - Crée un refresh_token httpOnly en cookie
 *  - Déclenche des notifications internes (succès de connexion)
 */
router.post("/login", async (req, res) => {
  try {
    const credentials: LoginCredentials = loginSchema.parse(req.body); // Valide et typpe les identifiants reçus

    const authResponse = await AuthService.login(credentials); // Demande au service d’authentifier l’utilisateur
    if (!authResponse) {
      return res.status(401).json({ error: "Identifiants incorrects" }); // Renvoie 401 si les identifiants sont invalides
    }

    // Crée un refresh token et le stocke dans un cookie httpOnly sécurisé
    try {
      const refresh = await AuthService.createRefreshTokenForUser(
        authResponse.user.id,
      ); // Génère un refresh token lié à l’utilisateur connecté
      setRefreshCookie(res, refresh); // Place le refresh token en cookie sécurisé
    } catch (e) {
      // Ignore les erreurs de génération de refresh token pour ne pas bloquer la connexion principale
    }

    try {
      const t = tplLoginSuccess({ userName: authResponse.user.name }); // Construit une notification de succès de connexion
      NotificationService.add({
        ...t,
        recipients: [authResponse.user.id], // Cible la notification vers l’utilisateur connecté
      });
      NotificationService.broadcast(
        t.type,
        t.title,
        `Utilisateur : ${authResponse.user.name}\nDate : ${new Date().toLocaleString("fr-FR")}`, // Message détaillant la connexion
        { email: authResponse.user.email }, // Ajoute un contexte complémentaire pour les destinataires
      );
    } catch (_) {
      // Ignore les erreurs de notification afin de ne pas bloquer la réponse principale
    }

    return res.json(authResponse); // Retourne la réponse d’authentification (token + utilisateur)
  } catch (error) {
    authLog.login(req.body?.email || "unknown", false); // Journalise la tentative échouée d’authentification
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Format des identifiants invalide" }); // Signale une erreur de validation du schéma
    }
    return res.status(401).json({ error: "Identifiants incorrects" }); // Par défaut, renvoie un échec d’authentification
  }
});

// POST /api/auth/refresh - Rafraîchir le jeton d’accès via cookie httpOnly
/**
 * POST /api/auth/refresh
 * Rafraîchit le token d'accès via le cookie httpOnly refresh_token.
 * Réponses:
 *  - 200: { token, user }
 *  - 401: absence/invalidité du refresh token
 * Effets:
 *  - Rotation du refresh_token (défense contre le vol de token)
 */
router.post("/refresh", async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie || ""); // Analyse les cookies reçus depuis l’en-tête
    const refreshToken = cookies["refresh_token"]; // Récupère la valeur du refresh token
    if (!refreshToken)
      return res.status(401).json({ error: "Aucun jeton de rafraîchissement" }); // Refuse si le cookie est absent

    const refreshed = await AuthService.refreshSession(refreshToken); // Demande une session rafraîchie au service
    if (!refreshed)
      return res
        .status(401)
        .json({ error: "Jeton de rafraîchissement invalide" }); // Refuse si le token n’est pas valide

    // Rotation du cookie
    try {
      const newRefresh = await AuthService.createRefreshTokenForUser(
        refreshed.user.id,
      ); // Génère un nouveau refresh token pour rotation
      setRefreshCookie(res, newRefresh); // Remplace le cookie existant par la nouvelle valeur
    } catch {
      // Ignore les erreurs de rotation pour ne pas bloquer l’émission du token d’accès
    }

    return res.json({ token: refreshed.token, user: refreshed.user }); // Retourne la session rafraîchie au client
  } catch (e) {
    return res.status(401).json({ error: "Impossible de rafraîchir le jeton" }); // Réponse générique en cas d’exception
  }
});

// POST /api/auth/logout - Déconnexion de l’utilisateur
/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur courant.
 * - Invalide le token d'accès et le refresh_token (cookie vidé)
 * - Ajoute une notification "Déconnexion" pour l'utilisateur
 */
router.post("/logout", authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization; // Récupère l’en-tête Authorization
    const token = authHeader?.substring(7); // Extrait le JWT bearer (supprime "Bearer ")

    const cookies = parseCookies(req.headers.cookie || ""); // Analyse les cookies pour récupérer le refresh token
    const refreshToken = cookies["refresh_token"]; // Identifie le token de rafraîchissement actuel

    await AuthService.logout(token || "", refreshToken); // Invalide les jetons côté service d’authentification
    clearRefreshCookie(res); // Supprime le cookie sur la réponse

    try {
      NotificationService.add({
        type: "system", // Type de notification générique
        title: "Déconnexion", // Titre affiché dans le centre de notifications
        message: `Vous vous êtes déconnecté(e) le ${new Date().toLocaleString("fr-FR")}`, // Message d’information temporelle
        data: {}, // Pas de données additionnelles
        recipients: [req.user!.id], // Notifie l’utilisateur courant
      });
    } catch {
      // Ignore les erreurs de notification pour ne pas bloquer la déconnexion
    }

    return res.json({ message: "Déconnexion réussie" }); // Confirme la déconnexion au client
  } catch (error) {
    devLog.error("Logout error:", error); // Journalise l’erreur de déconnexion
    return res.status(500).json({ error: "Échec de la déconnexion" }); // Répond avec une erreur serveur
  }
});

// GET /api/auth/me - Récupérer les informations utilisateur courantes
/**
 * GET /api/auth/me
 * Retourne les informations de l'utilisateur courant (via authenticate).
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    return res.json({ user: req.user }); // Retourne l’utilisateur injecté par le middleware
  } catch (error) {
    devLog.error("Get user info error:", error); // Journalise tout incident lors de la récupération
    return res
      .status(500)
      .json({ error: "Échec de récupération des informations utilisateur" }); // Indique un problème serveur
  }
});

// GET /api/auth/users - Récupérer tous les utilisateurs (admin uniquement)
/**
 * GET /api/auth/users (admin)
 * Liste tous les utilisateurs avec un indicateur isSuperAdmin.
 */
router.get("/users", authenticate, requireAdmin, async (_req, res) => {
  try {
    const users = await AuthService.getAllUsers(); // Récupère la liste complète des utilisateurs
    const sa = AuthService.getSuperAdmin(); // Identifie le super administrateur configuré
    const withFlag = users.map((u) => ({
      ...u,
      isSuperAdmin: sa ? sa.id === u.id : false, // Marque si l’utilisateur correspond au super admin
    }));
    return res.json(withFlag); // Retourne la liste annotée
  } catch (error) {
    devLog.error("Get users error:", error); // Journalise l’erreur
    return res
      .status(500)
      .json({ error: "Échec de récupération des utilisateurs" }); // Répond par un message serveur
  }
});

// Point d’inscription publique — autorise le premier utilisateur à s’auto-inscrire lorsqu’aucun utilisateur n’existe, ou si ALLOW_SELF_REGISTER=true
/**
 * POST /api/auth/register
 * Inscription publique conditionnelle.
 * - Autorisée si aucun utilisateur n'existe ou si ALLOW_SELF_REGISTER=true
 * - Crée le premier utilisateur en admin, sinon en user
 * - Auto-login après création pour UX simplifiée
 */
router.post("/register", async (req, res) => {
  try {
    const allowSelf =
      (process.env.ALLOW_SELF_REGISTER || "false").toLowerCase() === "true"; // Vérifie la configuration d’auto-inscription

    const existing = await AuthService.getAllUsers(); // Liste les utilisateurs existants pour déterminer le contexte

    if (existing.length > 0 && !allowSelf) {
      return res.status(403).json({ error: "Inscription désactivée" }); // Refuse si des utilisateurs existent déjà sans autorisation explicite
    }

    const { name, email, password } = req.body; // Extrait les données fournies dans la requête
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Nom, email et mot de passe requis" }); // Exige tous les champs
    }

    const role = existing.length === 0 ? ("admin" as any) : ("user" as any); // Attribue admin au premier utilisateur sinon role user

    const newUser = await AuthService.createUser({
      name,
      email,
      role,
      password,
    }); // Crée l’utilisateur via le service métier

    // Notifier l’utilisateur créé de se connecter et de changer son mot de passe (aucun mot de passe dans la notification)
    try {
      const t = tplNewLogin({ userName: newUser.name }); // Prépare une notification de bienvenue
      NotificationService.add({ ...t, recipients: [newUser.id] }); // Ajoute la notification dans la file interne
    } catch {
      // Ignore les erreurs de notification pour ne pas bloquer l’inscription
    }

    // Connexion automatique du nouvel utilisateur
    const authResp = await AuthService.login({ email, password }); // Connecte l’utilisateur fraîchement créé

    // Diffusion de la création (ne pas inclure de données sensibles dans les logs)
    try {
      NotificationService.broadcast(
        "user_created",
        "Nouvel utilisateur",
        "Un nouvel utilisateur a été créé",
        { userId: newUser.id }, // Fournit l’ID pour contextualiser
      );
    } catch (_) {
      // Ignore les erreurs de diffusion pour poursuivre
    }

    logger.audit("Utilisateur créé avec succès", req.user?.id, req.ip); // Trace l’événement dans les journaux d’audit

    return res.status(201).json({ user: newUser, token: authResp?.token }); // Retourne l’utilisateur et le token éventuel
  } catch (error: any) {
    logger.error("Échec d'inscription", "AUTH_REGISTER", {
      message: String((error as Error)?.message), // Logue le message d’erreur pour diagnostic
    });
    return res
      .status(500)
      .json({ error: error?.message || "Échec d'inscription" }); // Répond par une erreur serveur générique
  }
});

// POST /api/auth/users - Créer un nouvel utilisateur (admin uniquement)
/**
 * POST /api/auth/users (admin)
 * Crée un utilisateur (idempotent via header x-idempotency-key).
 * Corps: { name, email, role, password }
 * Effets:
 *  - Notification de nouvel utilisateur
 *  - Journalisation d'audit
 */
router.post("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const idempKey = (req.header("x-idempotency-key") || "").trim(); // Lit l’éventuelle clé d’idempotence fournie
    if (idempKey) {
      const cached = getIdempotency(idempKey); // Cherche une réponse déjà mise en cache
      if (cached) return res.status(201).json(cached); // Réutilise la réponse précédente si présente
    }

    const userData = req.body; // Récupère le payload de création utilisateur

    if (!userData.name || !userData.email || !userData.role) {
      return res.status(400).json({ error: "Nom, email et rôle requis" }); // Vérifie la présence des champs essentiels
    }

    const newUser = await AuthService.createUser({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      password: userData.password, // Transmet le mot de passe au service pour hachage et stockage
    }); // Délègue la création au service métier

    if (idempKey) setIdempotency(idempKey, newUser); // Mémorise le résultat pour des appels répétés

    // Notifier l’utilisateur créé de se connecter et de changer son mot de passe (aucun mot de passe dans la notification)
    try {
      const t = tplNewLogin({ userName: newUser.name }); // Prépare la notification de création
      NotificationService.add({ ...t, recipients: [newUser.id] }); // Ajoute la notification ciblée
    } catch {
      // Ignore les erreurs de notification pour garantir la création utilisateur
    }

    try {
      NotificationService.broadcast(
        "user_created",
        "Nouvel utilisateur",
        `${newUser.name} (${newUser.email}) a été créé`,
        { userId: newUser.id }, // Communique l’identifiant du nouvel utilisateur
      );
    } catch (_) {
      // Ignore les erreurs de diffusion entre services
    }

    logger.audit("Utilisateur créé avec succès", req.user?.id, req.ip); // Journalise l’action dans l’audit
    return res.status(201).json(newUser); // Retourne l’utilisateur créé
  } catch (error) {
    logger.error("Échec de création de l’utilisateur", "USER_CREATE", {
      message: String((error as Error)?.message), // Enregistre le message d’échec
    });
    return res
      .status(500)
      .json({ error: "Échec de création de l’utilisateur" }); // Réponse d’erreur serveur
  }
});

// PUT /api/auth/users/:id/role - Mettre à jour le rôle utilisateur (admin super)
/**
 * PUT /api/auth/users/:id/role (super admin)
 * Met à jour le rôle d'un utilisateur.
 * Contraintes:
 *  - Doit être super admin
 *  - Validation du mot de passe courant requise
 * Effets: Notification broadcast du changement de rôle
 */
router.put("/users/:id/role", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; // Récupère l’identifiant utilisateur ciblé
    const { role, password } = req.body || {}; // Extrait le nouveau rôle et la confirmation du mot de passe

    if (!role) {
      return res.status(400).json({ error: "Le rôle est requis" }); // Empêche une mise à jour sans rôle
    }

    // Seul le super administrateur peut changer les rôles et doit confirmer avec son mot de passe courant
    if (!req.user || !AuthService.isSuperAdmin(req.user.id)) {
      return res
        .status(403)
        .json({ error: "Interdit : super administrateur requis" }); // Bloque si l’utilisateur courant n’est pas super admin
    }
    const valid = await AuthService.verifyPasswordById(
      req.user.id,
      String(password || ""),
    ); // Vérifie le mot de passe du super admin
    if (!valid) {
      return res
        .status(403)
        .json({ error: "Mot de passe invalide", code: "INVALID_PASSWORD" }); // Refuse en cas de mot de passe incorrect
    }

    const updatedUser = await AuthService.updateUserRole(id, role); // Met à jour le rôle via le service
    if (!updatedUser) {
      return res.status(404).json({ error: "Utilisateur introuvable" }); // Renvoie 404 si l’utilisateur n’existe pas
    }

    // Diffusion d’une notification à tous les utilisateurs (miroir e-mail géré en interne)
    NotificationService.broadcast(
      "role_update",
      "Mise à jour du rôle utilisateur",
      `${updatedUser.name} a maintenant le rôle "${role}"`,
      { userId: updatedUser.id, newRole: role }, // Ajoute les informations utiles pour les auditeurs
    );

    return res.json(updatedUser); // Retourne l’utilisateur mis à jour
  } catch (error) {
    logger.error("Échec de mise à jour du rôle utilisateur", "USER_ROLE", {
      message: String((error as Error)?.message), // Trace l’erreur
    });
    return res
      .status(500)
      .json({ error: "Échec de mise à jour du rôle utilisateur" }); // Répond avec une erreur serveur
  }
});

// DELETE /api/auth/users/:id - Supprimer ou désactiver un utilisateur (super admin)
/**
 * DELETE /api/auth/users/:id (super admin)
 * Désactive ou supprime un utilisateur (mode hard via ?hard=true ou body.mode="hard").
 * Garde-fous:
 *  - Impossible de se désactiver soi-même
 *  - Super admin + mot de passe requis
 * Effets: Notifications et audit
 */
router.delete("/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; // Identifiant de l’utilisateur cible

    // Empêcher un admin de se désactiver lui-même
    if (req.user?.id === id) {
      return res
        .status(400)
        .json({ error: "Impossible de désactiver votre propre compte" }); // Bloque l’auto-suppression
    }

    // Seul le super administrateur peut désactiver des utilisateurs et doit confirmer avec son mot de passe courant
    if (!req.user || !AuthService.isSuperAdmin(req.user.id)) {
      return res
        .status(403)
        .json({ error: "Interdit : super administrateur requis" }); // Vérifie le statut super admin
    }

    const pwd = (req.body?.password || "").toString(); // Extrait le mot de passe de confirmation
    if (!pwd) {
      return res.status(400).json({ error: "Le mot de passe est requis" }); // Exige une confirmation de mot de passe
    }
    const valid = await AuthService.verifyPasswordById(req.user.id, pwd); // Vérifie le mot de passe fourni
    if (!valid) {
      return res
        .status(403)
        .json({ error: "Mot de passe invalide", code: "INVALID_PASSWORD" }); // Refuse si la vérification échoue
    }

    const hard =
      String(req.query?.hard || req.body?.hard || "").toLowerCase() ===
        "true" || String(req.body?.mode || "").toLowerCase() === "hard"; // Détermine si la suppression doit être définitive

    const usersBefore = await AuthService.getAllUsers(); // Récupère les utilisateurs pour journaliser/construire la notification
    const target = usersBefore.find((u) => u.id === id); // Cherche les informations de l’utilisateur cible

    if (hard) {
      const deleted = await AuthService.deleteUser(id); // Procède à la suppression définitive
      if (!deleted) {
        return res.status(404).json({ error: "Utilisateur introuvable" }); // Signale si l’utilisateur n’a pas été trouvé
      }

      try {
        const t = tplUserDeleted({
          deletedUserName: target ? target.name : `Utilisateur ${id}`, // Personnalise le message selon les données
          actorName: req.user?.name || "Admin", // Indique qui a réalisé l’action
        });
        NotificationService.broadcast(t.type, t.title, t.message, {
          userId: id, // Fournit l’identifiant supprimé pour suivi
        });
      } catch (_) {
        // Ignore les erreurs de diffusion pour ne pas bloquer la réponse
      }

      logger.audit(
        "Utilisateur supprimé définitivement",
        req.user?.id,
        req.ip,
        { userId: id }, // Journalise l’action dans l’audit avec contexte
      );

      return res.json({ message: "Utilisateur supprimé avec succès" }); // Confirme la suppression
    } else {
      const deactivated = await AuthService.deactivateUser(id); // Procède à la désactivation (soft delete)
      if (!deactivated) {
        return res.status(404).json({ error: "Utilisateur introuvable" }); // Signale l’absence de l’utilisateur
      }

      try {
        NotificationService.broadcast(
          "system",
          "Utilisateur désactivé",
          `${target ? `${target.name} (${target.email})` : `Utilisateur ${id}`} a été désactivé`,
          { userId: id }, // Indique l’utilisateur concerné
        );
      } catch (_) {
        // Ignore les erreurs de notification pour ne pas bloquer la désactivation
      }

      return res.json({ message: "Utilisateur désactivé avec succès" }); // Confirme la désactivation
    }
  } catch (error) {
    devLog.error("Deactivate user error:", error); // Journalise l’échec de la procédure
    return res
      .status(500)
      .json({ error: "Échec de désactivation de l’utilisateur" }); // Répond par une erreur serveur
  }
});

// POST /api/auth/change-password - Modifier le mot de passe
/**
 * POST /api/auth/change-password
 * Change le mot de passe de l'utilisateur courant.
 * Règles: longueur minimale 6 caractères.
 */
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { newPassword } = req.body; // Récupère le nouveau mot de passe proposé

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Le mot de passe doit contenir au moins 6 caractères" }); // Valide la longueur minimale
    }

    const success = await AuthService.changePassword(req.user!.id, newPassword); // Dél��gue la modification au service
    if (!success) {
      return res.status(404).json({ error: "Utilisateur introuvable" }); // Renvoie 404 si l’utilisateur n’existe plus
    }

    try {
      NotificationService.add({
        type: "system",
        title: "Mot de passe modifié",
        message: `Votre mot de passe a été modifié le ${new Date().toLocaleString("fr-FR")}.`, // Informe l’utilisateur de la modification
        data: {},
        recipients: [req.user!.id], // Limite la notification à l’utilisateur courant
      });
      // Diffusion globale
      NotificationService.broadcast(
        "system",
        "Mot de passe modifié",
        `${req.user!.name} a modifié son mot de passe`,
        { userId: req.user!.id },
      );
    } catch (_) {
      // Ignore les erreurs de notification pour ne pas bloquer la réponse
    }

    return res.json({ message: "Mot de passe modifié avec succès" }); // Confirme la mise à jour au client
  } catch (error) {
    devLog.error("Change password error:", error); // Journalise toute erreur rencontrée
    return res
      .status(500)
      .json({ error: "Échec de modification du mot de passe" }); // Signale l’échec au client
  }
});

// PUT /api/auth/profile - Mettre à jour le profil utilisateur
/**
 * PUT /api/auth/profile
 * Met à jour le profil (nom). Changement d'email interdit pour tous.
 */
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body || {}; // Extrait les champs envoyés

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Le nom est requis" }); // Valide la présence d’un nom exploitable
    }

    // Si le client tente de changer l’email, rejeter explicitement
    if (email && email.toLowerCase() !== req.user!.email.toLowerCase()) {
      return res
        .status(403)
        .json({ error: "Le changement d’email n’est pas autorisé" }); // Interdit la modification d’email
    }

    const updatedUser = await AuthService.updateProfile(req.user!.id, {
      name,
      email: req.user!.email,
    }); // Met à jour uniquement le nom en conservant l’email existant
    if (!updatedUser) {
      return res.status(404).json({ error: "Utilisateur introuvable" }); // Signale l’absence d’utilisateur
    }

    const authUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    }; // Construit une réponse restreinte aux champs nécessaires côté client

    return res.json(authUser); // Retourne le profil mis à jour
  } catch (error) {
    devLog.error("Update profile error:", error); // Journalise l’erreur éventuelle
    if ((error as Error).message === "Email change not allowed") {
      return res
        .status(403)
        .json({ error: "Le changement d’email n’est pas autorisé" }); // Harmonise le message avec les règles métier
    }
    if ((error as Error).message === "Email already exists") {
      return res.status(400).json({ error: "Email déjà utilisé" }); // Traite le conflit d’email existant côté service
    }
    return res.status(500).json({ error: "Échec de mise à jour du profil" }); // Répond par une erreur serveur générique
  }
});

// POST /api/auth/forgot-password - Demander une réinitialisation de mot de passe
/**
 * POST /api/auth/forgot-password
 * Déclenche un code de réinitialisation pour l'email fourni.
 * Sécurité: ne révèle pas si l'email existe (réponse générique OK).
 * Dev: renvoie le code dans la réponse hors production.
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body; // Extrait l’email cible depuis la requête

    if (!email) {
      return res.status(400).json({ error: "L’email est requis" }); // Vérifie que l’email est présent
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Format d’email invalide" }); // Valide rapidement le format de l’email
    }

    const token = await AuthService.generateResetToken(email); // Demande un code de réinitialisation au service

    if (!token) {
      // Ne pas révéler si l’email existe ou non pour des raisons de sécurité
      return res.json({
        message:
          "Si cet email existe, un code de réinitialisation a été envoyé.",
      }); // Message neutre pour éviter l’énumération d’utilisateurs
    }

    const response: any = {
      message:
        "Un code de réinitialisation a été envoyé à votre adresse email.",
    }; // Prépare la réponse standard
    if (process.env.NODE_ENV !== "production") {
      response.developmentToken = token; // Expose le code en environnement de développement pour faciliter les tests
    }

    return res.json(response); // Renvoie la réponse adaptée au contexte
  } catch (error) {
    devLog.error("Forgot password error:", error); // Journalise l’erreur rencontrée
    return res
      .status(500)
      .json({ error: "Échec du traitement de la demande de réinitialisation" }); // Informe le client de l’échec
  }
});

// POST /api/auth/verify-reset-token - Vérifier le code de réinitialisation
/**
 * POST /api/auth/verify-reset-token
 * Vérifie la validité d'un code de réinitialisation.
 */
router.post("/verify-reset-token", async (req, res) => {
  try {
    const { email, token } = req.body; // Récupère l’email et le code soumis

    if (!email || !token) {
      return res.status(400).json({ error: "Email et code requis" }); // Exige les deux champs
    }

    const isValid = await AuthService.verifyResetToken(token, email); // Vérifie la correspondance du code côté service

    if (!isValid) {
      return res.status(400).json({ error: "Code invalide ou expiré" }); // Signale un code invalide
    }

    return res.json({ message: "Code vérifié avec succès" }); // Confirme la validité du code
  } catch (error) {
    devLog.error("Verify reset token error:", error); // Journalise l’erreur de vérification
    return res.status(500).json({ error: "Échec de vérification du code" }); // Répond par une erreur serveur
  }
});

// POST /api/auth/reset-password - Réinitialiser le mot de passe avec un code
/**
 * POST /api/auth/reset-password
 * Réinitialise le mot de passe avec email + code valide.
 * Règles: mot de passe ≥ 6 caractères.
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body; // Récupère les informations nécessaires à la réinitialisation

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        error: "Email, code et nouveau mot de passe requis",
      }); // Vérifie la présence de toutes les données
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 6 caractères",
      }); // Impose une longueur minimale cohérente
    }

    const success = await AuthService.resetPasswordWithToken(
      token,
      email,
      newPassword,
    ); // Demande la réinitialisation au service métier

    if (!success) {
      return res.status(400).json({ error: "Code invalide ou expiré" }); // Indique un échec de validation du code
    }

    return res.json({ message: "Mot de passe réinitialisé avec succès" }); // Confirme la réinitialisation
  } catch (error) {
    devLog.error("Reset password error:", error); // Journalise l’échec rencontré
    return res
      .status(500)
      .json({ error: "Échec de réinitialisation du mot de passe" }); // Répond par une erreur serveur générique
  }
});

export default router; // Exporte le router configuré pour être monté dans l’application Express
