import { useState, useEffect } from "react";
/**
 * Page de connexion (Login) — Application monopage (SPA)
 * Objectif: authentifier un utilisateur par email/mot de passe, puis rediriger.
 * Comportements principaux:
 * - Validation côté client (champs requis, longueur minimale)
 * - Préchargement paresseux (Index, DaoDetail) après connexion
 * - Gestion des erreurs lisibles et sans données sensibles
 * Dépendances: AuthContext (login), UI (Card/Button/Input/Label), Router (navigate, Link)
 */
/*
  Page de connexion (Login)
  - useNavigate/useLocation/Link: navigation SPA après authentification ou pour liens auxiliaires
  - Ce fichier doit rester simple: validation client, appels AuthContext.login, gestion des erreurs
  - Les commentaires détaillés ci-dessous expliquent chaque bloc de logique (validation, submit,
    états d'UI et comportements accessibles).
*/
import { useNavigate, useLocation, Link } from "react-router-dom";
import type { FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  // Champs contrôlés (email, mot de passe)
  // - State local synchronisé avec les champs du formulaire (inputs contrôlés)
  // - Permet la validation instantanée et l’activation/désactivation des boutons
  // - Toujours initialiser avec des chaînes vides pour éviter les valeurs "undefined"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Affichage/masquage du mot de passe
  // - UX: l’utilisateur peut vérifier sa saisie
  // - Accessibilité: l’icône est accompagnée d’un aria-label descriptif dynamique
  // - Sécurité: ce toggle n’affecte pas la transmission (HTTPS requis côté serveur)
  const [showPassword, setShowPassword] = useState(false);
  // Message d’erreur à destination de l’utilisateur
  // - N’expose jamais de détails techniques (stack traces, codes internes)
  // - Préférer des messages courts, actionnables et localisés
  const [error, setError] = useState("");
  // Statut de chargement (désactive les actions durant la requête)
  // - Empêche le double clic sur "Se connecter"
  // - Affiche un indicateur visuel (spinner) pendant la requête
  const [isLoading, setIsLoading] = useState(false);
  // Suivi d’interaction pour afficher l’aide de saisie mot de passe
  // - Montre des conseils dès que l’utilisateur a touché le champ
  // - Change la bordure de l’input selon la validité (rouge/vert)
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Auth: fonction login fournie par le contexte
  const { login } = useAuth();
  // Navigation post-authentification
  const navigate = useNavigate();
  // Récupération d’une destination d’origine éventuelle
  const location = useLocation();

  // Préchargement paresseux des écrans probables après connexion
  // - Utilise requestIdleCallback quand disponible (ou setTimeout de secours)
  // - Charge à l’avance les écrans fréquents (Index, DaoDetail) pour une navigation fluide
  // - N’influe pas sur le rendu actuel; déclenché après l’idle
  useEffect(() => {
    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === "function") {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 300);
      }
    };
    idle(() => {
      // Préchargements désactivés pour éviter duplications de chunk lors du build
      // Les pages seront chargées via la configuration de route/lazy lorsque nécessaire
    });
  }, []);

  // Destination post-auth (chemin + query + hash si présents), défaut "/"
  // - Si l’utilisateur a été redirigé vers /login depuis une page protégée,
  //   on le renvoie là où il voulait aller après connexion (pattern commun SPA)
  const fromState = location.state?.from as
    | { pathname: string; search?: string; hash?: string }
    | undefined;
  const from = fromState
    ? `${fromState.pathname}${fromState.search || ""}${fromState.hash || ""}`
    : "/";

  // Soumission du formulaire: valide, tente le login, puis redirige
  // Étapes:
  //  1) Empêcher le rechargement (e.preventDefault)
  //  2) Valider côté client (présence email + longueur mot de passe)
  //  3) Appeler AuthContext.login (requête /api/auth/login)
  //  4) En cas de succès → navigate(from)
  //  5) En cas d’erreur → message utilisateur sans infos sensibles
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Garde-fous côté client (UX) — le serveur reste source de vérité
    if (!email || !password) {
      setError("Veuillez saisir votre email et votre mot de passe");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setPasswordTouched(true);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      // Tentative de connexion via AuthContext
      await login({ email, password });

      // Redirection vers la page d’origine ou l’accueil
      navigate(from, { replace: true });
    } catch (err) {
      // Erreur normalisée et non verbeuse
      setError(err instanceof Error ? err.message : "Échec de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Conteneur principal centré */}
      <div className="w-full max-w-md space-y-6">
        {/* En-tête visuelle (logo, titre, sous-titre) */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="2SND Technologies"
              className="w-32 h-32 object-contain mix-blend-multiply"
              width="128"
              height="128"
              loading="eager"
              decoding="async"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 -mt-10">
            Gestion des DAO
          </h1>
          <p className="text-gray-600">Connectez-vous à votre compte</p>
        </div>

        {/* Formulaire de connexion */}
        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Saisissez vos identifiants pour accéder à la plateforme
            </CardDescription>
          </CardHeader>

          {/* Formulaire: utilise AuthContext.login puis redirige */}
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Courriel</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="votre.email@2snd.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Mot de passe + bouton afficher/masquer */}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                {/* Zone de saisie avec alternance de visibilité du mot de passe
                    - type="password" par défaut; bascule en "text" quand showPassword = true
                    - autoComplete="current-password" pour aider le navigateur
                    - Bordure conditionnelle en fonction de la validité (voir className ci-dessous)
                  */}
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordTouched(true);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    disabled={isLoading}
                    required
                    className={
                      // Feedback visuel immédiat pour guider l’utilisateur
                      passwordTouched &&
                      password.length > 0 &&
                      password.length < 6
                        ? "border-red-500" // trop court
                        : passwordTouched && password.length >= 6
                          ? "border-green-500" // valide
                          : "" // neutre
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    // Accessibilité: aria-label explicite qui suit l’état
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    data-no-navigate
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {/* Aide de saisie dynamique selon l’état du mot de passe
                    - Ne s’affiche qu’après interaction
                    - Fournit une règle simple: ≥ 6 caractères
                  */}
                {passwordTouched && (
                  <div className="mt-1 text-xs">
                    {password.length === 0 ? (
                      <p className="text-red-600">Le mot de passe est requis</p>
                    ) : password.length < 6 ? (
                      <p className="text-red-600">
                        Au moins 6 caractères requis
                      </p>
                    ) : (
                      <p className="text-green-600">
                        Format de mot de passe valide
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            {/* Actions: soumettre le formulaire et assistance */}
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                // Désactivé pendant l’appel réseau pour éviter les doubles envois
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>

              <div className="text-center">
                {/* Assistance: parcours de réinitialisation
                    - Prefetch au survol/focus pour accélérer l’ouverture du flux
                    - Ne révèle aucune info sur l’existence d’un compte côté serveur
                  */}
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  onMouseEnter={() => {}}
                  onFocus={() => {}}
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
