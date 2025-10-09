/**
Rôle: Composant UI (Radix + Tailwind) — src/frontend/components/ui/progress.tsx
Domaine: Frontend/UI
Dépendances: react, @radix-ui/react-progress, @/lib/utils
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
/*
  Barre de progression réutilisable
  - Utilise Radix ProgressPrimitive pour les bases d'accessibilité
  - L'indicateur est animé via transform CSS pour de bonnes performances
  - Ce bloc explique la logique de calcul de la largeur et l'usage de la prop value
*/
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
