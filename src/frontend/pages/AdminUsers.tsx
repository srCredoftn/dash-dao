import { useState, useEffect } from "react";
/**
 * Gestion des utilisateurs et rôles — administration
 * Rôle: lister les utilisateurs, changer les rôles (protégé par mot de passe), désactiver des comptes.
 */
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Plus,
  Edit3,
  Trash2,
  Shield,
  Eye,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { User as UserType, UserRole } from "@shared/dao";

export default function AdminUsers() {
  const { user } = useAuth();
  // État principal
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);

  // États de formulaires
  const [isCreating, setIsCreating] = useState(false);
  const SHOW_CREATE_BUTTON = false;

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "user" as UserRole,
  });

  const [editUser, setEditUser] = useState({ role: "user" as UserRole });
  const [rolePassword, setRolePassword] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Chargement conditionnel: seulement pour les admins authentifiés
  useEffect(() => {
    if (user && user.role === "admin") {
      loadUsers();
    }
  }, [user]);

  // Récupérer la liste des utilisateurs
  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersList = await authService.getAllUsers();
      setUsers(usersList);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Créer un utilisateur (optionnel, masqué par défaut)
  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsCreating(true);
    const idempotencyKey = `create-user:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try {
      await authService.createUser(
        {
          name: newUser.name.trim(),
          email: newUser.email.trim(),
          role: newUser.role,
        },
        { idempotencyKey },
      );
      setNewUser({ name: "", email: "", role: "user" });
      setIsCreateDialogOpen(false);
      await loadUsers();
    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur:", error);
      alert("Erreur lors de la création de l'utilisateur");
    } finally {
      setIsCreating(false);
    }
  };

  // Mise à jour de rôle (protégé par mot de passe super admin)
  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;
    setRoleError(null);
    try {
      await authService.updateUserRole(
        selectedUser.id,
        editUser.role,
        rolePassword,
      );
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setRolePassword("");
      await loadUsers();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.toLowerCase().includes("invalid password") ||
        msg.includes("INVALID_PASSWORD")
      ) {
        setRoleError("Mot de passe incorrect, veuillez réessayer");
        return;
      }
      console.error("Erreur lors de la mise à jour du rôle:", error);
      alert("Erreur lors de la mise à jour du rôle");
    }
  };

  // Désactivation d'un utilisateur (protégée)
  const handleDeactivateUser = async (userId: string) => {
    setDeleteError(null);
    setIsDeleting(true);
    const idempotencyKey = `deactivate-user:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try {
      await authService.deactivateUser(userId, deletePassword, {
        idempotencyKey,
      });
      await loadUsers();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeletePassword("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.toLowerCase().includes("invalid password") ||
        msg.includes("INVALID_PASSWORD")
      ) {
        setDeleteError("Mot de passe incorrect, veuillez réessayer");
        return;
      }
      console.error("Erreur lors de la désactivation de l'utilisateur:", error);
      alert("Erreur lors de la désactivation de l'utilisateur");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helpers UI
  const openDeleteConfirmation = (userItem: UserType) => {
    setUserToDelete(userItem);
    setDeletePassword("");
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (userToEdit: UserType) => {
    setSelectedUser(userToEdit);
    setEditUser({ role: userToEdit.role });
    setIsEditDialogOpen(true);
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "user":
        return <User className="h-4 w-4" />;
      case "viewer":
        return <Eye className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "user":
        return "default";
      case "viewer":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: UserRole, isSuperAdmin?: boolean) => {
    switch (role) {
      case "admin":
        return isSuperAdmin ? "Administrateur Principal" : "Administrateur";
      case "user":
        return "Utilisateur";
      case "viewer":
        return "Visualiseur";
      default:
        return role;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Protection d'accès (admin seulement)
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à cette
              page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Retour au tableau de bord</Link>
            </Button>
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
          {/* Mobile */}
          <div className="block lg:hidden">
            {/* Ligne 1: Retour + titre */}
            <div className="flex items-center space-x-3 mb-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="flex-shrink-0"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-1 text-sm">Retour</span>
                </Link>
              </Button>

              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold truncate">
                    Gestion des rôles
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    Gérez les rôles
                  </p>
                </div>
              </div>
            </div>

            {/* Ligne 2: Bouton d'action (optionnel) */}
            {SHOW_CREATE_BUTTON && (
              <div className="flex justify-center pt-1">
                <Dialog
                  open={isCreateDialogOpen}
                  onOpenChange={setIsCreateDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 h-auto shadow-md"
                      size="default"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Nouveau rôle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                      <DialogDescription>
                        Ajouter un nouvel utilisateur avec ses permissions. Un
                        mot de passe par défaut sera généré automatiquement.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nom complet *</Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) =>
                            setNewUser((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Nom et prénom"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) =>
                            setNewUser((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="email@example.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Rôle</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value: UserRole) =>
                            setNewUser((prev) => ({ ...prev, role: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Visualiseur</SelectItem>
                            <SelectItem value="user">Utilisateur</SelectItem>
                            <SelectItem value="admin">
                              Administrateur
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button onClick={handleCreateUser} disabled={isCreating}>
                        {isCreating ? "Création..." : "Créer l'utilisateur"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour au tableau de bord
                </Link>
              </Button>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Gestion des rôles</h1>
                  <p className="text-sm text-muted-foreground">
                    Gérez les rôles
                  </p>
                </div>
              </div>
            </div>

            {SHOW_CREATE_BUTTON && (
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau rôle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                    <DialogDescription>
                      Ajouter un nouvel utilisateur avec ses permissions. Un mot
                      de passe par défaut sera généré automatiquement.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet *</Label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Nom et prénom"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: UserRole) =>
                          setNewUser((prev) => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Visualiseur</SelectItem>
                          <SelectItem value="user">Utilisateur</SelectItem>
                          <SelectItem value="admin">Administrateur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating ? "Création..." : "Créer l'utilisateur"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              {users.length} utilisateur{users.length > 1 ? "s" : ""} enregistré
              {users.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{userItem.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {userItem.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(userItem.role)}>
                          {getRoleIcon(userItem.role)}
                          <span className="ml-1">
                            {getRoleLabel(userItem.role, userItem.isSuperAdmin)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(userItem.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {userItem.lastLogin
                          ? formatDate(userItem.lastLogin)
                          : "Jamais"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={userItem.isActive ? "default" : "secondary"}
                        >
                          {userItem.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(userItem)}
                            disabled={userItem.id === user.id}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteConfirmation(userItem)}
                            disabled={
                              userItem.id === user.id || !userItem.isActive
                            }
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog: modifier rôle */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
              <DialogDescription>
                Modifier le rôle de {selectedUser?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Utilisateur</Label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">{selectedUser?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedUser?.email}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Nouveau rôle</Label>
                <Select
                  value={editUser.role}
                  onValueChange={(value: UserRole) =>
                    setEditUser((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualiseur</SelectItem>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-password">Mot de passe Super Admin</Label>
                <Input
                  id="role-password"
                  type="password"
                  value={rolePassword}
                  onChange={(e) => setRolePassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                />
                {roleError && (
                  <p className="text-sm text-red-600">{roleError}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button onClick={handleUpdateUserRole}>Mettre à jour</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: désactivation */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Confirmer la désactivation de l'utilisateur
              </DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir désactiver ce compte ? Cette action est
                irréversible.
              </DialogDescription>
            </DialogHeader>

            {userToDelete && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-red-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-900">
                        {userToDelete.name}
                      </h4>
                      <p className="text-sm text-red-700">
                        {userToDelete.email}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Rôle:{" "}
                        {getRoleLabel(
                          userToDelete.role,
                          userToDelete.isSuperAdmin,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cette action désactivera le compte utilisateur. L'utilisateur
                  ne pourra plus se connecter.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="delete-password">
                    Mot de passe Super Admin
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                  />
                  {deleteError && (
                    <p className="text-sm text-red-600">{deleteError}</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setUserToDelete(null);
                  setDeletePassword("");
                  setDeleteError(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting || deletePassword.length === 0}
                onClick={() =>
                  userToDelete && handleDeactivateUser(userToDelete.id)
                }
              >
                {isDeleting ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
