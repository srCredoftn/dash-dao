/**
Rôle: Composant applicatif — src/frontend/components/TeamEditDialog.tsx
Domaine: Frontend/Components
Exports: TeamEditDialog
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/label, @/components/ui/checkbox, @shared/dao, @/services/authService, @/components/ui/confirmation-dialog
Liens: ui/* (atomes), hooks, contexts, services côté client
Sécurité: veille à la validation d’entrée, gestion JWT/refresh, et limites de débit
*/
import { useState, useEffect } from "react";
import { Edit3, Users, X, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { type TeamMember, type User } from "@shared/dao";
import { authService } from "@/services/authService";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// Aide pour convertir des utilisateurs en membres d’équipe
const convertUserToTeamMember = (
  user: User,
  role: "chef_equipe" | "membre_equipe" = "membre_equipe",
): TeamMember => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role,
});

interface TeamEditDialogProps {
  currentTeam: TeamMember[];
  onTeamUpdate: (newTeam: TeamMember[]) => void;
  type: "chef" | "membres" | "both";
}

export default function TeamEditDialog({
  currentTeam,
  onTeamUpdate,
  type,
}: TeamEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [tempTeam, setTempTeam] = useState<TeamMember[]>(currentTeam);

  // Garder tempTeam synchronisé à l’ouverture du dialogue et lors des changements de currentTeam
  useEffect(() => {
    if (open) setTempTeam(currentTeam);
  }, [open, currentTeam]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Récupérer les utilisateurs à l’ouverture du dialogue
  useEffect(() => {
    if (open) {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const users = await authService.getAllUsers();
          // Dédupliquer par id/email pour éviter les doublons dans les listes (évite les collisions de clés)
          const unique = Array.from(
            new Map(
              users.map((u) => [
                u.id || u.email || `${u.name}-${u.createdAt}`,
                u,
              ]),
            ).values(),
          );
          setAvailableUsers(unique);
        } catch (error) {
          console.error("Échec de récupération des utilisateurs :", error);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [open]);

  // Convertir les utilisateurs au format membres disponibles (par défaut membre) et garantir l’unicité par id
  const availableMembers: TeamMember[] = Array.from(
    new Map(
      availableUsers
        .map((user) => convertUserToTeamMember(user, "membre_equipe"))
        .map((m) => [m.id, m]),
    ).values(),
  );

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Fusionner l’équipe actuelle avec les membres modifiés
    let newTeam: TeamMember[] = [];

    if (type === "chef") {
      // Edition du chef : conserver tous les membres existants, remplacer le chef
      const existingMembers = currentTeam.filter(
        (m) => m.role === "membre_equipe",
      );
      const newChef = tempTeam.find((m) => m.role === "chef_equipe");
      newTeam = newChef ? [...existingMembers, newChef] : existingMembers;
    } else if (type === "membres") {
      // Edition des membres : conserver le chef existant, remplacer les membres
      const existingChef = currentTeam.find((m) => m.role === "chef_equipe");
      const newMembers = tempTeam.filter((m) => m.role === "membre_equipe");
      newTeam = existingChef ? [existingChef, ...newMembers] : newMembers;
    } else {
      // Les deux : reconstruire chef + membres depuis tempTeam
      const newChef = tempTeam.find((m) => m.role === "chef_equipe");
      const newMembers = tempTeam.filter((m) => m.role === "membre_equipe");

      // Garantir qu’un utilisateur n’est pas à la fois chef et membre : retirer les doublons de la liste des membres
      const memberIds = new Set(newMembers.map((m) => m.id));
      if (newChef && memberIds.has(newChef.id)) {
        // retirer l’id du chef des membres
        newTeam = [newChef, ...newMembers.filter((m) => m.id !== newChef.id)];
      } else if (newChef) {
        newTeam = [newChef, ...newMembers];
      } else {
        newTeam = newMembers;
      }
    }

    // Déduplication finale : garantir des ids uniques
    const unique: Record<string, TeamMember> = {};
    for (const m of newTeam) unique[m.id] = m;
    const finalTeam = Object.values(unique);

    onTeamUpdate(finalTeam);
    setOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTempTeam(currentTeam);
    setOpen(false);
  };

  const addExistingMember = (
    member: TeamMember,
    roleOverride?: "chef_equipe" | "membre_equipe",
  ) => {
    const roleToUse =
      roleOverride || (type === "chef" ? "chef_equipe" : "membre_equipe");
    if (roleToUse === "chef_equipe") {
      // Pour le chef : remplacer le chef actuel et retirer ce même utilisateur des membres s’il est présent
      const newTeam = tempTeam.filter(
        (m) => m.role !== "chef_equipe" && m.id !== member.id,
      );
      setTempTeam([...newTeam, { ...member, role: "chef_equipe" }]);
    } else {
      // Pour les membres : ajouter s’il n’est pas déjà dans l’équipe (comme membre ou chef)
      if (!tempTeam.find((m) => m.id === member.id)) {
        setTempTeam([...tempTeam, { ...member, role: "membre_equipe" }]);
      }
    }
  };

  const removeMember = (memberId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTempTeam(tempTeam.filter((m) => m.id !== memberId));
  };

  const currentChef = tempTeam.filter((m) => m.role === "chef_equipe");
  const currentMembersList = tempTeam.filter((m) => m.role === "membre_equipe");

  // Pour les listes de sélection, afficher tous les utilisateurs disponibles (comme dans NewDaoDialog)
  // et gérer la déduplication lors de l’ajout à tempTeam.
  const availableToAdd = availableMembers;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Edit3 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Modifier
            {type === "chef"
              ? " le chef d'équipe"
              : type === "membres"
                ? " les membres d'équipe"
                : " l'équipe"}
          </DialogTitle>
          <DialogDescription>
            {type === "chef"
              ? "Sélectionnez un chef d'équipe parmi les utilisateurs existants"
              : type === "membres"
                ? "Gérez les membres de l'équipe à partir des utilisateurs existants"
                : "Modifiez le chef et les membres de l'équipe"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section Chef (pour chef et both) */}
          {(type === "chef" || type === "both") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chef actuel</Label>
              {currentChef.length > 0 ? (
                <div className="space-y-2">
                  {currentChef.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <span className="font-medium">{member.name}</span>
                        {member.email && (
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <ConfirmationDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        }
                        title={`Retirer le chef d'équipe`}
                        description={`Êtes-vous sûr de vouloir retirer ${member.name} de l'équipe ?`}
                        confirmText="Retirer"
                        onConfirm={() => removeMember(member.id)}
                        icon="warning"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun chef assigné
                </p>
              )}

              <div className="mt-2">
                <Label className="text-sm font-medium">
                  Sélectionner un chef existant
                </Label>
                <Select
                  onValueChange={(value) => {
                    const member = availableMembers.find((m) => m.id === value);
                    if (member) addExistingMember(member, "chef_equipe");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingUsers ? "Chargement..." : "Sélectionner..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Map(availableToAdd.map((m) => [m.id, m])).values(),
                    ).map((member, idx) => (
                      <SelectItem key={`${member.id}-${idx}`} value={member.id}>
                        {member.name} {member.email && `(${member.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Section Membres (pour membres et both) */}
          {(type === "membres" || type === "both") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Membres actuels</Label>
              {currentMembersList.length > 0 ? (
                <div className="space-y-2">
                  {currentMembersList.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <span className="font-medium">{member.name}</span>
                        {member.email && (
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <ConfirmationDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        }
                        title={`Retirer le membre`}
                        description={`Êtes-vous sûr de vouloir retirer ${member.name} de l'équipe ?`}
                        confirmText="Retirer"
                        onConfirm={() => removeMember(member.id)}
                        icon="warning"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun membre assigné
                </p>
              )}

              <div className="mt-2">
                <Label className="text-sm font-medium">
                  Ajouter un membre existant
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                    >
                      <span>
                        {isLoadingUsers
                          ? "Chargement..."
                          : currentMembersList.length > 0
                            ? `${currentMembersList.length} membre(s) sélectionné(s)`
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
                          {availableMembers
                            .filter((member) => {
                              // ne pas inclure le chef actuel
                              const chef = tempTeam.find(
                                (m) => m.role === "chef_equipe",
                              );
                              return !chef || chef.id !== member.id;
                            })
                            .map((member, idx) => {
                              const isSelected = tempTeam.find(
                                (m) =>
                                  m.id === member.id &&
                                  m.role === "membre_equipe",
                              );
                              return (
                                <CommandItem
                                  key={member.id || `${member.email}-${idx}`}
                                  onSelect={() => {
                                    if (isSelected) {
                                      // retirer
                                      setTempTeam((prev) =>
                                        prev.filter((m) => m.id !== member.id),
                                      );
                                    } else {
                                      addExistingMember(
                                        member,
                                        "membre_equipe",
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-center space-x-2 flex-1">
                                    <Checkbox
                                      checked={!!isSelected}
                                      onCheckedChange={() => {}}
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
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !(
                tempTeam.some((m) => m.role === "chef_equipe") &&
                tempTeam.some((m) => m.role === "membre_equipe")
              )
            }
          >
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
