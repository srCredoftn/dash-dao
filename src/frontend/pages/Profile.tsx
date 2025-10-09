/**
Rôle: Page React (SPA) — src/frontend/pages/Profile.tsx
Domaine: Frontend/Pages
Exports: Profile
Dépendances: react, react-router-dom, @/components/ui/button, @/components/ui/input, @/components/ui/label, @/components/ui/alert, @/components/ui/separator, @/components/ui/badge
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
Performance: cache/partitionnement/bundling optimisés
*/
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Lock,
  Save,
  AlertCircle,
  Settings,
  Trash2,
  Bug,
  Server,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getAvatarUrl,
  setStoredAvatar,
  removeStoredAvatar,
} from "@/utils/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { cacheService } from "@/services/cacheService";
import { showAdminTools } from "@/utils/feature-flags";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const saveAvatar = async () => {
    if (!user || !avatarPreview) return;
    setIsUploadingAvatar(true);
    try {
      setStoredAvatar(user.id, avatarPreview);
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          u.avatarUrl = avatarPreview;
          localStorage.setItem("auth_user", JSON.stringify(u));
        } catch {}
      }
      toast({
        title: "Photo mise à jour",
        description: "Votre photo de profil a été enregistrée.",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const removeAvatarAction = async () => {
    if (!user) return;
    try {
      removeStoredAvatar(user.id);
      setAvatarPreview(null);
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          delete u.avatarUrl;
          localStorage.setItem("auth_user", JSON.stringify(u));
        } catch {}
      }
      toast({
        title: "Photo supprimée",
        description: "Votre photo de profil a été supprimée.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo.",
        variant: "destructive",
      });
    }
  };

  // État de validation en direct
  const [touched, setTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  // Admin tools state
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);
  const [diagnosisResults, setDiagnosisResults] = useState<string[]>([]);
  const [isAdmin] = useState(() => user?.role === "admin");

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
      });
      // Initialise l’aperçu d’avatar à partir de l’avatar stocké ou de l’utilisateur existant
      const initial = getAvatarUrl(user.id, user.name);
      setAvatarPreview(initial);
    }
  }, [user]);

  const validateProfileForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    } else if (formData.name.length > 15) {
      newErrors.name = "Maximum 15 caractères";
    } else if (!/^[\p{L}' -]{1,15}$/u.test(formData.name.trim())) {
      newErrors.name = "Caractères invalides";
    }

    // L'email ne peut plus être modifié par aucun utilisateur
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Le mot de passe actuel est requis";
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = "Le nouveau mot de passe est requis";
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword =
        "Le mot de passe doit contenir au moins 6 caractères";
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Admin tools functions
  const clearAllCaches = async () => {
    try {
      // Forcer le vidage de tous les caches
      cacheService.forceFullClear();

      // Forcer le rechargement pour nettoyer tout l’état en mémoire
      toast({
        title: "Cache vidé",
        description:
          "Tous les caches ont été vidés. Rechargement de la page...",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de vider le cache.",
        variant: "destructive",
      });
    }
  };

  const runDaosDiagnosis = async () => {
    setIsRunningDiagnosis(true);
    setDiagnosisResults([]);

    try {
      const results: string[] = [];

      results.push("🔍 Diagnostic des DAOs en cours...");
      setDiagnosisResults([...results]);

      // Teste la connexion à l’API
      try {
        const daos = await apiService.getAllDaos();
        results.push(`✅ API accessible - ${daos.length} DAOs trouvés`);

        // Vérifie chaque DAO individuellement
        for (const dao of daos) {
          try {
            const fetchedDao = await apiService.getDaoById(dao.id);
            if (fetchedDao.numeroListe === dao.numeroListe) {
              results.push(`✅ DAO ${dao.id} → ${dao.numeroListe} : OK`);
            } else {
              results.push(
                `❌ DAO ${dao.id} → Attendu: ${dao.numeroListe}, Reçu: ${fetchedDao.numeroListe}`,
              );
            }
          } catch (error) {
            results.push(`❌ DAO ${dao.id} → Erreur: ${error}`);
          }
          setDiagnosisResults([...results]);
        }
      } catch (error) {
        results.push(`❌ Erreur API: ${error}`);
      }

      results.push("🏁 Diagnostic terminé");
      setDiagnosisResults([...results]);
    } catch (error) {
      setDiagnosisResults(["❌ Erreur lors du diagnostic"]);
    } finally {
      setIsRunningDiagnosis(false);
    }
  };

  const restartServices = async () => {
    try {
      toast({
        title: "Redémarrage des services",
        description: "Vidage des caches et rechargement...",
      });

      // Vider tous les caches et recharger
      cacheService.clear();
      localStorage.clear(); // Efface l’authentification et autres données

      setTimeout(() => {
        window.location.href = "/login"; // Forcer un redémarrage complet
      }, 1000);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de redémarrer les services.",
        variant: "destructive",
      });
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateProfileForm()) return;

    setIsUpdatingProfile(true);
    try {
      await authService.updateProfile({ name: formData.name });
      // Mettre à jour immédiatement le cache local pour refléter le nouveau nom dans l'UI
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          u.name = formData.name;
          localStorage.setItem("auth_user", JSON.stringify(u));
        } catch {}
      }
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été mises à jour avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Password helpers
  const MIN_PASSWORD_LENGTH = 6;
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= MIN_PASSWORD_LENGTH) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    // Normalize score to 0-4 for UI simplicity
    score = Math.min(4, Math.max(0, score - 1));
    const labels = ["Très faible", "Faible", "Moyen", "Fort", "Très fort"];
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-emerald-600",
    ];
    return { score, label: labels[score], color: colors[score] };
  };

  const markTouched = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      setTouched({
        currentPassword: true,
        newPassword: true,
        confirmPassword: true,
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(passwordData.newPassword);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été modifié avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "user":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "user":
        return "Utilisateur";
      default:
        return "Inconnu";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Accès non autorisé</CardTitle>
            <CardDescription>
              Vous devez être connecté pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/login")}>Se connecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          {/* Disposition mobile */}
          <div className="block lg:hidden">
            <div className="flex items-center space-x-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="ml-1 text-sm">Retour</span>
              </Button>

              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold truncate">Mon Profil</h1>
                  <p className="text-xs text-muted-foreground truncate">
                    Gérez vos informations personnelles
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Disposition bureau */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Mon Profil</h1>
                <p className="text-sm text-muted-foreground">
                  Gérez vos informations personnelles
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Carte Informations utilisateur */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations du compte
              </CardTitle>
              <CardDescription>
                Modifiez vos informations personnelles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Role */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Rôle actuel</Label>
                  <p className="text-sm text-muted-foreground">
                    Votre niveau d'accès dans l'application
                  </p>
                </div>
                <Badge className={getRoleBadgeColor(user.role)}>
                  {getRoleLabel(user.role)}
                </Badge>
              </div>

              <Separator />

              {/* Téléversement d’avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={avatarPreview || getAvatarUrl(user.id, user.name)}
                    alt={user.name}
                  />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label>Photo de profil</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          setAvatarPreview(String(reader.result || ""));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!avatarPreview || isUploadingAvatar}
                        onClick={saveAvatar}
                      >
                        {isUploadingAvatar
                          ? "Enregistrement..."
                          : "Enregistrer"}
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!avatarPreview}
                        onClick={removeAvatarAction}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG/JPG, 1 Mo max recommandé.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Formulaire de profil */}
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    type="text"
                    maxLength={15}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value.slice(0, 15),
                      })
                    }
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email de connexion</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Modification de l'email désactivée pour tous les
                    utilisateurs.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdatingProfile
                    ? "Mise à jour..."
                    : "Mettre à jour le profil"}
                </Button>

                <div className="block sm:hidden flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!avatarPreview || isUploadingAvatar}
                    onClick={saveAvatar}
                    className="flex-1"
                  >
                    {isUploadingAvatar ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!avatarPreview}
                    onClick={removeAvatarAction}
                    className="flex-1"
                  >
                    Supprimer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Carte Changement de mot de passe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Changer le mot de passe
              </CardTitle>
              <CardDescription>
                Modifiez votre mot de passe pour sécuriser votre compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Utilisez un mot de passe fort avec au moins 6 caractères.
                </AlertDescription>
              </Alert>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Mot de passe actuel"
                      value={passwordData.currentPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          currentPassword: e.target.value,
                        });
                        markTouched("currentPassword");
                      }}
                      onBlur={() => markTouched("currentPassword")}
                      className={
                        touched.currentPassword && !passwordData.currentPassword
                          ? "border-red-500"
                          : touched.currentPassword &&
                              passwordData.currentPassword
                            ? "border-green-500"
                            : ""
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      aria-label={
                        showCurrentPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {touched.currentPassword && !passwordData.currentPassword && (
                    <p className="text-sm text-red-600">
                      Le mot de passe actuel est requis
                    </p>
                  )}
                  {touched.currentPassword && passwordData.currentPassword && (
                    <p className="text-sm text-green-600">Champ valide</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Nouveau mot de passe"
                      value={passwordData.newPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        });
                        markTouched("newPassword");
                      }}
                      onBlur={() => markTouched("newPassword")}
                      className={
                        touched.newPassword &&
                        passwordData.newPassword.length > 0 &&
                        passwordData.newPassword.length < MIN_PASSWORD_LENGTH
                          ? "border-red-500"
                          : touched.newPassword &&
                              passwordData.newPassword.length >=
                                MIN_PASSWORD_LENGTH
                            ? "border-green-500"
                            : ""
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={
                        showNewPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {/* Règles en direct */}
                  {touched.newPassword &&
                    passwordData.newPassword.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={
                              passwordData.newPassword.length >=
                              MIN_PASSWORD_LENGTH
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {passwordData.newPassword.length >=
                            MIN_PASSWORD_LENGTH
                              ? "Longueur suffisante"
                              : `Au moins ${MIN_PASSWORD_LENGTH} caractères`}
                          </span>
                          {(() => {
                            const s = getPasswordStrength(
                              passwordData.newPassword,
                            );
                            return (
                              <span className="text-xs font-medium text-gray-600">
                                Force: {s.label}
                              </span>
                            );
                          })()}
                        </div>
                        {(() => {
                          const s = getPasswordStrength(
                            passwordData.newPassword,
                          );
                          return (
                            <div className="h-1.5 w-full bg-gray-200 rounded">
                              <div
                                className={`h-1.5 rounded ${s.color}`}
                                style={{ width: `${(s.score + 1) * 20}%` }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  {touched.newPassword &&
                    passwordData.newPassword.length === 0 && (
                      <p className="text-sm text-red-600">
                        Le nouveau mot de passe est requis
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Confirmer le nouveau mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirmer le nouveau mot de passe"
                      value={passwordData.confirmPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        });
                        markTouched("confirmPassword");
                      }}
                      onBlur={() => markTouched("confirmPassword")}
                      className={
                        touched.confirmPassword &&
                        passwordData.confirmPassword.length > 0 &&
                        passwordData.confirmPassword !==
                          passwordData.newPassword
                          ? "border-red-500"
                          : touched.confirmPassword &&
                              passwordData.confirmPassword.length > 0 &&
                              passwordData.confirmPassword ===
                                passwordData.newPassword
                            ? "border-green-500"
                            : ""
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {touched.confirmPassword &&
                    passwordData.confirmPassword.length > 0 &&
                    passwordData.confirmPassword !==
                      passwordData.newPassword && (
                      <p className="text-sm text-red-600">
                        Les mots de passe ne correspondent pas
                      </p>
                    )}
                  {touched.confirmPassword &&
                    passwordData.confirmPassword.length > 0 &&
                    passwordData.confirmPassword ===
                      passwordData.newPassword && (
                      <p className="text-sm text-green-600">
                        Les mots de passe correspondent
                      </p>
                    )}
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isChangingPassword
                    ? "Modification..."
                    : "Changer le mot de passe"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Outils admin — réservé aux admins (masqué par défaut) */}
          {isAdmin && showAdminTools() && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <Settings className="h-5 w-5" />
                  Outils d'Administration
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Outils de diagnostic et de maintenance pour les
                  administrateurs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Accordion
                  type="single"
                  collapsible
                  defaultValue="admin-actions"
                >
                  <AccordionItem value="admin-actions">
                    <AccordionTrigger>Actions rapides</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <Button
                          onClick={clearAllCaches}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Vider les caches
                        </Button>
                        <Button
                          onClick={runDaosDiagnosis}
                          disabled={isRunningDiagnosis}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Bug className="h-4 w-4" />
                          {isRunningDiagnosis
                            ? "Diagnostic..."
                            : "Diagnostiquer DAOs"}
                        </Button>
                        <Button
                          onClick={restartServices}
                          variant="outline"
                          className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Server className="h-4 w-4" />
                          Redémarrer tout
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="diagnostics">
                    <AccordionTrigger>Résultats du diagnostic</AccordionTrigger>
                    <AccordionContent>
                      {diagnosisResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aucun résultat pour le moment.
                        </p>
                      ) : (
                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-60 overflow-y-auto">
                          {diagnosisResults.map((result, index) => (
                            <div key={index} className="mb-1">
                              {result}
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="smtp">
                    <AccordionTrigger>Emails / SMTP</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" disabled>
                          SMTP désactivé
                        </Button>
                        <Button variant="outline" disabled>
                          Envoi de test désactivé
                        </Button>
                      </div>
                      <Alert className="mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Le système d’e-mails est désactivé.
                        </AlertDescription>
                      </Alert>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
