/**
Rôle: Composant applicatif — src/frontend/components/TaskRow.tsx
Domaine: Frontend/Components
Exports: TaskRow
Dépendances: react, @/lib/utils, @/components/ui/switch, @/components/ui/slider, @/components/ui/button, ./TaskAssignmentDialog, ./TaskComments, ./TaskMenuButton
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
/*
  Import React et hooks locaux:
  - useState: état local pour l'édition, curseur temporaire, etc.
  - useRef: référence DOM pour le drag/drop et mesures; évite rerenders quand la valeur change.
  Les imports sont conservés proches du composant pour rendre évident leurs usages.
*/
import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import TaskAssignmentDialog from "./TaskAssignmentDialog";
import TaskComments from "./TaskComments";
import TaskMenuButton from "./TaskMenuButton";
import { useAuth } from "@/contexts/AuthContext";
import type { DaoTask, TeamMember, TaskComment } from "@shared/dao";

interface TaskRowProps {
  task: DaoTask;
  daoId: string;
  onProgressChange: (taskId: number, progress: number | null) => void;
  onCommentChange: (taskId: number, comment: string) => void;
  onApplicableChange: (taskId: number, applicable: boolean) => void;
  onAssignmentChange: (taskId: number, memberIds: string[]) => void;
  onTaskUpdate: (taskId: number, updates: Partial<DaoTask>) => void;
  availableMembers: TeamMember[];
  daysDiff: number;
  taskIndex: number;
  stagingMode?: boolean;
  stagedComments?: TaskComment[];
  onStageComment?: (taskId: number, c: TaskComment) => void;
  onUnstageComment?: (taskId: number, id: string) => void;
}

