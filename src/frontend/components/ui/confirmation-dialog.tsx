/**
Rôle: Composant UI (Radix + Tailwind) — src/frontend/components/ui/confirmation-dialog.tsx
Domaine: Frontend/UI
Exports: ConfirmationDialog, useConfirmation
Dépendances: lucide-react, react
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { ReactNode, useState } from "react";

interface ConfirmationDialogProps {
  trigger?: ReactNode;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  variant?: "destructive" | "default";
  disabled?: boolean;
  icon?: "trash" | "warning";
  // Nouvelles propriétés pour la gestion d'état externe
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  onConfirm,
  variant = "destructive",
  disabled = false,
  icon = "warning",
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  children,
}: ConfirmationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Utiliser l'état externe si fourni, sinon l'état interne
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const result = await onConfirm();
      if (result !== false) {
        setOpen(false);
      }
    } catch (error) {
      console.error("Erreur lors de la confirmation:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const IconComponent = icon === "trash" ? Trash2 : AlertTriangle;

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger && (
        <AlertDialogTrigger asChild disabled={disabled}>
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent
        className="z-[9999]"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          backgroundColor: "white",
          border: "2px solid #ef4444",
          borderRadius: "8px",
          maxWidth: "500px",
          width: "90vw",
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                variant === "destructive"
                  ? "bg-red-100 text-red-600 border-2 border-red-300"
                  : "bg-orange-100 text-orange-600"
              }`}
            >
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-gray-900">
                {title}
              </AlertDialogTitle>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="mt-4 text-gray-700 whitespace-pre-line">
          {description}
        </AlertDialogDescription>
        {children}
        <AlertDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel
            disabled={isProcessing}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300"
          >
            {cancelText}
          </AlertDialogCancel>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex-1 inline-flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${
              variant === "destructive"
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white font-semibold"
                : "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900"
            }`}
          >
            {isProcessing ? "En cours..." : confirmText}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook pour une utilisation programmatique
export function useConfirmation() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void | boolean | Promise<void | boolean>;
    variant?: "destructive" | "default";
  } | null>(null);

  const confirm = (options: {
    title: string;
    description: string;
    onConfirm: () => void | boolean | Promise<void | boolean>;
    variant?: "destructive" | "default";
  }) => {
    setDialogState({
      open: true,
      ...options,
    });
  };

  const ConfirmationComponent = dialogState ? (
    <AlertDialog
      open={dialogState.open}
      onOpenChange={(open) => setDialogState(open ? dialogState : null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                dialogState.variant === "destructive"
                  ? "bg-red-100 text-red-600"
                  : "bg-orange-100 text-orange-600"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>{dialogState.title}</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="mt-4">
          {dialogState.description}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <button
            type="button"
            onClick={async () => {
              const res = await dialogState.onConfirm();
              if (res !== false) setDialogState(null);
            }}
            className={`inline-flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              dialogState.variant === "destructive"
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                : "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900"
            }`}
          >
            Confirmer
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, ConfirmationComponent };
}
