/**
Rôle: Hook personnalisé — src/frontend/hooks/use-task-editing.ts
Domaine: Frontend/Hooks
Exports: useTaskEditing
Dépendances: react, @shared/dao
*/
import { useState } from "react";
import { DaoTask } from "@shared/dao";

interface UseTaskEditingProps {
  task: DaoTask;
  onProgressChange: (taskId: number, progress: number | null) => void;
  onCommentChange: (taskId: number, comment: string) => void;
}

export function useTaskEditing({
  task,
  onProgressChange,
  onCommentChange,
}: UseTaskEditingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempProgress, setTempProgress] = useState(task.progress || 0);
  const [tempComment, setTempComment] = useState(task.comment || "");

  const handleSave = () => {
    onProgressChange(task.id, tempProgress);
    onCommentChange(task.id, tempComment);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempProgress(task.progress || 0);
    setTempComment(task.comment || "");
    setIsEditing(false);
  };

  const handleEdit = () => {
    setTempProgress(task.progress || 0);
    setTempComment(task.comment || "");
    setIsEditing(true);
  };

  return {
    isEditing,
    tempProgress,
    tempComment,
    setTempProgress,
    setTempComment,
    handleSave,
    handleCancel,
    handleEdit,
  };
}
