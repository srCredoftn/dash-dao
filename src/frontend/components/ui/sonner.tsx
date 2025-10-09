/*
  Wrapper pour Sonner Toaster qui synchronise le thème avec next-themes.
  - Permet d'utiliser un système de toasts alternatif (Sonner) aligné au thème
  - Les classNames personnalisées garantissent l'homogénéité visuelle avec le design system
*/
import { useTheme } from "next-themes";
/**
 * Toaster (Sonner) synchronisé avec le thème
 * Rôle: centraliser les notifications Sonner avec le thème clair/sombre.
 * Intégration: thème fourni par next-themes; classes tailwind pour cohérence visuelle.
 */
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster — composant global de notifications (Sonner)
 * Synchronise le thème via next-themes.
 * Les classNames permettent d’unifier l’apparence avec le design system local.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
