/**
Rôle: Composant applicatif — src/frontend/components/TaskProgressBar.tsx
Domaine: Frontend/Components
Exports: TaskProgressBar
Dépendances: @/lib/utils
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { cn } from "@/lib/utils";

interface TaskProgressBarProps {
  progress: number;
  daysDiff: number;
  isEditing?: boolean;
  tempProgress?: number;
}

export function TaskProgressBar({
  progress,
  daysDiff,
  isEditing = false,
  tempProgress,
}: TaskProgressBarProps) {
  const getProgressColor = (progressValue: number): string => {
    // Logique conditionnelle prioritaire :
    // 1. Si % d'avancement = 100% → Gris (priorité absolue)
    if (progressValue === 100) return "bg-gray-400";

    // 2. Si date dépassée (daysDiff < 0) → Rouge
    if (daysDiff < 0) return "bg-red-500";

    // 3. Si Date dépôt - Date aujourd'hui ≥ 5 jours → Vert
    if (daysDiff >= 5) return "bg-green-500";

    // 4. Si Date dépôt - Date aujourd'hui ≤ 3 jours → Rouge
    if (daysDiff <= 3) return "bg-red-500";

    // 5. Sinon (entre 4 et 5 jours) → Bleu
    return "bg-blue-500";
  };

  const currentProgress = isEditing ? (tempProgress ?? progress) : progress;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Progression</span>
        <span className="text-sm font-medium">{currentProgress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            getProgressColor(currentProgress),
          )}
          style={{
            width: `${currentProgress}%`,
          }}
        />
      </div>
    </div>
  );
}
