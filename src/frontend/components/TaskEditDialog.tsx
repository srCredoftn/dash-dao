/**
Rôle: Composant applicatif — src/frontend/components/TaskEditDialog.tsx
Domaine: Frontend/Components
Exports: TaskEditDialog
Dépendances: react, @/components/ui/button, @/components/ui/input, @/components/ui/label, @/components/ui/switch, @/components/ui/checkbox, @/components/ui/badge, @/contexts/AuthContext
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { DaoTask, TeamMember } from "@shared/dao";

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: DaoTask;
  onSave: (updates: Partial<DaoTask>) => void;
  availableMembers?: TeamMember[];
}

export default function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onSave,
  availableMembers = [],
}: TaskEditDialogProps) {
  const { user, isAdmin } = useAuth();
  const [taskName, setTaskName] = useState("");
  const [isApplicable, setIsApplicable] = useState(true);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const isTeamLead = availableMembers.some(
    (m) => m.id === user?.id && m.role === "chef_equipe",
  );

  // Initialise les données du formulaire quand la tâche change ou à l’ouverture du dialogue
  useEffect(() => {
    if (task && open) {
      setTaskName(task.name);
      setIsApplicable(task.isApplicable);
      setAssignedTo(task.assignedTo || []);
    } else if (!task) {
      setTaskName("");
      setIsApplicable(true); // Par défaut, applicable pour les nouvelles tâches
      setAssignedTo([]);
    }
  }, [task, open]);

  const handleSave = () => {
    if (!taskName.trim()) {
      return; // Ne pas enregistrer si le nom est vide
    }

    const updates: Partial<DaoTask> = {};

    // Les administrateurs peuvent renommer
    if (isAdmin()) {
      updates.name = taskName.trim();
    }

    // Modification d’une tâche existante : seul le chef d’équipe peut changer l’applicabilité/l’assignation
    if (isEditing) {
      if (isTeamLead) {
        updates.isApplicable = isApplicable;
        updates.assignedTo = assignedTo.length ? assignedTo : undefined;
      }
    } else {
      // À la création, inclure les champs (la création est réservée aux admins côté backend)
      updates.isApplicable = isApplicable;
      updates.assignedTo = assignedTo.length ? assignedTo : undefined;
      if (isAdmin()) updates.name = taskName.trim();
    }

    onSave(updates);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isEditing = !!task;
  const title = isEditing ? "Modifier la tâche" : "Nouvelle tâche";
  const description = isEditing
    ? "Modifiez les détails de cette tâche."
    : "Ajoutez une nouvelle tâche à ce DAO.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nom de la tâche */}
          <div className="space-y-2">
            <Label htmlFor="task-name">Nom de la tâche *</Label>
            <Input
              id="task-name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Entrez le nom de la tâche"
              className="w-full"
              disabled={!isAdmin()}
            />
          </div>

          {/* Applicable — autoriser l'édition pour les chefs d'équipe et les admins */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is-applicable"
              checked={isApplicable}
              onCheckedChange={setIsApplicable}
              disabled={isEditing ? !isTeamLead : false}
            />
            <Label htmlFor="is-applicable">
              Cette tâche est applicable à ce DAO
            </Label>
          </div>
          {isEditing && (
            <div className="space-y-2">
              <Label>Assigner à</Label>
              <div className="max-h-40 overflow-y-auto space-y-2 border rounded p-2">
                {Array.from(
                  new Map(availableMembers.map((m) => [m.id, m])).values(),
                ).length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Aucun membre d'équipe
                  </div>
                ) : (
                  Array.from(
                    new Map(availableMembers.map((m) => [m.id, m])).values(),
                  ).map((m) => {
                    const checked = assignedTo.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!isTeamLead}
                          onCheckedChange={(v) => {
                            if (!isTeamLead) return;
                            setAssignedTo((prev) =>
                              v
                                ? [...prev, m.id]
                                : prev.filter((id) => id !== m.id),
                            );
                          }}
                        />
                        <span className="flex-1">
                          {m.name}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {m.role === "chef_equipe" ? "Chef" : "Membre"}
                          </Badge>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!taskName.trim()}>
            {isEditing ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
