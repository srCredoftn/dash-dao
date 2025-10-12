/**
Rôle: Composant applicatif — src/frontend/components/EditDaoDialog.tsx
Domaine: Frontend/Components
Exports: EditDaoDialog
Dépendances: react, lucide-react, ui atoms, @shared/dao, @/services/authService
*/
import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import type { Dao, TeamMember, User } from "@shared/dao";
import { authService } from "@/services/authService";

interface EditDaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dao: Dao;
  onSave: (updates: {
    objetDossier: string;
    reference: string;
    autoriteContractante: string;
    dateDepot: string;
    equipe: TeamMember[];
  }) => void;
}

export default function EditDaoDialog({ open, onOpenChange, dao, onSave }: EditDaoDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const initialLeader = useMemo(() => dao.equipe.find((m) => m.role === "chef_equipe") || null, [dao.equipe]);
  const initialMembers = useMemo(() => dao.equipe.filter((m) => m.role === "membre_equipe"), [dao.equipe]);

  const [formData, setFormData] = useState({
    objetDossier: dao.objetDossier || "",
    reference: dao.reference || "",
    autoriteContractante: dao.autoriteContractante || "",
    dateDepot: dao.dateDepot ? toDateInputValue(dao.dateDepot) : "",
    teamLeader: initialLeader as TeamMember | null,
    teamMembers: initialMembers as TeamMember[],
  });

  useEffect(() => {
    if (open) {
      // sync when opening in case parent dao changed
      setFormData({
        objetDossier: dao.objetDossier || "",
        reference: dao.reference || "",
        autoriteContractante: dao.autoriteContractante || "",
        dateDepot: dao.dateDepot ? toDateInputValue(dao.dateDepot) : "",
        teamLeader: initialLeader,
        teamMembers: initialMembers,
      });
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const usersList = await authService.getAllUsers();
          setUsers(usersList);
        } catch (e) {
          console.warn("Échec de récupération des utilisateurs:", e);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dao.id]);

  const availableTeamMembers: TeamMember[] = useMemo(() => {
    return Array.from(
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
  }, [users]);

  const [teamOpen, setTeamOpen] = useState(false);

  const [errors, setErrors] = useState({
    objetDossier: "",
    reference: "",
    autoriteContractante: "",
    dateDepot: "",
    teamLeader: "",
    teamMembers: "",
  });

  const validateField = (fieldName: string, value: any) => {
    let error = "";
    switch (fieldName) {
      case "objetDossier":
        if (!value || value.trim().length < 5) error = "L'objet du dossier doit contenir au moins 5 caractères";
        break;
      case "reference":
        if (!value || value.trim().length < 2) error = "La référence est obligatoire";
        break;
      case "autoriteContractante":
        if (!value || value.trim().length < 3) error = "L'autorité contractante est obligatoire";
        break;
      case "dateDepot":
        if (!value) error = "La date de dépôt est obligatoire";
        break;
      case "teamLeader":
        if (!value) error = "Un chef d'équipe doit être assigné";
        break;
      case "teamMembers":
        if (!value || value.length === 0) error = "Au moins un membre d'équipe doit être assigné";
        break;
    }
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
    return error === "";
  };

  const isFormValid = () => {
    const hasRequiredFields =
      formData.objetDossier.trim().length >= 5 &&
      formData.reference.trim().length >= 2 &&
      formData.autoriteContractante.trim().length >= 3 &&
      formData.dateDepot &&
      formData.teamLeader &&
      formData.teamMembers.length > 0;
    const hasNoErrors = Object.values(errors).every((e) => e === "");
    return hasRequiredFields && hasNoErrors;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setTimeout(() => validateField(fieldName, value), 200);
  };

  const setTeamLeader = (member: TeamMember | null) => {
    setFormData((prev) => ({
      ...prev,
      teamLeader: member ? { ...member, role: "chef_equipe" } : null,
      teamMembers: member ? prev.teamMembers.filter((m) => m.id !== member.id) : prev.teamMembers,
    }));
  };

  const addTeamMember = (member: TeamMember) => {
    if (!formData.teamMembers.find((m) => m.id === member.id) && (!formData.teamLeader || formData.teamLeader.id !== member.id)) {
      const updated = [...formData.teamMembers, member];
      setFormData((prev) => ({ ...prev, teamMembers: updated }));
      setTimeout(() => validateField("teamMembers", updated), 100);
    }
  };

  const removeTeamMember = (memberId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = formData.teamMembers.filter((m) => m.id !== memberId);
    setFormData((prev) => ({ ...prev, teamMembers: updated }));
    setTimeout(() => validateField("teamMembers", updated), 100);
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    const equipe: TeamMember[] = formData.teamLeader
      ? [{ ...formData.teamLeader, role: "chef_equipe" as const }, ...formData.teamMembers]
      : formData.teamMembers;

    onSave({
      objetDossier: formData.objetDossier.trim(),
      reference: formData.reference.trim(),
      autoriteContractante: formData.autoriteContractante.trim(),
      dateDepot: toIsoFromInputValue(formData.dateDepot),
      equipe,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>      
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>Modifier le DAO</DialogTitle>
          <DialogDescription>Mettre à jour les informations du dossier d'appel d'offres</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numéro de liste</Label>
              <Input value={dao.numeroListe} disabled className="bg-muted text-center font-mono font-bold" />
            </div>
            <div className="space-y-2">
              <Label>Date de dépôt *</Label>
              <Input
                type="date"
                value={formData.dateDepot}
                onChange={(e) => handleFieldChange("dateDepot", e.target.value)}
                required
                className={errors.dateDepot ? "border-red-500" : ""}
              />
              {errors.dateDepot && <p className="text-xs text-red-500">{errors.dateDepot}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Objet du dossier *</Label>
            <Textarea
              placeholder="Description détaillée du projet (minimum 5 caractères)..."
              value={formData.objetDossier}
              onChange={(e) => handleFieldChange("objetDossier", e.target.value)}
              required
              className={errors.objetDossier ? "border-red-500" : ""}
            />
            {errors.objetDossier && <p className="text-xs text-red-500">{errors.objetDossier}</p>}
            <p className="text-xs text-muted-foreground">{formData.objetDossier.length}/5 caractères minimum</p>
          </div>

          <div className="space-y-2">
            <Label>Référence *</Label>
            <Input
              placeholder="Saisir la référence..."
              value={formData.reference}
              onChange={(e) => handleFieldChange("reference", e.target.value)}
              required
              className={errors.reference ? "border-red-500" : ""}
            />
            {errors.reference && <p className="text-xs text-red-500">{errors.reference}</p>}
          </div>

          <div className="space-y-2">
            <Label>Autorité contractante *</Label>
            <Input
              placeholder="Saisir l'autorité contractante..."
              value={formData.autoriteContractante}
              onChange={(e) => handleFieldChange("autoriteContractante", e.target.value)}
              required
              className={errors.autoriteContractante ? "border-red-500" : ""}
            />
            {errors.autoriteContractante && (
              <p className="text-xs text-red-500">{errors.autoriteContractante}</p>
            )}
          </div>

          <div className="space-y-4">
            <Label>Équipe de montage</Label>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Chef d'équipe *</Label>
              <Select
                value={formData.teamLeader?.id || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setTeamLeader(null);
                    handleFieldChange("teamLeader", null);
                  } else {
                    const leader = availableTeamMembers.find((m) => m.id === value);
                    if (leader) {
                      setTeamLeader(leader);
                      handleFieldChange("teamLeader", leader);
                    }
                  }
                }}
              >
                <SelectTrigger className={errors.teamLeader ? "border-red-500" : ""}>
                  <SelectValue placeholder={isLoadingUsers ? "Chargement..." : "Sélectionner un chef d'équipe *"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {isLoadingUsers ? (
                    <SelectItem value="loading" disabled>Chargement des utilisateurs...</SelectItem>
                  ) : (
                    availableTeamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{member.name}</span>
                          {member.email && (
                            <span className="text-xs text-muted-foreground ml-2">{member.email}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.teamLeader && <p className="text-xs text-red-500">{errors.teamLeader}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Membres d'équipe *</Label>
              <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-between w-full ${errors.teamMembers ? "border-red-500" : ""}`}>
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
                          .filter((member) => !formData.teamLeader || member.id !== formData.teamLeader.id)
                          .map((member) => {
                            const isSelected = formData.teamMembers.find((m) => m.id === member.id);
                            return (
                              <CommandItem
                                key={member.id}
                                onSelect={() => (isSelected ? removeTeamMember(member.id) : addTeamMember(member))}
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <input type="checkbox" checked={!!isSelected} onChange={() => {}} className="mr-2" />
                                  <span>{member.name}</span>
                                  {member.email && (
                                    <span className="text-xs text-muted-foreground">({member.email})</span>
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
              {errors.teamMembers && <p className="text-xs text-red-500">{errors.teamMembers}</p>}

              {formData.teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.teamMembers.map((member) => (
                    <span key={member.id} className="inline-flex items-center rounded bg-secondary px-2 py-1 text-xs">
                      <span className="truncate max-w-[120px]">{member.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-muted-foreground hover:text-foreground ml-1"
                        onClick={(e) => removeTeamMember(member.id, e)}
                      >
                        ×
                      </Button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isFormValid()} className={!isFormValid() ? "opacity-50 cursor-not-allowed" : ""}>
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toDateInputValue(value: string) {
  if (!value) return "";
  if (value.includes("T")) return value.split("T")[0];
  return value.slice(0, 10);
}

function toIsoFromInputValue(value: string) {
  if (!value) return "";
  if (value.includes("T")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  const candidate = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(candidate.getTime()) ? "" : candidate.toISOString();
}
