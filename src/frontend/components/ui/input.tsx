/*
  Input de formulaire standardisé
  - ForwardRef pour compatibilité avec les bibliothèques de formulaire
  - Styles inclus pour états focus/disabled et fallback file input
  - Ce bloc de commentaires décrit les props supportées et les choix d'accessibilité
*/
import * as React from "react";
/**
 * Champ de saisie (Input) standardisé
 * Objectif: fournir un input accessible, stylé et cohérent.
 * Intégration: propagation de ref (forwardRef) pour les bibliothèques de formulaires.
 * A11y: compatible avec <Label htmlFor="..."> via prop id.
 * Style: inclut états focus/disabled et styles pour upload (file:*).
 */
import { cn } from "@/lib/utils";

/**
 * Input — accepte les attributs natifs d’input (type, disabled, placeholder, ...)
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
