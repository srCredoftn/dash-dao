/**
Rôle: Composant applicatif — src/frontend/components/AddTaskButton.tsx
Domaine: Frontend/Components
Exports: AddTaskButton
Dépendances: react, @/components/ui/button, ./TaskEditDialog, @/contexts/AuthContext, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState } from "react";
import { Button } from "@/components/ui/button";
import TaskEditDialog from "./TaskEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import type { DaoTask } from "@shared/dao";

interface AddTaskButtonProps {
  onTaskAdd: (
    newTaskData: Omit<DaoTask, "id" | "lastUpdatedAt" | "lastUpdatedBy">,
    opts?: { idempotencyKey?: string },
  ) => Promise<void> | void;
  canManage?: boolean;
}

export default function AddTaskButton({ onTaskAdd }: AddTaskButtonProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  // Seul l'admin principal peut ajouter des tâches
  if (!isAdmin()) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (updates: Partial<DaoTask>) => {
    if (!updates.name) return;
    const payload: Omit<DaoTask, "id" | "lastUpdatedAt" | "lastUpdatedBy"> = {
      name: updates.name.trim(),
      isApplicable: updates.isApplicable ?? true,
      progress: 0,
      comment: "",
      assignedTo: undefined,
    };
    if (isSubmitting) return;
    setIsSubmitting(true);
    const idempotencyKey = `add-task:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try {
      await onTaskAdd(payload, { idempotencyKey });
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-2 flex justify-center">
      <Button onClick={() => setOpen(true)}>Ajouter une tâche</Button>
      <TaskEditDialog open={open} onOpenChange={setOpen} onSave={handleSave} />
    </div>
  );
}
