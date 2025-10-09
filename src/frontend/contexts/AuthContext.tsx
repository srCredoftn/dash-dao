import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
/**
 * Contexte d’authentification
 * Rôle: exposer l’état utilisateur (user), les actions (login/logout) et des aides (rôles).
 * Persistance: par onglet via auth-storage, avec vérification serveur.
 */
import { authService } from "@/services/authService";
import "@/utils/auth-cleanup"; // Outils de nettoyage/débogage auth (sans effet en prod)
import type { AuthUser, LoginCredentials, UserRole } from "@shared/dao";
import { devLog } from "@/utils/devLogger";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  canEdit: () => boolean;
}

// Contexte interne (undefined hors Provider pour repérer un usage invalide)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    devLog.error("useAuth appelé en dehors d’AuthProvider");
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // État utilisateur courant (null si non authentifié)
  const [user, setUser] = useState<AuthUser | null>(null);
  // Indique si une opération d’initialisation/auth est en cours
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthCleared(() => {
      setUser(null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Au montage: tentative de restauration de session
  useEffect(() => {
    initializeAuth();
  }, []);

  // Routine d’initialisation: restaure depuis le stockage puis vérifie auprès du serveur
  const initializeAuth = async () => {
    /*
      Étapes principales:
      1) Récupérer les données locales (user + token) pour un démarrage rapide (UX)
      2) Vérifier un bootId serveur pour invalider les sessions obsolètes après redéploiement
      3) Interroger le serveur pour valider le token et récupérer l'utilisateur courant
      4) En cas d'erreur réseau, conserver l'utilisateur en cache et retenter plus tard
      5) En cas de jeton invalide, purger proprement les données locales

      Les devLogs entourent chaque étape pour faciliter le debug en environnement dev.
    */
    try {
      setIsLoading(true);

      // 1) Lecture des infos stockées localement (par onglet)
      const storedUser = authService.getStoredUser();
      const token = authService.getToken();

      devLog.log("🔄 Initialisation de l’auth...");
      devLog.log("📦 Utilisateur stocké:", storedUser?.email || "aucun");
      devLog.log("🔑 Jeton présent:", !!token);

      if (storedUser && token) {
        try {
          // 2) Vérification de cohérence du boot côté serveur pour éviter les jetons périmés entre redéploiements
          devLog.log(
            "✅ Vérification du bootId côté serveur avant la vérification du jeton...",
          );
          const BOOT_KEY = "boot_id_v1";
          try {
            const bootRes = await fetch("/api/boot", {
              headers: { Accept: "application/json" },
            });
            if (bootRes.ok) {
              const bootData: { bootId?: string } = await bootRes.json();
              const serverBootId = String(bootData.bootId || "dev");
              const storedBootId = localStorage.getItem(BOOT_KEY);
              // Si le bootId diffère, purge locale pour forcer une reconnexion propre
              if (!storedBootId || storedBootId !== serverBootId) {
                devLog.info(
                  "🔄 BootId différent — purge des données locales pour éviter une vérification invalide",
                );
                authService.clearAuth();
                localStorage.setItem(BOOT_KEY, serverBootId);
                setUser(null);
                setIsLoading(false);
                return;
              }
            } else {
              devLog.warn(
                "⚠️ L’endpoint /boot n’a pas répondu OK — on poursuit la vérification du jeton",
              );
            }
          } catch (bootErr) {
            // Erreur réseau sur /boot: on continue (d’autres garde-fous suivent)
            devLog.warn(
              "⚠️ Échec de la vérification du boot — poursuite avec la vérification du jeton:",
              bootErr,
            );
          }

          // 3) Vérification serveur du jeton (source de vérité)
          devLog.log("✅ Vérification du jeton auprès du serveur...");
          const currentUser = await authService.getCurrentUser();
          // Si succès: mettre à jour l'état courant avec l'utilisateur renvoyé par le serveur
          setUser(currentUser);
          devLog.log(
            "🔄 Auth restaurée depuis le stockage:",
            currentUser.email,
          );
        } catch (error) {
          // Différencier les erreurs réseau des échecs d’authentification
          const errorMessage =
            error instanceof Error ? error.message : "Erreur inconnue";

          if (
            errorMessage.includes("connexion") ||
            errorMessage.includes("réseau") ||
            errorMessage.includes("serveur") ||
            errorMessage.includes("trop de tentatives")
          ) {
            // Réseau instable: conserver l’utilisateur en cache et retenter plus tard
            devLog.warn(
              "🌐 Problème réseau/limitation durant la vérification:",
              errorMessage,
            );
            // On affiche temporairement l'utilisateur stocké pour ne pas briser l'UX
            setUser(storedUser);
            devLog.log(
              "⚠️ Utilisation de l’utilisateur en cache, nouvelle tentative planifiée",
            );
            // Re-vérification programmée (temporisation progressive simple)
            setTimeout(() => {
              devLog.log("🔄 Nouvelle tentative de vérification auth...");
              initializeAuth();
            }, 30000);
          } else {
            // Jeton invalide: purge et retour à l’écran de connexion
            devLog.warn("⚠️ Échec de vérification d’auth:", errorMessage);
            devLog.log("🧹 Nettoyage des données d’auth invalides...");
            authService.clearAuth();
            setUser(null);
          }
        }
      } else {
        // Aucun utilisateur stocké: s’assurer que les traces partielles sont effacées
        devLog.log("ℹ️ Aucun identifiant stocké");
        authService.clearAuth();
        setUser(null);
      }
    } catch (error) {
      // Erreur inattendue: garantir un état propre
      devLog.error("❌ Échec d’initialisation de l’auth:", error);
      authService.clearAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
      devLog.log("✅ Initialisation de l’auth terminée");
    }
  };

  /*
    Action: connexion utilisateur
    - Appelle authService.login qui effectue la requête /api/auth/login
    - Met à jour l'état utilisateur et signale l'achèvement via devLog
    - Les erreurs sont propagées pour être affichées côté composant appelant
  */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
      devLog.log("✅ Connexion réussie:", response.user.email);
    } catch (error) {
      devLog.error("Connexion échouée:", error);
      // Propager l’erreur pour affichage côté UI
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /*
    Action: déconnexion
    - Appelle authService.logout qui supprime le token côté serveur et/ou côté client
    - Réinitialise l'état utilisateur local pour refléter la déconnexion
    - Les erreurs sont simplement loggées; l'état local est nettoyé quel que soit le résultat
  */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      devLog.log("✅ Déconnexion réussie");
    } catch (error) {
      devLog.error("Déconnexion échouée:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Aide: vérifie la présence d’au moins un rôle donné
  const hasRole = useCallback(
    (roles: UserRole[]): boolean => {
      return user ? roles.includes(user.role) : false;
    },
    [user],
  );

  // Raccourci: administrateur ?
  const isAdmin = useCallback((): boolean => {
    return user?.role === "admin";
  }, [user]);

  // Peut éditer (admin et user)
  const canEdit = useCallback((): boolean => {
    return hasRole(["admin", "user"]);
  }, [hasRole]);

  // Valeur de contexte mémoïsée
  const value: AuthContextType = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      hasRole,
      isAdmin,
      canEdit,
    }),
    [user, isLoading, login, logout, hasRole, isAdmin, canEdit],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