export function TaskRow(props: TaskRowProps) {
  const {
    task,
    daoId,
    onProgressChange,
    onApplicableChange,
    onAssignmentChange,
    onTaskUpdate,
    availableMembers,
    daysDiff,
    taskIndex,
    stagingMode = false,
    stagedComments = [],
    onStageComment,
    onUnstageComment,
  } = props;
  const { user, isAdmin } = useAuth();
  const isTeamLead = availableMembers.some(
    (m) => m.id === user?.id && m.role === "chef_equipe",
  );
  const canEditState = isTeamLead; // Seul le chef d'équipe peut modifier l'applicabilité/la progression/l'assignation
  const [isEditing, setIsEditing] = useState(false);
  const [tempProgress, setTempProgress] = useState(task.progress || 0);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    onProgressChange(task.id, tempProgress);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempProgress(task.progress || 0);
    setIsEditing(false);
  };

  const getProgressColor = (progress: number): string => {
    // Logique d'affichage de la couleur de progression :
    // 1. 100% → Gris (terminé)
    if (progress === 100) return "bg-gray-400";
    // 2. Échéance dépassée (daysDiff < 0) → Rouge
    if (daysDiff < 0) return "bg-red-500";
    // 3. Échéance lointaine (≥ 5 jours) → Vert
    if (daysDiff >= 5) return "bg-green-500";
    // 4. Échéance proche (≤ 3 jours) → Rouge
    if (daysDiff <= 3) return "bg-red-500";
    // 5. Sinon (entre 4 et 5 jours) → Bleu
    return "bg-blue-500";
  };

  const getSliderColor = (progress: number): string => {
    // Même logique que getProgressColor mais retourne des codes hex
    if (progress === 100) return "#9ca3af"; // gris
    if (daysDiff < 0) return "#ef4444"; // rouge
    if (daysDiff >= 5) return "#10b981"; // vert
    if (daysDiff <= 3) return "#ef4444"; // rouge
    return "#3b82f6"; // bleu
  };

  // Si non applicable, afficher une mise en page simplifiée
  if (!task.isApplicable) {
    return (
      <div
        ref={dragRef}
        draggable={false}
        className={cn(
          "bg-white rounded-lg border p-3 sm:p-4 transition-all duration-200",
        )}
      >
        {/* Mobile : disposition verticale */}
        <div className="block sm:hidden space-y-3">
          <div className="flex items-start gap-2">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0">
              {taskIndex}
            </span>
            <h4 className="font-medium text-sm flex-1 min-w-0 break-words">
              {task.name}
            </h4>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-muted-foreground">Applicable:</span>
            <div className="flex items-center gap-2">
              {canEditState ? (
                <Switch
                  checked={task.isApplicable}
                  onCheckedChange={(checked) =>
                    onApplicableChange(task.id, checked)
                  }
                />
              ) : (
                <span className="text-xs font-medium">Non</span>
              )}
            </div>
          </div>

          <div className="text-center py-2">
            <span className="text-sm text-muted-foreground italic">
              Non applicable
            </span>
          </div>
        </div>

        {/* Desktop : disposition horizontale */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mr-2">
                {taskIndex}
              </span>
              {task.name}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Applicable:</span>
              {canEditState ? (
                <Switch
                  checked={task.isApplicable}
                  onCheckedChange={(checked) =>
                    onApplicableChange(task.id, checked)
                  }
                />
              ) : (
                <span className="text-xs font-medium">Non</span>
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-sm text-muted-foreground">
              Non applicable
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      draggable={false}
      className={cn(
        "bg-white rounded-lg border p-3 sm:p-4 transition-all duration-200",
      )}
    >
      {/* Mobile : disposition verticale */}
      <div className="block sm:hidden space-y-3">
        <div className="flex items-start gap-2">
          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0">
            {taskIndex}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm break-words">{task.name}</h4>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-muted-foreground">Applicable:</span>
          <div className="flex items-center gap-2">
            {canEditState ? (
              <Switch
                checked={task.isApplicable}
                onCheckedChange={(checked) =>
                  onApplicableChange(task.id, checked)
                }
              />
            ) : (
              <span className="text-xs font-medium">
                {task.isApplicable ? "Oui" : "Non"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop : disposition horizontale */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mr-2">
                {taskIndex}
              </span>
              {task.name}
            </h4>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Applicable:</span>
              {canEditState ? (
                <Switch
                  checked={task.isApplicable}
                  onCheckedChange={(checked) =>
                    onApplicableChange(task.id, checked)
                  }
                />
              ) : (
                <span className="text-xs font-medium">
                  {task.isApplicable ? "Oui" : "Non"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mode édition avec curseur (slider) */}
      {isEditing && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Section curseur de progression */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground block">
              Avancement: {tempProgress}%
            </label>
            <div className="px-1">
              <Slider
                value={[tempProgress]}
                onValueChange={([value]) => setTempProgress(value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                style={
                  {
                    "--slider-color": getSliderColor(tempProgress),
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave}>
              Sauvegarder
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Affectation et affichage de la progression */}
      {!isEditing && (
        <div className="space-y-3 pt-3">
          {/* Section d'affectation */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Assigné à:</span>
            <TaskAssignmentDialog
              currentAssignedTo={task.assignedTo}
              availableMembers={availableMembers}
              onAssignmentChange={(memberIds) =>
                onAssignmentChange(task.id, memberIds)
              }
              taskName={task.name}
              canManage={isTeamLead}
            />
          </div>

          {/* Section progression */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avancement:</span>
              <span className="text-xs font-medium">{task.progress || 0}%</span>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  getProgressColor(task.progress || 0),
                )}
                style={{
                  width: `${task.progress || 0}%`,
                }}
              />
            </div>
          </div>

          {/* Actions (mobile) */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 sm:hidden">
            <div className="flex items-center gap-2">
              {canEditState && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="text-xs"
                >
                  Modifier
                </Button>
              )}
            </div>
            <TaskMenuButton
              task={task}
              onTaskUpdate={onTaskUpdate}
              canManage={isTeamLead || isAdmin()}
              availableMembers={availableMembers}
            />
          </div>

          {/* Boutons d'action (desktop) */}
          <div className="hidden sm:flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {canEditState && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="text-xs"
                >
                  Modifier
                </Button>
              )}
            </div>
            <TaskMenuButton
              task={task}
              onTaskUpdate={onTaskUpdate}
              canManage={isTeamLead || isAdmin()}
              availableMembers={availableMembers}
            />
          </div>

          {/* Section commentaires */}
          <div className="pt-2 border-t border-gray-100">
            <TaskComments
              daoId={daoId}
              taskId={task.id}
              taskName={task.name}
              availableMembers={availableMembers}
              stagingMode={stagingMode}
              stagedComments={stagedComments}
              onStageComment={(c) => onStageComment?.(task.id, c)}
              onUnstageComment={(id) => onUnstageComment?.(task.id, id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
