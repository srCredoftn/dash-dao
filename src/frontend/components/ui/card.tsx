/*
  Composants Card (Card, CardHeader, CardTitle, CardContent, CardFooter)
  - Fournissent une structure sémantique et accessible pour les panneaux UI
  - Les commentaires ci-dessous expliquent les responsabilités de chaque sous-composant
    (layout, spacing, rôle sémantique).
*/
import * as React from "react";
/**
 * Composants de carte (Card et sous-sections)
 * Rôle: fournir une structure visuelle réutilisable (conteneur, entête, contenu, pied).
 * Style: compatible thème clair/sombre via classes utilitaires Tailwind.
 * Accessibilité: structure sémantique (titre <h3/>) et séparation claire des zones.
 * Astuce: composer Card + CardHeader + CardContent + CardFooter pour des layouts consistants.
 */
import { cn } from "@/lib/utils";

/**
 * Card — conteneur principal (bordure, fond, ombre)
 * Utilisation: regrouper un bloc autonome (formulaire, panneau, etc.).
 * Props: accepte className et tous les attributs div natifs.
 * Implémentation: forwardRef pour déléguer le ref parent (scroll, focus, mesure...).
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

/**
 * CardHeader — section d’entête (titre/description) avec espacements verticaux
 * Conseils: mettre titres/legendes; pas d’actions ici (placer dans CardFooter).
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * CardTitle — titre sémantique de la carte (niveau h3)
 * A11y: utiliser des titres concis et informatifs; un seul par carte.
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * CardDescription — texte descriptif secondaire (aide/contexte)
 * Style: texte atténué pour ne pas concurrencer le titre.
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * CardContent — corps de carte (padding standard, sans padding-top)
 * Contenu: formulaires, tableaux, listes; éviter les actions primaires ici.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * CardFooter — zone destinée aux actions (boutons, liens, etc.)
 * Pattern: regrouper les CTA primaires/secondaires et liens d’assistance.
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
