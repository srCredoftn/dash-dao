/**
Rôle: Composant applicatif — src/frontend/components/TaskAssignmentDialog.tsx
Domaine: Frontend/Components
Exports: TaskAssignmentDialog
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/label, @/components/ui/checkbox, @/components/ui/badge, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState } from "react";
import { Users, X, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { type TeamMember } from "@shared/dao";

// Helper : uniquement les vrais membres d'équipe ayant un e-mail
const isValidTaskAssignee = (member: TeamMember): boolean => {
  return (
    (member.role === "chef_equipe" || member.role === "membre_equipe") &&
    Boolean(member.email) &&
    !member.name.startsWith("Admin ")
  );
};

interface TaskAssignmentDialogProps {
  currentAssignedTo?: string[];
  availableMembers: TeamMember[];
  onAssignmentChange: (memberIds: string[]) => void;
  taskName: string;
  canManage?: boolean; // Seul le chef d'équipe devrait passer true
}

export default function TaskAssignmentDialog({
  currentAssignedTo,
  availableMembers,
  onAssignmentChange,
  taskName,
  canManage = false,
}: TaskAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    currentAssignedTo || [],
  );

  // Membres éligibles à l’assignation (unicité par id)
  const actualTeamMembers = Array.from(
    new Map(
      availableMembers.filter(isValidTaskAssignee).map((m) => [m.id, m]),
    ).values(),
  );

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAssignmentChange(selectedMembers);
    setOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedMembers(currentAssignedTo || []);
    setOpen(false);
  };

  const handleRemoveAssignment = (memberId: string) => {
    setSelectedMembers((prev: string[]) =>
      prev.filter((id: string) => id !== memberId),
    );
  };

  const currentMembers = actualTeamMembers.filter((m) =>
    (currentAssignedTo || []).includes(m.id),
  );

  // Lecture seule si l’utilisateur ne peut pas gérer les assignations
  if (!canManage) {
    return (
      <div className="flex items-center gap-1">
        {currentMembers.length === 0 ? (
          <span className="text-xs text-muted-foreground">Non assigné</span>
        ) : (
          <>
            {currentMembers.slice(0, 1).map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center rounded-md border border-input bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800"
              >
                {m.name}
              </span>
            ))}
            <button
              className="inline-flex items-center h-6 px-2 rounded-full border text-xs"
              aria-label="Voir les membres"
              onClick={() => {
                setSelectedMembers(currentAssignedTo || []);
                setMode("view");
                setOpen(true);
              }}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </>
        )}
        {/* Fenêtre de consultation pour les utilisateurs en lecture seule */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Liste des membres assignés
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Membres assignés</Label>
                {currentMembers.length ? (
                  <div className="space-y-2">
                    {currentMembers.map((m) => (
                      <div key={m.id} className="text-sm">
                        {m.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun membre assigné
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {currentMembers.length === 0 ? (
          <span className="text-xs text-muted-foreground">Non assigné</span>
        ) : (
          <>
            {currentMembers.slice(0, 1).map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center rounded-md border border-input bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800"
              >
                {m.name}
              </span>
            ))}
            <button
              className="inline-flex items-center h-6 px-2 rounded-full border text-xs"
              aria-label="Voir les membres"
              onClick={() => {
                setSelectedMembers(currentAssignedTo || []);
                setMode("view");
                setOpen(true);
              }}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full p-0 ml-1"
          onClick={() => {
            setMode("edit");
            setOpen(true);
          }}
          aria-label="Ajouter un membre"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {mode === "view"
                ? "Liste des membres assignés"
                : "Assigner la tâche"}
            </DialogTitle>
            {mode === "edit" && (
              <DialogDescription>
                Assignez un ou plusieurs membres à la tâche : "{taskName}"
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Membres assignés</Label>
              {selectedMembers.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((id) => {
                    const m = actualTeamMembers.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-md border border-input bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800"
                      >
                        {m.name}
                        <button
                          onClick={() => handleRemoveAssignment(id)}
                          aria-label="Retirer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun membre assigné
                </p>
              )}
            </div>

            {mode === "edit" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Choisir des membres
                  </Label>
                  {actualTeamMembers.length === 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs text-orange-600"
                    >
                      Aucun membre d'équipe
                    </Badge>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded p-2">
                  {actualTeamMembers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Aucun membre d'équipe disponible
                    </div>
                  ) : (
                    actualTeamMembers.map((member) => {
                      const checked = selectedMembers.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedMembers((prev: string[]) =>
                                v
                                  ? [...prev, member.id]
                                  : prev.filter(
                                      (id: string) => id !== member.id,
                                    ),
                              );
                            }}
                          />
                          <span className="flex-1">
                            {member.name}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {member.role === "chef_equipe"
                                ? "Chef"
                                : "Membre"}
                            </Badge>
                          </span>
                          {checked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => handleRemoveAssignment(member.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {mode === "view" ? (
              <Button type="button" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Annuler
                </Button>
                <Button onClick={handleSave}>Sauvegarder</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
