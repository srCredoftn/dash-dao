/**
Rôle: Composant applicatif — src/frontend/components/NewDaoDialog.tsx
Domaine: Frontend/Components
Exports: NewDaoDialog
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/input, @/components/ui/label, @/components/ui/textarea, @/components/ui/badge, @/services/authService
Liens: ui/* (atomes), hooks, contexts, services côté client
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { useState, useEffect } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_TASKS,
  type Dao,
  type TeamMember,
  type User,
} from "@shared/dao";
import { authService } from "@/services/authService";

// Fonction de repli pour générer localement un numéro
function generateDaoNumberFallback(existingDaos: any[]): string {
  const year = new Date().getFullYear();

  // Recherche les numéros de DAO existants pour l’année en cours
  const currentYearDaos = existingDaos.filter(
    (dao) => dao.numeroListe && dao.numeroListe.startsWith(`DAO-${year}-`),
  );

  if (currentYearDaos.length === 0) {
    return `DAO-${year}-001`;
  }

  // Extrait les numéros et trouve le plus élevé
  const numbers = currentYearDaos
    .map((dao) => {
      const match = dao.numeroListe.match(/DAO-\d{4}-(\d{3})/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((num) => !isNaN(num));

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `DAO-${year}-${nextNumber.toString().padStart(3, "0")}`;
}

interface NewDaoDialogProps {
  onCreateDao: (
    dao: Omit<Dao, "id" | "createdAt" | "updatedAt">,
    options?: { idempotencyKey?: string },
  ) => Promise<void> | void;
  existingDaos: Dao[];
}

export default function NewDaoDialog({
  onCreateDao,
  existingDaos,
}: NewDaoDialogProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [formData, setFormData] = useState({
    numeroListe: "",
    objetDossier: "",
    reference: "",
    autoriteContractante: "",
    dateDepot: "",
    teamLeader: null as TeamMember | null,
    teamMembers: [] as TeamMember[],
  });

  // Récupère les utilisateurs et calcule un numéro de prévisualisation localement à l’ouverture du dialogue
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setIsLoadingUsers(true);
        try {
          const usersList = await authService.getAllUsers();
          setUsers(usersList);
        } catch (error) {
          console.warn("Échec de récupération des utilisateurs :", error);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchData();
      // Toujours calculer un numéro de prévisualisation non muté en local pour éviter de consommer les séquences côté serveur
      const previewNumber = generateDaoNumberFallback(existingDaos);
      setFormData((prev) => ({ ...prev, numeroListe: previewNumber }));
      // Génère une nouvelle clé d’idempotence pour cette session de dialogue
      setIdempotencyKey(
        `dao-create:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      );
      setIsSubmitting(false);
    }
  }, [open, existingDaos]);

  // Convertit les utilisateurs au format membres d’équipe
  // Construit une liste unique de membres disponibles (déduplication par id)
  const availableTeamMembers: TeamMember[] = Array.from(
    new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "membre_equipe" as const,
        },
      ]),
    ).values(),
  );

  // Variables d’état liées à la référence supprimées car on utilise désormais un champ simple

  const [teamOpen, setTeamOpen] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<
    "chef_equipe" | "membre_equipe"
  >("membre_equipe");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  // État de validation
  const [errors, setErrors] = useState({
    objetDossier: "",
    reference: "",
    autoriteContractante: "",
    dateDepot: "",
    teamLeader: "",
    teamMembers: "",
  });

  // Fonctions de validation
  const validateField = (fieldName: string, value: any) => {
    let error = "";
    switch (fieldName) {
      case "objetDossier":
        if (!value || value.trim().length < 5) {
          error = "L'objet du dossier doit contenir au moins 5 caractères";
        }
        break;
      case "reference":
        if (!value || value.trim().length < 2) {
          error = "La référence est obligatoire";
        }
        break;
      case "autoriteContractante":
        if (!value || value.trim().length < 3) {
          error = "L'autorité contractante est obligatoire";
        }
        break;
      case "dateDepot":
        if (!value) {
          error = "La date de dépôt est obligatoire";
        } else {
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            error = "La date de dép��t ne peut pas être dans le passé";
          }
        }
        break;
      case "teamLeader":
        if (!value) {
          error = "Un chef d'équipe doit être assigné";
        }
        break;
      case "teamMembers":
        if (!value || value.length === 0) {
          error = "Au moins un membre d'équipe doit être assigné";
        }
        break;
    }

    setErrors((prev) => ({ ...prev, [fieldName]: error }));
    return error === "";
  };

  // Vérifie si le formulaire est valide
  const isFormValid = () => {
    const hasRequiredFields =
      formData.objetDossier.trim().length >= 5 &&
      formData.reference.trim().length >= 2 &&
      formData.autoriteContractante.trim().length >= 3 &&
      formData.dateDepot &&
      formData.teamLeader &&
      formData.teamMembers.length > 0;

    const hasNoErrors = Object.values(errors).every((error) => error === "");

    return hasRequiredFields && hasNoErrors;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Valide le champ à la modification avec un léger délai pour éviter une validation continue pendant la saisie
    setTimeout(() => validateField(fieldName, value), 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Valide tous les champs
    const fieldsToValidate = [
      { name: "objetDossier", value: formData.objetDossier },
      { name: "reference", value: formData.reference },
      { name: "autoriteContractante", value: formData.autoriteContractante },
      { name: "dateDepot", value: formData.dateDepot },
      { name: "teamLeader", value: formData.teamLeader },
      { name: "teamMembers", value: formData.teamMembers },
    ];

    const validationResults = fieldsToValidate.map((field) =>
      validateField(field.name, field.value),
    );

    if (!validationResults.every((valid) => valid)) {
      return;
    }

    try {
      setIsSubmitting(true);
      // Garantit que numeroListe est défini sans appeler un endpoint mutateur
      const ensuredNumero =
        formData.numeroListe || generateDaoNumberFallback(existingDaos);
      const newDao: Omit<Dao, "id" | "createdAt" | "updatedAt"> = {
        numeroListe: ensuredNumero,
        objetDossier: formData.objetDossier,
        reference: formData.reference,
        autoriteContractante: formData.autoriteContractante,
        dateDepot: formData.dateDepot,
        equipe: formData.teamLeader
          ? [
              { ...formData.teamLeader, role: "chef_equipe" as const },
              ...formData.teamMembers,
            ]
          : formData.teamMembers,
        tasks: DEFAULT_TASKS.map((task) => ({
          ...task,
          progress: null,
          comment: undefined,
          assignedTo: undefined,
        })),
      };

      await onCreateDao(newDao, { idempotencyKey });

      // Réinitialiser le formulaire uniquement après une création réussie
      setFormData({
        numeroListe: "",
        objetDossier: "",
        reference: "",
        autoriteContractante: "",
        dateDepot: "",
        teamLeader: null,
        teamMembers: [],
      });
      setErrors({
        objetDossier: "",
        reference: "",
        autoriteContractante: "",
        dateDepot: "",
        teamLeader: "",
        teamMembers: "",
      });
      setOpen(false);
    } catch (error) {
      console.error("Erreur lors de la création du DAO:", error);
      // Ne pas fermer le dialogue en cas d'erreur
    } finally {
      setIsSubmitting(false);
    }
  };

  const setTeamLeader = (member: TeamMember | null) => {
    setFormData((prev) => ({
      ...prev,
      teamLeader: member ? { ...member, role: "chef_equipe" } : null,
      // Retire de la liste des membres s’il y était
      teamMembers: member
        ? prev.teamMembers.filter((m) => m.id !== member.id)
        : prev.teamMembers,
    }));
  };

  const addTeamMember = (member: TeamMember) => {
    if (
      !formData.teamMembers.find((m) => m.id === member.id) &&
      (!formData.teamLeader || formData.teamLeader.id !== member.id)
    ) {
      const updatedMembers = [...formData.teamMembers, member];
      setFormData((prev) => ({
        ...prev,
        teamMembers: updatedMembers,
      }));
      // Valide après l’ajout
      setTimeout(() => validateField("teamMembers", updatedMembers), 100);
    }
  };

  const removeTeamMember = (memberId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updatedMembers = formData.teamMembers.filter(
      (m) => m.id !== memberId,
    );
    setFormData((prev) => ({
      ...prev,
      teamMembers: updatedMembers,
    }));
    // Valide après la suppression
    setTimeout(() => validateField("teamMembers", updatedMembers), 100);
  };

  const addNewMember = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (newMemberName.trim()) {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || undefined,
        role: newMemberRole,
      };

      if (newMemberRole === "chef_equipe") {
        setTeamLeader(newMember);
      } else {
        addTeamMember(newMember);
      }

      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("membre_equipe");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="w-full xs:w-auto lg:w-40 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="sm:hidden">Nouveau DAO</span>
          <span className="hidden sm:inline">Nouveau DAO</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau DAO</DialogTitle>
          <DialogDescription>
            Saisissez les informations du nouveau dossier d'appel d'offres
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Numéro généré automatiquement */}
            <div className="space-y-2">
              <Label htmlFor="numero">Numéro de liste (automatique)</Label>
              <Input
                id="numero"
                value={formData.numeroListe}
                disabled
                className="bg-muted text-center font-mono font-bold"
              />
              <p className="text-xs text-muted-foreground">
                Numéro généré automatiquement en séquence
              </p>
            </div>

            {/* Date limite */}
            <div className="space-y-2">
              <Label htmlFor="dateDepot">Date de dépôt *</Label>
              <Input
                id="dateDepot"
                type="date"
                value={formData.dateDepot}
                onChange={(e) => handleFieldChange("dateDepot", e.target.value)}
                required
                className={errors.dateDepot ? "border-red-500" : ""}
              />
              {errors.dateDepot && (
                <p className="text-xs text-red-500">{errors.dateDepot}</p>
              )}
            </div>
          </div>

          {/* Objet */}
          <div className="space-y-2">
            <Label htmlFor="objet">Objet du dossier *</Label>
            <Textarea
              id="objet"
              placeholder="Description détaillée du projet (minimum 5 caractères)..."
              value={formData.objetDossier}
              onChange={(e) =>
                handleFieldChange("objetDossier", e.target.value)
              }
              required
              className={errors.objetDossier ? "border-red-500" : ""}
            />
            {errors.objetDossier && (
              <p className="text-xs text-red-500">{errors.objetDossier}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.objetDossier.length}/5 caractères minimum
            </p>
          </div>

          {/* Champ Référence */}
          <div className="space-y-2">
            <Label htmlFor="reference">Référence *</Label>
            <Input
              id="reference"
              placeholder="Saisir la référence..."
              value={formData.reference}
              onChange={(e) => handleFieldChange("reference", e.target.value)}
              required
              className={errors.reference ? "border-red-500" : ""}
            />
            {errors.reference && (
              <p className="text-xs text-red-500">{errors.reference}</p>
            )}
            <p className="text-xs text-muted-foreground">
              (ex: AMI-2025-SYSINFO, AO-2025-DATACENTER...)
            </p>
          </div>

          {/* Autorité contractante Input (simple, sans suggestions) */}
          <div className="space-y-2">
            <Label htmlFor="autoriteContractante">
              Autorité contractante *
            </Label>
            <Input
              id="autoriteContractante"
              placeholder="Saisir l'autorité contractante..."
              value={formData.autoriteContractante}
              onChange={(e) =>
                handleFieldChange("autoriteContractante", e.target.value)
              }
              required
              className={errors.autoriteContractante ? "border-red-500" : ""}
            />
            {errors.autoriteContractante && (
              <p className="text-xs text-red-500">
                {errors.autoriteContractante}
              </p>
            )}
          </div>

          {/* Sélection de l’équipe */}
          <div className="space-y-4">
            <Label>Équipe de montage</Label>

            {/* Sélection du chef d’équipe */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chef d'équipe *</Label>
              <Select
                value={formData.teamLeader?.id || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setTeamLeader(null);
                    handleFieldChange("teamLeader", null);
                  } else {
                    const leader = availableTeamMembers.find(
                      (m) => m.id === value,
                    );
                    if (leader) {
                      setTeamLeader(leader);
                      handleFieldChange("teamLeader", leader);
                    }
                  }
                }}
              >
                <SelectTrigger
                  className={errors.teamLeader ? "border-red-500" : ""}
                >
                  <SelectValue
                    placeholder={
                      isLoadingUsers
                        ? "Chargement..."
                        : "Sélectionner un chef d'équipe *"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {isLoadingUsers ? (
                    <SelectItem value="loading" disabled>
                      Chargement des utilisateurs...
                    </SelectItem>
                  ) : (
                    availableTeamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{member.name}</span>
                          {member.email && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {member.email}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.teamLeader && (
                <p className="text-xs text-red-500">{errors.teamLeader}</p>
              )}
            </div>

            {/* Sélection des membres de l’équipe */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Membres d'équipe *</Label>
              <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`justify-between w-full ${errors.teamMembers ? "border-red-500" : ""}`}
                  >
                    <span>
                      {isLoadingUsers
                        ? "Chargement..."
                        : formData.teamMembers.length > 0
                          ? `${formData.teamMembers.length} membre(s) sélectionné(s)`
                          : "Sélectionner des membres..."}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un membre..." />
                    <CommandList>
                      <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                      <CommandGroup>
                        {availableTeamMembers
                          .filter(
                            (member) =>
                              !formData.teamLeader ||
                              member.id !== formData.teamLeader.id,
                          )
                          .map((member) => {
                            const isSelected = formData.teamMembers.find(
                              (m) => m.id === member.id,
                            );
                            return (
                              <CommandItem
                                key={member.id}
                                onSelect={() =>
                                  isSelected
                                    ? removeTeamMember(member.id)
                                    : addTeamMember(member)
                                }
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => {}}
                                    className="mr-2"
                                  />
                                  <span>{member.name}</span>
                                  {member.email && (
                                    <span className="text-xs text-muted-foreground">
                                      ({member.email})
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.teamMembers && (
                <p className="text-xs text-red-500">{errors.teamMembers}</p>
              )}
            </div>

            {/* Affichage des membres sélectionnés */}
            {formData.teamMembers.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {formData.teamMembers.map((member) => (
                    <Badge
                      key={member.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <span className="truncate max-w-[100px]">
                        {member.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-muted-foreground hover:text-foreground ml-1"
                        onClick={(e) => removeTeamMember(member.id, e)}
                      >
                        ×
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Créer un nouveau membre — masqué à la demande de l’utilisateur */}
            {false && (
              <div className="space-y-3 border-t pt-3">
                <Label className="text-sm text-muted-foreground">
                  Créer un nouveau membre
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nom complet *"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                  <Input
                    placeholder="Email (optionnel)"
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Select
                    value={newMemberRole}
                    onValueChange={(value) =>
                      setNewMemberRole(value as "chef_equipe" | "membre_equipe")
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chef_equipe">Chef d'équipe</SelectItem>
                      <SelectItem value="membre_equipe">
                        Membre d'équipe
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => addNewMember(e)}
                    disabled={!newMemberName.trim()}
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className={
                !isFormValid() || isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }
            >
              {isSubmitting ? "Création..." : "Créer le DAO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
