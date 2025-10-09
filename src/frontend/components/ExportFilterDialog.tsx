/**
Rôle: Composant applicatif — src/frontend/components/ExportFilterDialog.tsx
Domaine: Frontend/Components
Exports: ExportOptions, ExportFilterDialog
Dépendances: react, lucide-react, @/components/ui/button, @/components/ui/checkbox, @/components/ui/separator, @/components/ui/badge, @shared/dao
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { type DaoTask } from "@shared/dao";

type ExportFormat = "PDF" | "CSV";

export interface ExportOptions {
  includeTodos: boolean;
  includeInProgress: boolean;
  includeCompleted: boolean;
  includeNotApplicable: boolean;
  format: ExportFormat;
}

interface ExportFilterDialogProps {
  tasks: DaoTask[];
  onExport: (options: ExportOptions) => void;
  children: React.ReactNode;
}

export default function ExportFilterDialog({
  tasks,
  onExport,
  children,
}: ExportFilterDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeTodos: true,
    includeInProgress: true,
    includeCompleted: true,
    includeNotApplicable: true, // Include all tasks by default
    format: "PDF",
  });

  // Calculer les statistiques des tâches
  const todoTasks = tasks.filter(
    (task) => task.isApplicable && (task.progress || 0) === 0,
  );
  const inProgressTasks = tasks.filter(
    (task) =>
      task.isApplicable &&
      (task.progress || 0) > 0 &&
      (task.progress || 0) < 100,
  );
  const completedTasks = tasks.filter(
    (task) => task.isApplicable && (task.progress || 0) >= 100,
  );
  const notApplicableTasks = tasks.filter((task) => !task.isApplicable);

  const handleExport = () => {
    onExport(options);
    setIsOpen(false);
  };

  const updateOption = (
    key: keyof ExportOptions,
    value: boolean | ExportFormat,
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const totalSelectedTasks =
    (options.includeTodos ? todoTasks.length : 0) +
    (options.includeInProgress ? inProgressTasks.length : 0) +
    (options.includeCompleted ? completedTasks.length : 0) +
    (options.includeNotApplicable ? notApplicableTasks.length : 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <span>{children}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Options d'export
          </DialogTitle>
          <DialogDescription>
            Choisissez quelles tâches inclure dans l'export. Par défaut, toutes
            les tâches sont incluses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Format d'export</h4>
            <div className="flex gap-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={options.format === "PDF"}
                  onChange={() => updateOption("format", "PDF")}
                  className="text-primary focus:ring-primary"
                />
                <FileText className="h-4 w-4" />
                <span className="text-sm">PDF</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={options.format === "CSV"}
                  onChange={() => updateOption("format", "CSV")}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">CSV</span>
              </label>
            </div>
          </div>

          <Separator />

          {/* Task Filters */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Tâches à inclure</h4>

            <div className="space-y-3">
              {/* Todo Tasks */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="todos"
                    checked={options.includeTodos}
                    onCheckedChange={(checked) =>
                      updateOption("includeTodos", !!checked)
                    }
                  />
                  <label htmlFor="todos" className="text-sm cursor-pointer">
                    Tâches à faire
                  </label>
                </div>
                <Badge variant="outline" className="text-xs">
                  {todoTasks.length}
                </Badge>
              </div>

              {/* In Progress Tasks */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="inprogress"
                    checked={options.includeInProgress}
                    onCheckedChange={(checked) =>
                      updateOption("includeInProgress", !!checked)
                    }
                  />
                  <label
                    htmlFor="inprogress"
                    className="text-sm cursor-pointer"
                  >
                    Tâches en cours
                  </label>
                </div>
                <Badge variant="outline" className="text-xs">
                  {inProgressTasks.length}
                </Badge>
              </div>

              {/* Completed Tasks */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="completed"
                    checked={options.includeCompleted}
                    onCheckedChange={(checked) =>
                      updateOption("includeCompleted", !!checked)
                    }
                  />
                  <label htmlFor="completed" className="text-sm cursor-pointer">
                    Tâches terminées
                  </label>
                </div>
                <Badge variant="outline" className="text-xs">
                  {completedTasks.length}
                </Badge>
              </div>

              {/* Not Applicable Tasks */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="notapplicable"
                    checked={options.includeNotApplicable}
                    onCheckedChange={(checked) =>
                      updateOption("includeNotApplicable", !!checked)
                    }
                  />
                  <label
                    htmlFor="notapplicable"
                    className="text-sm cursor-pointer"
                  >
                    Tâches non applicables
                  </label>
                </div>
                <Badge variant="outline" className="text-xs">
                  {notApplicableTasks.length}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tâches sélectionnées :
              </span>
              <Badge variant="secondary" className="font-medium">
                {totalSelectedTasks} / {tasks.length}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={totalSelectedTasks === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exporter {options.format}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
