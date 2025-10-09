/**
Rôle: Composant UI (Radix + Tailwind) — src/frontend/components/ui/skeleton.tsx
Domaine: Frontend/UI
Dépendances: @/lib/utils
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
