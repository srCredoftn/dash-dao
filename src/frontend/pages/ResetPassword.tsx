/**
Rôle: Page React (SPA) — src/frontend/pages/ResetPassword.tsx
Domaine: Frontend/Pages
Exports: ResetPassword
Dépendances: react, react-router-dom, lucide-react, @/components/ui/button, @/components/ui/input, @/components/ui/label, @/components/ui/alert, @/hooks/use-toast
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowLeft, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    email: "",
    token: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTokenVerified, setIsTokenVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const emailFromUrl = searchParams.get("email");
    if (emailFromUrl) {
      setFormData((prev) => ({ ...prev, email: emailFromUrl }));
    }
  }, [searchParams]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Format d'email invalide";
    }

    if (!formData.token.trim()) {
      newErrors.token = "Le code est requis";
    } else if (formData.token.length !== 6) {
      newErrors.token = "Le code doit contenir 6 chiffres";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "Le nouveau mot de passe est requis";
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword =
        "Le mot de passe doit contenir au moins 6 caractères";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const verifyToken = async () => {
    if (!formData.email || !formData.token) return;

    try {
      const response = await fetch("/api/auth/verify-reset-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          token: formData.token,
        }),
      });

      if (response.ok) {
        setIsTokenVerified(true);
        setErrors((prev) => ({ ...prev, token: "" }));
        toast({
          title: "Code vérifié",
          description:
            "Vous pouvez maintenant définir votre nouveau mot de passe.",
        });
      } else {
        const data = await response.json();
        setErrors((prev) => ({
          ...prev,
          token: data.error || "Code invalide",
        }));
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        token: "Erreur de vérification du code",
      }));
    }
  };

  const handleTokenChange = (value: string) => {
    // Autoriser uniquement les chiffres et limiter à 6 chiffres
    const numericValue = value.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, token: numericValue }));
    setIsTokenVerified(false);

    // Vérification automatique lorsque 6 chiffres sont saisis
    if (numericValue.length === 6) {
      setTimeout(() => verifyToken(), 500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          token: formData.token,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      toast({
        title: "Mot de passe réinitialisé",
        description:
          "Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.",
      });

      // Redirect to login page
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img
              src="/logo.png"
              alt="2SND Technologies"
              className="w-16 h-16 object-contain"
            />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="h-5 w-5" />
            Réinitialisation du mot de passe
          </CardTitle>
          <CardDescription>
            Entrez le code reçu par email et votre nouveau mot de passe
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.submit && (
              <Alert variant="destructive">
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="votre.email@exemple.com"
                disabled={isLoading}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Token Field */}
            <div className="space-y-2">
              <Label htmlFor="token">
                Code de réinitialisation (6 chiffres)
              </Label>
              <div className="relative">
                <Input
                  id="token"
                  type="text"
                  value={formData.token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  placeholder="123456"
                  disabled={isLoading}
                  className={`text-center text-lg font-mono tracking-wider ${
                    errors.token
                      ? "border-red-500"
                      : isTokenVerified
                        ? "border-green-500 bg-green-50"
                        : ""
                  }`}
                  maxLength={6}
                />
                {isTokenVerified && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Key className="h-4 w-4 text-green-600" />
                  </div>
                )}
              </div>
              {errors.token && (
                <p className="text-sm text-red-600">{errors.token}</p>
              )}
              {isTokenVerified && (
                <p className="text-sm text-green-600">
                  ✓ Code vérifié avec succès
                </p>
              )}
            </div>

            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  placeholder="Entrez votre nouveau mot de passe"
                  disabled={isLoading || !isTokenVerified}
                  className={errors.newPassword ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!isTokenVerified}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-600">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmer le nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="Confirmez votre nouveau mot de passe"
                  disabled={isLoading || !isTokenVerified}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={!isTokenVerified}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isTokenVerified}
              className="w-full"
            >
              <Lock className="h-4 w-4 mr-2" />
              {isLoading
                ? "Réinitialisation..."
                : "Réinitialiser le mot de passe"}
            </Button>

            <div className="text-center space-y-2">
              <Button variant="ghost" asChild>
                <Link to="/forgot-password">Renvoyer un code</Link>
              </Button>

              <div>
                <Button variant="ghost" asChild>
                  <Link to="/login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour à la connexion
                  </Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
