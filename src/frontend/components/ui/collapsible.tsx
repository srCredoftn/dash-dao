/**
Rôle: Composant UI (Radix + Tailwind) — src/frontend/components/ui/collapsible.tsx
Domaine: Frontend/UI
Dépendances: @radix-ui/react-collapsible
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
