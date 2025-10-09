/**
Rôle: Composant applicatif — src/frontend/components/TaskMenuButton.tsx
Domaine: Frontend/Components
Exports: TaskMenuButton
Dépendances: react, lucide-react, @/components/ui/button, ./TaskEditDialog, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState } from "react";
import { MoreVertical, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TaskEditDialog from "./TaskEditDialog";
import type { DaoTask, TeamMember } from "@shared/dao";

interface TaskMenuButtonProps {
  task: DaoTask;
  onTaskUpdate: (taskId: number, updates: Partial<DaoTask>) => void;
  canManage?: boolean;
  availableMembers?: TeamMember[];
}

export default function TaskMenuButton({
  task,
  onTaskUpdate,
  canManage = false,
  availableMembers = [],
}: TaskMenuButtonProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  // N'afficher que lorsque l'appelant dispose de la permission de gestion (chef d'équipe)
  if (!canManage) {
    return null;
  }

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleTaskUpdate = (updates: Partial<DaoTask>) => {
    onTaskUpdate(task.id, updates);
    setShowEditDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted/50"
            aria-label="Actions de la tâche"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier la tâche
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <TaskEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        task={task}
        onSave={handleTaskUpdate}
        availableMembers={availableMembers}
      />
    </>
  );
}
