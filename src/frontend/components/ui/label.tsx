/*
  Composant Label accessible basé sur Radix
  - Lie un libellé à un champ via htmlFor/id
  - Utiliser systématiquement Label + Input pour l'accessibilité
*/
import * as React from "react";
/**
 * Étiquette de champ (Label) basée sur Radix
 * Objectif: associer de manière accessible un libellé à un champ via htmlFor/id.
 * Variantes: gérées via cva si nécessaire.
 * A11y: toujours faire correspondre htmlFor (Label) et id (Input) pour le focus.
 */
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

/**
 * Label — composant accessible lié à un champ (htmlFor/id)
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
